import { Request, Response, NextFunction } from 'express';
import { userService } from './user.service';

export const userController = {
  async getMe(req: Request, res: Response, next: NextFunction): Promise<void>  {
      try {
          // req.user is attached by the 'protect' middleware
          if (!req.user) {
              // This check is technically redundant if 'protect' is always used before this controller
              res.status(401).json({ status: 'fail', message: 'Not authenticated' });
              return;
          }
          const userProfile = await userService.getUserProfile(req.user.id);
          res.status(200).json({
              status: 'success',
              data: { user: userProfile },
          });
      } catch (error) {
          next(error);
      }
  }
};