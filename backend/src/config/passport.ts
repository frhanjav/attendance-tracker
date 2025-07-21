import passport from 'passport';
import { Strategy as GoogleStrategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import prisma from '../infrastructure/prisma';
import { config } from './index';

passport.serializeUser((user: any, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
    try {
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
                    );
                }

                let user = await prisma.user.findUnique({
                    where: { email: email },
                });

                if (user) {
                    console.log(`[Passport Google Strategy] Existing user found: ${user.id}`);
                    return done(null, user);
                } else {
                    const randomPassword = crypto.randomBytes(16).toString('hex');
                    const hashedPassword = await bcrypt.hash(
                        randomPassword,
                        config.bcryptSaltRounds,
                    );

                    console.log(`[Passport Google Strategy] Creating new user for email: ${email}`);
                    const newUser = await prisma.user.create({
                        data: {
                            email: email,
                            password: hashedPassword,
                            name: profile.displayName || email.split('@')[0],
                            emailVerified: true,

                        },
                    });
                    console.log(`[Passport Google Strategy] New user created: ${newUser.id}`);
                    return done(null, newUser);
                }
            } catch (error) {
                console.error('[Passport Google Strategy] Error:', error);
                return done(error, undefined);
            }
        },
    ),
);

export default passport;
