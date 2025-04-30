import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config';
import apiRouter from './routes';
import { errorHandler } from './middleware/error.middleware';
import { AppError, NotFoundError } from './core/errors';

const app: Express = express();

// --- Global Middleware ---

// Enable CORS
app.use(cors({
  origin: config.frontendUrl, // Restrict to frontend URL in production
  credentials: true, // If you use cookies or authorization headers
}));

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' })); // Limit request body size
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// --- Routes ---
app.use('/api/v1', apiRouter); // Prefix all API routes

// --- Handle Not Found Routes ---
app.all('*', (req: Request, res: Response, next: NextFunction) => {
  next(new NotFoundError(`Can't find ${req.originalUrl} on this server!`));
});

// --- Global Error Handling Middleware ---
// This middleware should be the last piece of middleware added
// app.use(errorHandler);


// --- Start Server ---
const server = app.listen(config.port, () => {
  console.log(`✅ Backend server running on port ${config.port} in ${config.nodeEnv} mode`);
});

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