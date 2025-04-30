import { z } from 'zod';
import { UserOutputSchema } from '../user/user.dto'; // Assuming UserOutputSchema is exported

// Base Stream Schema (matches Prisma model structure)
export const StreamSchema = z.object({
    id: z.string().cuid(),
    name: z.string().min(1),
    streamCode: z.string().cuid(),
    ownerId: z.string().cuid(),
    createdAt: z.date(),
    updatedAt: z.date(),
});

// Input for creating a new stream
export const CreateStreamSchema = z.object({
    body: z.object({
        name: z.string().min(3, { message: 'Stream name must be at least 3 characters long' }),
    }),
});
export type CreateStreamInput = z.infer<typeof CreateStreamSchema>['body'];

// Input for joining a stream
export const JoinStreamSchema = z.object({
    body: z.object({
        streamCode: z.string().min(1, { message: 'Stream code is required' }),
    }),
});
export type JoinStreamInput = z.infer<typeof JoinStreamSchema>['body'];

// Output DTO for a single stream (basic info)
export const StreamBasicOutputSchema = StreamSchema.pick({
    id: true,
    name: true,
    streamCode: true, // Include code for sharing
    ownerId: true,
});
export type StreamBasicOutput = z.infer<typeof StreamBasicOutputSchema>;

// Define the shape of the user object expected within StreamMemberSchema AFTER picking
// This avoids relying on UserOutputSchema directly if it causes issues
const MemberUserSchema = z.object({
    id: z.string().cuid(),
    name: z.string().nullable(),
    email: z.string().email(),
});

// Output DTO for stream membership details
export const StreamMemberSchema = z.object({
    userId: z.string().cuid(),
    streamId: z.string().cuid(),
    role: z.string(), // e.g., "admin", "member"
    joinedAt: z.date(), // Keep as Date from Prisma
    user: MemberUserSchema,
});
export type StreamMemberOutput = z.infer<typeof StreamMemberSchema>;

// Define the shape of the owner object expected within StreamDetailedOutputSchema
const OwnerUserSchema = MemberUserSchema; // Can reuse if the shape is the same

// Output DTO for detailed stream view (includes members)
export const StreamDetailedOutputSchema = StreamBasicOutputSchema.extend({
    owner: OwnerUserSchema, // Use the specific schema
    members: z.array(StreamMemberSchema),
    streamStartDate: z.string().datetime().nullable(),
});
export type StreamDetailedOutput = z.infer<typeof StreamDetailedOutputSchema>;