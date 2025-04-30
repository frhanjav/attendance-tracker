import prisma from '../../infrastructure/prisma';
import { User } from '@prisma/client'; // Import generated Prisma types

export const userRepository = {
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  },

  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  },

  async create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    return prisma.user.create({ data });
  },

  // Add other methods as needed (update, delete, etc.)
};