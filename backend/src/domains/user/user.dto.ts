import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().cuid(),
  email: z.string().email(),
  // IMPORTANT: Define password here if it's part of the base schema before omitting
  password: z.string(),
  name: z.string().optional().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateUserSchema = z.object({
  body: z.object({
    email: z.string().email({ message: 'Invalid email address' }),
    password: z.string().min(8, { message: 'Password must be at least 8 characters long' }),
    name: z.string().min(1, { message: 'Name is required' }).optional(),
  }),
});
export type CreateUserInput = z.infer<typeof CreateUserSchema>['body'];

export const LoginUserSchema = z.object({
    body: z.object({
        email: z.string().email({ message: 'Invalid email address' }),
        password: z.string().min(1, { message: 'Password is required' }),
    }),
});
export type LoginUserInput = z.infer<typeof LoginUserSchema>['body'];

// Output DTOs (excluding sensitive data like password)
export const UserOutputSchema = UserSchema.omit({ password: true });
export type UserOutput = z.infer<typeof UserOutputSchema>;

export const AuthOutputSchema = z.object({
    token: z.string(),
    user: UserOutputSchema,
});
export type AuthOutput = z.infer<typeof AuthOutputSchema>;