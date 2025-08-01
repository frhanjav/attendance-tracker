import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError, BadRequestError, NotFoundError, UnauthorizedError } from '../core/errors';
import { config } from '../config';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

const handleZodError = (err: ZodError): AppError => {
  const errors = err.errors.map(el => `${el.path.join('.')}: ${el.message}`).join('. ');
  const message = `Invalid input data. ${errors}`;
  return new BadRequestError(message);
};

const handlePrismaClientKnownRequestError = (err: Prisma.PrismaClientKnownRequestError): AppError => {
  switch (err.code) {
      case 'P2002':
          const target = (err.meta?.target as string[])?.join(', ');
          return new BadRequestError(`Duplicate field value: ${target}. Please use another value.`);
      case 'P2025':
          const model = err.meta?.modelName || 'Resource';
          return new NotFoundError(`${model} not found.`);
      default:
          console.error('Unhandled Prisma Error:', err);
          return new AppError(`Database Error [${err.code}]`, 500, false);
  }
};

const handleJWTError = (err: Error): AppError => {
  if (err instanceof jwt.JsonWebTokenError) {
       return new UnauthorizedError('Invalid token. Please log in again.');
  }
  if (err instanceof jwt.TokenExpiredError) {
       return new UnauthorizedError('Your token has expired! Please log in again.');
  }
  return new UnauthorizedError('Authentication error. Please log in again.');
}

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('ERROR 💥:', err);

  let operationalError: AppError;

  if (err instanceof AppError) {
      operationalError = err;
  } else if (err instanceof ZodError) {
      operationalError = handleZodError(err);
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
      operationalError = handlePrismaClientKnownRequestError(err);
  } else if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError || err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      operationalError = handleJWTError(err);
  }
  else {
      operationalError = new AppError('Something went very wrong!', 500, false);
      console.error('UNKNOWN ERROR TYPE:', err);
  }

  if (operationalError.isOperational) {
      return res.status(operationalError.statusCode).json({
          status: operationalError.statusCode >= 400 && operationalError.statusCode < 500 ? 'fail' : 'error',
          message: operationalError.message,
      });
  }

  if (config.nodeEnv === 'development') {
      return res.status(operationalError.statusCode).json({
          status: 'error',
          message: operationalError.message,
          error: err,
          stack: err.stack,
      });
  }

  return res.status(500).json({
      status: 'error',
      message: 'Something went very wrong!',
  });
};