import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Express, NextFunction, Request, Response } from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { config } from './config';
import passport from './config/passport';
import { NotFoundError } from './core/errors';
import { errorHandler } from './middleware/error.middleware';
import apiRouter from './routes';

// Install: npm install express-session @types/express-session cookie-parser @types/cookie-parser
// Optional production session store: npm install connect-pg-simple

const app: Express = express();

// --- Trust Proxy (Important if behind Nginx/Load Balancer for secure cookies) ---
// If your app runs behind a proxy (like in K8s with Ingress), set this.
// The number '1' means it trusts the first hop (e.g., the load balancer).
if (config.nodeEnv === 'production') {
    app.set('trust proxy', 1);
}

// --- Apply Helmet Middleware (EARLY) ---
// Use default settings first, then customize if needed
app.use(
  helmet({
    // Example: Customize Content Security Policy
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(), // Start with defaults
        "script-src": ["'self'", "trusted-cdn.com"], // Allow scripts from self and trusted CDN
        "img-src": ["'self'", "data:", "images.google.com"], // Allow images from self, data URIs, Google
        // Add other directives as needed (style-src, connect-src, etc.)
      },
    },
    // Example: Relax referrer policy if needed (default is strict-origin-when-cross-origin)
    // referrerPolicy: { policy: "no-referrer" },
    // Example: Configure HSTS (only if using HTTPS)
    // strictTransportSecurity: {
    //   maxAge: 15552000, // 180 days in seconds
    //   includeSubDomains: true,
    //   preload: true, // Submit to HSTS preload list (requires careful setup)
    // },
    // Example: Allow embedding in iframes from specific origins (default is DENY)
    // crossOriginEmbedderPolicy: false, // Or configure specific policies
    // xFrameOptions: { action: "SAMEORIGIN" }, // Allow framing only by your own origin
  })
);
// --- End Helmet ---

// --- Handle Uncaught Exceptions ---
// Should be placed early, but after essential imports/setup
process.on('uncaughtException', (err: Error) => {
  console.error('UNCAUGHT EXCEPTION!  Shutting down...');
  console.error(err.name, err.message);
  console.error(err.stack);
  // In production, log the error to your logging service here
  process.exit(1); // Mandatory shutdown after uncaught exception
});

// --- Global Middleware ---

// CORS Setup
app.use(cors({
  origin: config.frontendUrl, // Allow requests from your frontend
  credentials: true, // IMPORTANT: Allow cookies to be sent/received
}));

// Cookie Parser (before session and passport)
app.use(cookieParser());

// Body Parsers
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// --- Session Middleware (Required for Passport OAuth flow state) ---
app.use(session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false, // Only save sessions that have been modified
    cookie: {
        secure: config.nodeEnv === 'production', // Use secure cookies in production (HTTPS)
        httpOnly: true, // Prevent client-side JS access
        maxAge: 1000 * 60 * 60, // Example: 1 hour for the OAuth flow session cookie
        sameSite: config.nodeEnv === 'production' ? 'lax' : undefined, // Lax for production, allow default in dev (might be needed for localhost)
    },
    // TODO: Configure a production-ready session store (e.g., connect-pg-simple)
    // store: new PgSessionStore({ pool: pgPool, ... }),
}));

// --- Initialize Passport ---
app.use(passport.initialize());
// We don't need passport.session() if we are generating our own JWT in the callback
// and using a separate middleware (like 'protect') to verify that JWT for API requests.
// app.use(passport.session());

// --- Routes ---
console.log("Registering API routes under /api/v1");
app.use('/api/v1', apiRouter);
console.log('API Router Mounted at /api/v1');

// --- Not Found Handlers ---
// *** API 404 Handler - Catches requests starting with /api/v1 that DON'T match routes in apiRouter ***
app.all('/api/v1/*', (req: Request, res: Response, next: NextFunction) => {
  console.log(`API Route Not Found: ${req.method} ${req.originalUrl}`); // Add log
  next(new NotFoundError(`API route not found: ${req.originalUrl}`));
});

// *** Optional: Catch-all for non-API routes (if backend serves anything else) ***
// app.all('*', (req: Request, res: Response, next: NextFunction) => {
//   console.log(`Non-API Route Not Found: ${req.method} ${req.originalUrl}`);
//   next(new NotFoundError(`Resource not found: ${req.originalUrl}`));
// });
// --- End Not Found Handlers ---


// --- Global Error Handling Middleware ---
// Must be the LAST middleware added
app.use(errorHandler);


// --- Start Server ---
const server = app.listen(config.port, () => {
  console.log(` Backend server running on port ${config.port} in ${config.nodeEnv} mode`);
});

// --- Process Event Handlers ---
// --- Handle Unhandled Rejections ---
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('UNHANDLED REJECTION!  Shutting down...');
  console.error('Reason:', reason?.stack || reason); // Log the reason/stack
  // In production, log the error to your logging service here
  // Graceful shutdown:
  server.close(() => {
    process.exit(1);
  });
  // Force shutdown if server doesn't close quickly (optional)
  setTimeout(() => process.exit(1), 5000).unref();
});

// --- Handle SIGTERM (e.g., from Docker/Kubernetes) ---
process.on('SIGTERM', () => {
  console.log(' SIGTERM RECEIVED. Shutting down gracefully');
  server.close(() => {
    console.log(' Process terminated!');
    // Prisma disconnect might be needed here if not handled elsewhere
    process.exit(0);
  });
});

export default app;