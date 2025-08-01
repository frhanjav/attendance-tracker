import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().cuid(),
  email: z.string().email(),
  password: z.string(),
  name: z.string().optional().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const UserOutputSchema = UserSchema.omit({ password: true });
export type UserOutput = z.infer<typeof UserOutputSchema>;

export const AuthOutputSchema = z.object({
    token: z.string(),
    user: UserOutputSchema,
});
export type AuthOutput = z.infer<typeof AuthOutputSchema>;