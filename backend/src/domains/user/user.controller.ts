import { Request, Response, NextFunction } from 'express';
import { userService } from './user.service';
import { AuthenticatedUser } from '../../middleware/auth.middleware'; // Import the type
import { UnauthorizedError } from '../../core/errors'; // Import error type

export const userController = {
  async getMe(req: Request, res: Response, next: NextFunction): Promise<void>  {
    try {
        const authenticatedUser = req.user as AuthenticatedUser;

        if (!authenticatedUser?.id) {
            // This indicates a problem with the protect middleware or type setup
            console.error("Error in getMe: req.user or req.user.id is missing after protect middleware.");
            // Use return next() for consistency with error handling flow
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
  }
};