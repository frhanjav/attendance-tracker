import dotenv from 'dotenv';
import ms, { StringValue } from 'ms';
dotenv.config(); // Load .env file

// Helper to parse JWT expiry to seconds
const getJwtExpiresInSeconds = (): number => {
    const defaultDuration = '7d';
    const expiresInStr: string = process.env.JWT_EXPIRES_IN || defaultDuration;
    let milliseconds: number | undefined;
    try {
        milliseconds = ms(expiresInStr as StringValue);
        if (milliseconds === undefined) {
            console.warn(
                `Invalid JWT_EXPIRES_IN format: "${expiresInStr}". Defaulting to ${defaultDuration}.`,
            );
            milliseconds = ms(defaultDuration as StringValue); // Cast default too
        }
        if (typeof milliseconds !== 'number') {
            throw new Error('Could not determine milliseconds for JWT expiration.');
        }
        return Math.floor(milliseconds / 1000);
    } catch (e) {
        console.error(
            `Error parsing JWT_EXPIRES_IN: "${expiresInStr}". Defaulting to ${defaultDuration}.`,
            e,
        );
        const defaultMilliseconds = ms(defaultDuration as StringValue); // Cast default
        return Math.floor((defaultMilliseconds || 86400000 * 7) / 1000); // Default 7 days
    }
};

export const config = {
    port: process.env.PORT || 3001,
    databaseUrl: process.env.AIVEN_DATABASE_URL || process.env.DATABASE_URL || '',
    nodeEnv: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8080',

    // JWT
    jwtSecret: process.env.JWT_SECRET || 'fallback_jwt_secret_!!change_me!!',
    jwtExpiresInSeconds: getJwtExpiresInSeconds(), // Use seconds

    // Bcrypt
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),

    // Google OAuth
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || `${process.env.FRONTEND_URL || 'http://localhost:8080'}/auth/google/callback`,

    // Session
    sessionSecret: process.env.SESSION_SECRET || 'fallback_session_secret_!!change_me!!',
};

// --- Config Checks ---
if (!config.databaseUrl && config.nodeEnv !== 'test') {
    console.error('FATAL ERROR: DATABASE_URL is not defined.');
    process.exit(1);
}
if (config.jwtSecret.startsWith('fallback_jwt_secret') && config.nodeEnv === 'production') {
    console.warn('WARNING: JWT_SECRET is using a default fallback value in production!');
}
if (config.sessionSecret.startsWith('fallback_session_secret') && config.nodeEnv === 'production') {
    console.warn('WARNING: SESSION_SECRET is using a default fallback value in production!');
}
if (config.nodeEnv === 'production' && (!config.googleClientId || !config.googleClientSecret)) {
    console.error(
        'FATAL ERROR: Google OAuth Client ID or Secret not defined in production environment.',
    );
    // process.exit(1); // Uncomment to enforce in production
}
