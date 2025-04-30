import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UnauthorizedError } from '../core/errors';
import prisma from '../infrastructure/prisma';

interface JwtPayload {
  id: string;
}

// Extend Express Request type
declare global {
    namespace Express {
        interface Request {
            user?: { id: string }; // Add user property
        }
    }
}


export const protect = async (req: Request, res: Response, next: NextFunction) => {
  let token;

  // 1) Getting token and check if it's there
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }
  // TODO: Add support for token in cookies if preferred

  if (!token) {
    return next(new UnauthorizedError('You are not logged in! Please log in to get access.'));
  }

  try {
    // 2) Verification token
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;

    // 3) Check if user still exists
    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true } // Only select necessary fields
    });

    if (!currentUser) {
      return next(new UnauthorizedError('The user belonging to this token does no longer exist.'));
    }

    // 4) Check if user changed password after the token was issued (Optional but recommended)
    // Add a passwordChangedAt field to User model if implementing this

    // GRANT ACCESS TO PROTECTED ROUTE
    req.user = { id: currentUser.id }; // Attach user ID to the request
    next();
  } catch (err) {
      if (err instanceof jwt.JsonWebTokenError) {
          return next(new UnauthorizedError('Invalid token. Please log in again.'));
      }
      if (err instanceof jwt.TokenExpiredError) {
          return next(new UnauthorizedError('Your token has expired! Please log in again.'));
      }
      // Forward other errors
      next(err);
  }
};

// Optional: Middleware to restrict access based on role
export const restrictTo = (...roles: string[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return next(new UnauthorizedError('Authentication required.'));
        }

        // This requires fetching the user's role, e.g., from StreamMembership
        // Example: Check if user is admin of a specific stream
        // const membership = await prisma.streamMembership.findUnique({
        //     where: { userId_streamId: { userId: req.user.id, streamId: req.params.streamId } }
        // });
        // if (!membership || !roles.includes(membership.role)) {
        //     return next(new ForbiddenError('You do not have permission to perform this action.'));
        // }

        // Simplified version (assuming role is directly on user or fetched differently)
        // Replace with actual role checking logic based on your domain requirements
        // For now, just pass through if authenticated
        // if (!roles.includes('admin')) { // Example check
        //     return next(new ForbiddenError('You do not have permission to perform this action.'));
        // }

        next();
    };
};