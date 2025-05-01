// backend/src/config/passport.ts
import passport from 'passport';
import { Strategy as GoogleStrategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import bcrypt from 'bcrypt'; // Make sure bcrypt is installed
import crypto from 'crypto'; // For generating secure random password placeholder
import prisma from '../infrastructure/prisma';
import { config } from './index';
import { User } from '@prisma/client';

// Serialize user ID to session/token (used during OAuth flow)
passport.serializeUser((user: any, done) => {
    done(null, user.id);
});

// Deserialize user from session/token ID (used during OAuth flow)
passport.deserializeUser(async (id: string, done) => {
    try {
        // Fetch minimal user data needed for the flow
        const user = await prisma.user.findUnique({
            where: { id },
            select: { id: true, email: true, name: true },
        });
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

passport.use(
    new GoogleStrategy(
        {
            clientID: config.googleClientId,
            clientSecret: config.googleClientSecret,
            callbackURL: config.googleCallbackUrl,
            scope: ['profile', 'email'],
            passReqToCallback: false,
        },
        async (
            accessToken: string,
            refreshToken: string | undefined,
            profile: Profile,
            done: VerifyCallback,
        ) => {
            console.log('[Passport Google Strategy] Profile received:', {
                id: profile.id,
                displayName: profile.displayName,
                emails: profile.emails,
            });

            try {
                const email = profile.emails?.[0]?.value;
                if (!email) {
                    return done(
                        new Error('Google profile did not return an email address.'),
                        undefined,
                    ); // Pass undefined for user
                }

                let user = await prisma.user.findUnique({
                    where: { email: email },
                });

                if (user) {
                    // User exists
                    console.log(`[Passport Google Strategy] Existing user found: ${user.id}`);
                    // Optional: Update user's name or profile picture URL from Google profile here if desired
                    // await prisma.user.update({ where: { id: user.id }, data: { name: profile.displayName }});
                    return done(null, user); // Pass existing user
                } else {
                    // User doesn't exist - Create a new user
                    // Generate a secure random password placeholder (user won't use this)
                    const randomPassword = crypto.randomBytes(16).toString('hex'); // More secure than Math.random
                    const hashedPassword = await bcrypt.hash(
                        randomPassword,
                        config.bcryptSaltRounds,
                    );

                    console.log(`[Passport Google Strategy] Creating new user for email: ${email}`);
                    const newUser = await prisma.user.create({
                        data: {
                            email: email,
                            password: hashedPassword, // Store hashed random password
                            name: profile.displayName || email.split('@')[0],
                            emailVerified: true, // Email from Google is verified
                            // Optionally store provider details
                            // provider: 'google',
                            // providerId: profile.id,
                        },
                    });
                    console.log(`[Passport Google Strategy] New user created: ${newUser.id}`);
                    return done(null, newUser); // Pass new user
                }
            } catch (error) {
                console.error('[Passport Google Strategy] Error:', error);
                return done(error, undefined); // Pass error, undefined user
            }
        },
    ),
);

export default passport;
