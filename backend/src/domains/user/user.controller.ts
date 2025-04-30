import { Request, Response, NextFunction } from 'express';
import { userService } from './user.service';
import { CreateUserInput, LoginUserInput } from './user.dto';

export const userController = {
  async signup(req: Request<{}, {}, CreateUserInput>, res: Response, next: NextFunction) {
    try {
      const { token, user } = await userService.signup(req.body);
      // Consider setting token in HttpOnly cookie for better security
      res.status(201).json({
        status: 'success',
        data: { token, user },
      });
    } catch (error) {
      next(error); // Pass error to the error handling middleware
    }
  },

  async login(req: Request<{}, {}, LoginUserInput>, res: Response, next: NextFunction) {
    try {
      const { token, user } = await userService.login(req.body);
      res.status(200).json({
        status: 'success',
        data: { token, user },
      });
    } catch (error) {
      next(error);
    }
  },

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