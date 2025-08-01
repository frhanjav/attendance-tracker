import jwt, { SignOptions } from 'jsonwebtoken';
import { userRepository } from './user.repository';
import { UserOutput } from './user.dto';
import { config } from '../../config';
import { AppError } from '../../core/errors';
import { User } from '@prisma/client';

const generateToken = (userId: string): string => {
  const options: SignOptions = {
    expiresIn: config.jwtExpiresInSeconds,
  };
  const secret: string = config.jwtSecret;
  return jwt.sign({ id: userId }, secret, options);
};

const mapUserToOutput = (user: User): UserOutput => {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };
};


export const userService = {
  async getUserProfile(userId: string): Promise<UserOutput | null> {
      const user = await userRepository.findById(userId);
      if (!user) {
          throw new AppError('User not found', 404);
      }
      return mapUserToOutput(user);
  }
};