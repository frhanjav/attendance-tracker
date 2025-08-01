import { Request, Response, NextFunction } from 'express';
import { userService } from './user.service';
import { AuthenticatedUser } from '../../middleware/auth.middleware';
import { UnauthorizedError } from '../../core/errors';

export const userController = {
    async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            console.log('Executing /users/me route handler');
            const authenticatedUser = req.user as AuthenticatedUser;

            if (!authenticatedUser?.id) {
                console.error(
                    'Error in getMe: req.user or req.user.id is missing after protect middleware.',
                );
                return next(new UnauthorizedError('Authentication data missing.'));
            }

            const userProfile = await userService.getUserProfile(authenticatedUser.id);

            res.status(200).json({
                status: 'success',
                data: { user: userProfile },
            });
        } catch (error) {
            next(error);
        }
    },
};
