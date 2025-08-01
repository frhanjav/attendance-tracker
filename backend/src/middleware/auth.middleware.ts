import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UnauthorizedError } from '../core/errors';
import prisma from '../infrastructure/prisma';

export interface AuthenticatedUser {
    id: string;
}

interface JwtPayload {
    id: string;
}

export const protect = async (req: Request, res: Response, next: NextFunction) => {
    let token;

    if (req.cookies?.authToken) {
        token = req.cookies.authToken;
    }

    // Bearer tokens for other clients
    else if (req.headers.authorization?.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return next(new UnauthorizedError('You are not logged in! Please log in to get access.'));
    }

    try {
        const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;

        const currentUser = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, emailVerified: true },
        });

        if (!currentUser) {
            return next(
                new UnauthorizedError('The user belonging to this token no longer exists.'),
            );
        }

        req.user = currentUser;

        console.log('[Protect Middleware] Token verified. Granting access to user:', currentUser.id);
        next();
    } catch (err) {
        console.error('[Protect Middleware] Token verification failed:', err);
        if (err instanceof jwt.JsonWebTokenError) {
            return next(new UnauthorizedError('Invalid token. Please log in again.'));
        }
        if (err instanceof jwt.TokenExpiredError) {
            return next(new UnauthorizedError('Your token has expired! Please log in again.'));
        }
        next(err);
    }
};

export const restrictTo = (...roles: string[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return next(new UnauthorizedError('Authentication required.'));
        }

        next();
    };
};
