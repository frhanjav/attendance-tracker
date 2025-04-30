import dotenv from 'dotenv';
import ms, { StringValue } from 'ms';
dotenv.config(); // Load .env file

// Helper to parse time string to seconds, defaulting to 1 day
const getExpiresInSeconds = (): number => {
  const defaultDuration = '1d';
  // Ensure expiresInStr is definitely a string
  const expiresInStr: string = process.env.JWT_EXPIRES_IN || defaultDuration;
  let milliseconds: number | undefined;

  try {
      // Try casting the input string explicitly to StringValue
      // Although this feels wrong, it might satisfy the type checker
      milliseconds = ms(expiresInStr as StringValue);

      // ... rest of the function remains the same ...
      if (milliseconds === undefined) {
           console.warn(`Invalid JWT_EXPIRES_IN format: "${expiresInStr}". Defaulting to ${defaultDuration}.`);
           milliseconds = ms(defaultDuration as StringValue); // Cast default too
      }
      if (typeof milliseconds !== 'number') {
           throw new Error('Could not determine milliseconds for JWT expiration.');
      }
      return Math.floor(milliseconds / 1000);

  } catch (e) {
      console.error(`Error parsing JWT_EXPIRES_IN: "${expiresInStr}". Defaulting to ${defaultDuration}.`, e);
      const defaultMilliseconds = ms(defaultDuration as StringValue); // Cast default
      return Math.floor((defaultMilliseconds || 86400000) / 1000);
  }
};

export const config = {
  port: process.env.PORT || 3001,
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'fallback_secret',
  jwtExpiresInSeconds: getExpiresInSeconds(),
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173', // For CORS
  nodeEnv: process.env.NODE_ENV || 'development',

  // --- Google OAuth ---
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || '',

  // --- Session Secret ---
  sessionSecret: process.env.SESSION_SECRET || 'fallback_session_secret',
};

// Add checks for Google creds in production
if (config.nodeEnv === 'production' && (!config.googleClientId || !config.googleClientSecret)) {
  console.error("FATAL ERROR: Google OAuth Client ID or Secret not defined in production environment.");
  process.exit(1);
}
if (config.sessionSecret === 'fallback_session_secret' && config.nodeEnv === 'production') {
  console.warn("WARNING: SESSION_SECRET is using a default fallback value in production!");
}

if (!config.databaseUrl && config.nodeEnv !== 'test') {
  console.error("FATAL ERROR: DATABASE_URL is not defined.");
  process.exit(1);
}
if (config.jwtSecret === 'fallback_secret' && config.nodeEnv === 'production') {
    console.warn("WARNING: JWT_SECRET is using a default fallback value in production!");
}