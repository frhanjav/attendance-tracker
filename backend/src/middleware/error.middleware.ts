import { Request, Response, NextFunction } from 'express';
import { AppError } from '../core/errors';
import { config } from '../config';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

const handleZodError = (err: ZodError): AppError => {
    const errors = err.errors.map(el => `${el.path.join('.')}: ${el.message}`).join('. ');
    const message = `Invalid input data. ${errors}`;
    return new AppError(message, 400);
};

const handlePrismaClientKnownRequestError = (err: Prisma.PrismaClientKnownRequestError): AppError => {
    let message = 'Database error';
    let statusCode = 500;

    switch (err.code) {
        case 'P2002': // Unique constraint violation
            const target = (err.meta?.target as string[])?.join(', ');
            message = `Duplicate field value: ${target}. Please use another value.`;
            statusCode = 400;
            break;
        case 'P2025': // Record not found
            message = 'Resource not found.';
            // message = err.meta?.cause as string || 'Resource not found.'; // More specific message
            statusCode = 404;
            break;
        // Add more specific Prisma error codes as needed
        default:
            message = `Database Error: Code ${err.code}`;
            statusCode = 500; // Or 400 depending on the error
    }
    console.error('Prisma Error:', err); // Log the original error
    return new AppError(message, statusCode);
};


export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('ERROR 💥', err); // Log the error

  let error = err;

  // Convert specific errors to AppError
  if (error instanceof ZodError) {
      error = handleZodError(error);
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      error = handlePrismaClientKnownRequestError(error);
  }
  // Add handlers for other error types (e.g., JWT errors) here

  if (error instanceof AppError) {
    // Operational, trusted error: send message to client
    if (error.isOperational) {
      return res.status(error.statusCode).json({
        status: 'error',
        message: error.message,
      });
    } else {
      // Programming or other unknown error: don't leak error details
      // Log error
      console.error('PROGRAMMING ERROR 💥', error);
      // Send generic message
      return res.status(500).json({
        status: 'error',
        message: 'Something went very wrong!',
      });
    }
  }

  // Handle generic errors or errors not converted to AppError
  const statusCode = (error as any).statusCode || 500;
  const message = (error as any).message || 'Internal Server Error';

  // Send generic message in production for non-AppErrors
  if (config.nodeEnv === 'production' && !(error instanceof AppError && error.isOperational)) {
      return res.status(500).json({
          status: 'error',
          message: 'Something went very wrong!',
      });
  }

  // Send detailed error in development
  return res.status(statusCode).json({
    status: 'error',
    message: message,
    ...(config.nodeEnv === 'development' && { stack: error.stack }), // Only show stack in dev
  });
};