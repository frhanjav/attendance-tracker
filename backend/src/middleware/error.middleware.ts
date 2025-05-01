import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken'; // Import jsonwebtoken
import { AppError, BadRequestError, NotFoundError, UnauthorizedError, ForbiddenError } from '../core/errors'; // Import your custom errors
import { config } from '../config';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

const handleZodError = (err: ZodError): AppError => {
  const errors = err.errors.map(el => `${el.path.join('.')}: ${el.message}`).join('. ');
  const message = `Invalid input data. ${errors}`;
  // Use BadRequestError for validation issues
  return new BadRequestError(message);
};

const handlePrismaClientKnownRequestError = (err: Prisma.PrismaClientKnownRequestError): AppError => {
  // Keep existing logic, maybe refine messages or status codes
  switch (err.code) {
      case 'P2002':
          const target = (err.meta?.target as string[])?.join(', ');
          return new BadRequestError(`Duplicate field value: ${target}. Please use another value.`);
      case 'P2025':
          // Prisma's default message for P2025 is often cryptic ("An operation failed..."), override it.
          const model = err.meta?.modelName || 'Resource';
          // const cause = err.meta?.cause || 'required record not found'; // More technical cause
          // return new NotFoundError(`${model} not found. Cause: ${cause}`);
          return new NotFoundError(`${model} not found.`); // Simpler message
      default:
          console.error('Unhandled Prisma Error:', err); // Log unhandled ones
          return new AppError(`Database Error [${err.code}]`, 500, false); // Treat as non-operational
  }
};

// --- NEW: JWT Error Handler ---
const handleJWTError = (err: Error): AppError => {
  if (err instanceof jwt.JsonWebTokenError) {
       return new UnauthorizedError('Invalid token. Please log in again.');
  }
  if (err instanceof jwt.TokenExpiredError) {
       return new UnauthorizedError('Your token has expired! Please log in again.');
  }
  // If it's a JWT-related error but not one of the above, treat as generic unauthorized
  return new UnauthorizedError('Authentication error. Please log in again.');
}
// --- End JWT Error Handler ---


// --- Main Error Handler Middleware ---
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  // Log every error that reaches here
  console.error('ERROR 💥:', err);

  let operationalError: AppError;

  // --- Error Type Conversion ---
  if (err instanceof AppError) {
      operationalError = err; // Already an AppError
  } else if (err instanceof ZodError) {
      operationalError = handleZodError(err);
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
      operationalError = handlePrismaClientKnownRequestError(err);
  } else if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError || err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      // Catch JWT errors specifically (err.name check for safety)
      operationalError = handleJWTError(err);
  }
  // Add more specific error type checks here (e.g., Prisma validation errors P2003, etc.)
  else {
      // --- Generic Error Handling ---
      // Treat unknown errors as internal server errors (non-operational)
      operationalError = new AppError('Something went very wrong!', 500, false);
      // Log the original error for debugging unknown issues
      console.error('UNKNOWN ERROR TYPE:', err);
  }
  // --- End Error Type Conversion ---


  // --- Send Response ---
  // For operational errors (validation, not found, unauthorized, etc.), send specific message
  if (operationalError.isOperational) {
      return res.status(operationalError.statusCode).json({
          status: operationalError.statusCode >= 400 && operationalError.statusCode < 500 ? 'fail' : 'error', // Use 'fail' for 4xx, 'error' for 5xx
          message: operationalError.message,
      });
  }

  // For non-operational/programming errors:
  // In development, send detailed error
  if (config.nodeEnv === 'development') {
      return res.status(operationalError.statusCode).json({
          status: 'error',
          message: operationalError.message, // Or err.message for original
          error: err, // Send full error object
          stack: err.stack, // Send stack trace
      });
  }

  // In production, send generic message for non-operational errors
  // We already logged the detailed error above
  return res.status(500).json({
      status: 'error',
      message: 'Something went very wrong!',
  });
  // --- End Send Response ---
};