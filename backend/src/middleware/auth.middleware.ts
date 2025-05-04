import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UnauthorizedError } from '../core/errors';
import prisma from '../infrastructure/prisma';
import { User } from '@prisma/client'; // Import the full User type

// Define a minimal type for what 'protect' middleware guarantees on req.user
export interface AuthenticatedUser {
    id: string;
    // Add other fields if your protect middleware attaches them and you need them
    // emailVerified?: boolean;
}

interface JwtPayload {
    id: string;
}

export const protect = async (req: Request, res: Response, next: NextFunction) => {
    let token;

    console.log('[Protect Middleware] Starting token verification...');

    // --- Strategy 1: Check for JWT in HttpOnly Cookie ---
    if (req.cookies?.authToken) {
        token = req.cookies.authToken;
        console.log('[Protect Middleware] Found token in cookie.'); // Optional log
    }

    // --- Strategy 2: Fallback to Authorization Header (Optional) ---
    // Keep this if you want to support Bearer tokens for other clients (e.g., mobile app)
    else if (req.headers.authorization?.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
        console.log('[Protect Middleware] Found token in Authorization header.'); // Optional log
    }

    if (!token) {
        console.log('[Protect Middleware] No token found.'); // Optional log
        return next(new UnauthorizedError('You are not logged in! Please log in to get access.'));
    }

    try {
        // Verify token using the JWT secret
        const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;

        // Check if user still exists (minimal check)
        // Consider selecting more fields if needed downstream, or fetching full user later
        const currentUser = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, emailVerified: true }, // Check if email is verified too
        });

        if (!currentUser) {
            return next(
                new UnauthorizedError('The user belonging to this token no longer exists.'),
            );
        }

        // --- Optional: Check if email is verified ---
        // If using email verification, enforce it here for API access
        // if (!currentUser.emailVerified) {
        //   return next(new UnauthorizedError('Please verify your email address to access this resource.'));
        // }

        // Attach user ID to request object
        req.user = currentUser;

        console.log('[Protect Middleware] Token verified. Granting access to user:', currentUser.id);
        next(); // Grant access
    } catch (err) {
        console.error('[Protect Middleware] Token verification failed:', err); // Log error
        if (err instanceof jwt.JsonWebTokenError) {
            return next(new UnauthorizedError('Invalid token. Please log in again.'));
        }
        if (err instanceof jwt.TokenExpiredError) {
            return next(new UnauthorizedError('Your token has expired! Please log in again.'));
        }
        // Forward other unexpected errors
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
