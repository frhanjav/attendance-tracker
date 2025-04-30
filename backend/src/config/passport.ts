// backend/src/config/passport.ts
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import prisma from '../infrastructure/prisma';
import { config } from './index'; // Your main config
import { User } from '@prisma/client';
import bcrypt from 'bcrypt';

// Define what user data to store in the session/token (just the ID is common)
// Passport uses serialize/deserialize even if you don't use persistent sessions
// for the OAuth flow itself.
passport.serializeUser((user: any, done) => {
    // 'user' here is the user object returned from the GoogleStrategy verify callback
    done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
    try {
        const user = await prisma.user.findUnique({ where: { id } });
        done(null, user); // Attach user object to req.user if using sessions
    } catch (error) {
        done(error, null);
    }
});

// Configure Google OAuth 2.0 Strategy
passport.use(new GoogleStrategy({
    clientID: config.googleClientId,
    clientSecret: config.googleClientSecret,
    callbackURL: config.googleCallbackUrl,
    scope: ['profile', 'email'], // Request profile info and email address
    passReqToCallback: false // We don't need the request object in the verify callback
},
async (accessToken: string, refreshToken: string | undefined, profile: any, done: (error: any, user?: any, info?: any) => void) => {
    // This 'verify' callback runs after Google successfully authenticates the user
    // 'profile' contains user info from Google (id, displayName, emails, photos, etc.)
    console.log('[Passport Google Strategy] Profile received:', profile);

    try {
        const email = profile.emails?.[0]?.value; // Get primary email
        if (!email) {
            // Cannot proceed without an email from Google
            return done(new Error("Google profile did not return an email address."), false);
        }

        // Find user in your database by Google email
        let user = await prisma.user.findUnique({
            where: { email: email },
        });

        if (user) {
            // User exists - potentially update name/picture if needed
            // For simplicity, we just return the existing user
            console.log(`[Passport Google Strategy] Existing user found: ${user.id}`);
            return done(null, user); // Pass existing user to serializeUser
        } else {
            // User doesn't exist - Create a new user
            // Note: We need a way to handle password for OAuth users.
            // Option 1: Generate a random secure password (user won't use it)
            // Option 2: Make password nullable in Prisma (requires schema change)
            // Option 3: Add an 'authProvider' field (e.g., 'google', 'local')
            // Let's go with Option 1 for now (less secure if user tries password reset later)
            const randomPassword = Math.random().toString(36).slice(-12); // Insecure placeholder! Use crypto for real apps
            const hashedPassword = await bcrypt.hash(randomPassword, config.bcryptSaltRounds); // Need bcrypt

            console.log(`[Passport Google Strategy] Creating new user for email: ${email}`);
            const newUser = await prisma.user.create({
                data: {
                    email: email,
                    password: hashedPassword, // Store hashed random password
                    name: profile.displayName || email.split('@')[0], // Use Google name or derive from email
                    emailVerified: true, // Email from Google is considered verified
                    // Optionally store googleId: profile.id
                }
            });
            console.log(`[Passport Google Strategy] New user created: ${newUser.id}`);
            return done(null, newUser); // Pass new user to serializeUser
        }
    } catch (error) {
        console.error("[Passport Google Strategy] Error:", error);
        return done(error, false); // Pass error to Passport
    }
}));

export default passport; // Export configured passport instance