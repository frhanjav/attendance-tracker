import { z } from 'zod';

export const StreamSchema = z.object({
    id: z.string().cuid(),
    name: z.string().min(1),
    streamCode: z.string().cuid(),
    ownerId: z.string().cuid(),
    createdAt: z.date(),
    updatedAt: z.date(),
    isArchived: z.boolean(),
});

export const CreateStreamSchema = z.object({
    body: z.object({
        name: z.string().min(3, { message: 'Stream name must be at least 3 characters long' }),
    }),
});
export type CreateStreamInput = z.infer<typeof CreateStreamSchema>['body'];

export const JoinStreamSchema = z.object({
    body: z.object({
        streamCode: z.string().min(1, { message: 'Stream code is required' }),
    }),
});
export type JoinStreamInput = z.infer<typeof JoinStreamSchema>['body'];

export const StreamBasicOutputSchema = StreamSchema.pick({
    id: true,
    name: true,
    streamCode: true,
    ownerId: true,
    isArchived: true,
});
export type StreamBasicOutput = z.infer<typeof StreamBasicOutputSchema>;

const MemberUserSchema = z.object({
    id: z.string().cuid(),
    name: z.string().nullable(),
    email: z.string().email(),
});

export const StreamMemberSchema = z.object({
    userId: z.string().cuid(),
    streamId: z.string().cuid(),
    role: z.string(),
    joinedAt: z.date(),
    user: MemberUserSchema,
});
export type StreamMemberOutput = z.infer<typeof StreamMemberSchema>;

const OwnerUserSchema = MemberUserSchema;

export const StreamDetailedOutputSchema = StreamBasicOutputSchema.extend({
    owner: OwnerUserSchema,
    members: z.array(StreamMemberSchema),
    streamStartDate: z.string().datetime().nullable(),
});
export type StreamDetailedOutput = z.infer<typeof StreamDetailedOutputSchema>;