import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken'; // Import SignOptions
import { userRepository } from './user.repository';
import { CreateUserInput, LoginUserInput, UserOutput } from './user.dto';
import { config } from '../../config';
import { BadRequestError, UnauthorizedError, AppError } from '../../core/errors';
import { User } from '@prisma/client';

const generateToken = (userId: string): string => {
  const options: SignOptions = {
    // Use the numeric seconds value
    expiresIn: config.jwtExpiresInSeconds,
  };
  const secret: string = config.jwtSecret;
  return jwt.sign({ id: userId }, secret, options);
};

// Function to map Prisma User to UserOutput DTO
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
  async signup(input: CreateUserInput): Promise<{ token: string; user: UserOutput }> {
    const existingUser = await userRepository.findByEmail(input.email);
    if (existingUser) {
      throw new BadRequestError('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(input.password, config.bcryptSaltRounds);

    const newUser = await userRepository.create({
      email: input.email,
      password: hashedPassword,
      name: input.name || null,
    });

    const token = generateToken(newUser.id);
    return { token, user: mapUserToOutput(newUser) };
  },

  async login(input: LoginUserInput): Promise<{ token: string; user: UserOutput }> {
    const user = await userRepository.findByEmail(input.email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const token = generateToken(user.id);
    return { token, user: mapUserToOutput(user) };
  },

  async getUserProfile(userId: string): Promise<UserOutput | null> {
      const user = await userRepository.findById(userId);
      if (!user) {
          // This case should ideally not happen if called after `protect` middleware
          throw new AppError('User not found', 404);
      }
      return mapUserToOutput(user);
  }
};