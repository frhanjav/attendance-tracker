import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from './config/passport'; // Import configured passport
import cookieParser from 'cookie-parser'; // Import cookie-parser
import { config } from './config';
import apiRouter from './routes'; // Your main API router
import { errorHandler } from './middleware/error.middleware';
import { AppError, NotFoundError } from './core/errors'; // Assuming AppError exists

// Install: npm install express-session @types/express-session cookie-parser @types/cookie-parser
// Optional production session store: npm install connect-pg-simple

const app: Express = express();

// --- Trust Proxy (Important if behind Nginx/Load Balancer for secure cookies) ---
// If your app runs behind a proxy (like in K8s with Ingress), set this.
// The number '1' means it trusts the first hop (e.g., the load balancer).
if (config.nodeEnv === 'production') {
    app.set('trust proxy', 1);
}

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
app.use('/api/v1', apiRouter); // Mount API routes AFTER middleware

// --- Handle Not Found API Routes ---
// This catches requests to /api/v1/... that don't match any defined API route
app.all('/api/v1/*', (req: Request, res: Response, next: NextFunction) => {
  next(new NotFoundError(`API route not found: ${req.originalUrl}`));
});

// --- Handle Not Found for Non-API Routes (Optional - if backend serves frontend) ---
// If your backend *doesn't* serve the frontend static files (frontend runs separately),
// you might not need this specific catch-all here. The frontend router handles its 404s.
// app.all('*', (req: Request, res: Response, next: NextFunction) => {
//   next(new NotFoundError(`Resource not found: ${req.originalUrl}`));
// });

// --- Global Error Handling Middleware ---
// Must be the LAST middleware added
app.use(errorHandler);


// --- Start Server ---
const server = app.listen(config.port, () => {
  console.log(`✅ Backend server running on port ${config.port} in ${config.nodeEnv} mode`);
});

// --- Process Event Handlers ---
// --- Handle Unhandled Rejections ---
process.on('unhandledRejection', (err: Error) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  server.close(() => {
    process.exit(1); // Exit process after server closes
  });
});

// --- Handle SIGTERM (e.g., from Docker/Kubernetes) ---
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
  server.close(() => {
    console.log('💥 Process terminated!');
    // Prisma disconnect might be needed here if not handled elsewhere
    process.exit(0);
  });
});

export default app; // Export for testing or other purposes