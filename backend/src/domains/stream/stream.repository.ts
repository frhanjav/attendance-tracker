import prisma from '../../infrastructure/prisma';
import { Prisma, Stream, StreamMembership, User, Timetable } from '@prisma/client';

// Removed _min Aggregate: We removed the complex _min aggregate from the include block. While powerful, its syntax can be tricky and might not be the most readable way to get the earliest date.

// Define the shape of the user object *as selected* in the includes
type SelectedUser = {
    id: string;
    email: string;
    name: string | null;
    createdAt: Date;
    updatedAt: Date;
    // NO password here
};

// Define the shape of the membership object with the selected user
type MembershipWithSelectedUser = StreamMembership & {
    user: SelectedUser; // Use the selected user type
};

// Define the main repository result type using the specific nested types
export type StreamWithDetailsAndTimetables = Stream & {
    // Owner can be the full User type if not selecting fields for owner
    owner: User;
    // Use the specific membership type for the members array
    members: MembershipWithSelectedUser[];
    timetables: Pick<Timetable, 'validFrom'>[];
};

// Type for findStreamMembers result (can reuse MembershipWithSelectedUser)
export type StreamMemberWithSelectedUser = MembershipWithSelectedUser;

export const streamRepository = {
    async create(name: string, ownerId: string): Promise<Stream> {
        // Prisma handles streamCode generation via @default(cuid())
        return prisma.stream.create({
            data: {
                name,
                ownerId,
                // Add owner as the first member with admin role
                members: {
                    create: {
                        userId: ownerId,
                        role: 'admin',
                    },
                },
            },
        });
    },

    /**
     * Finds a stream by its ID and includes details about the owner, members,
     * and the validFrom date of its associated timetables (ordered by date).
     * The service layer will determine the earliest start date from the timetables array.
     */
    async findById(streamId: string): Promise<StreamWithDetailsAndTimetables | null> {
        const result = await prisma.stream.findUnique({
            where: { id: streamId },
            include: {
                owner: true, // Include owner details
                members: {
                    // Include members and their user details
                    include: {
                        // Select only necessary user fields to avoid exposing password hash etc.
                        user: {
                            select: {
                                id: true,
                                email: true,
                                name: true,
                                createdAt: true,
                                updatedAt: true,
                            },
                        },
                    },
                    orderBy: {
                        // Optional: order members
                        joinedAt: 'asc',
                    },
                },
                timetables: {
                    // Include associated timetables
                    select: {
                        // Select only the validFrom field
                        validFrom: true,
                    },
                    orderBy: {
                        // Order them to easily find the earliest
                        validFrom: 'asc',
                    },
                    // where: { validFrom: { not: null } } // Keep if validFrom is optional, remove if required
                },
            },
        });

        return result as StreamWithDetailsAndTimetables | null;
    },

    async findByCode(streamCode: string): Promise<Stream | null> {
        return prisma.stream.findUnique({
            where: { streamCode },
        });
    },

    async findMembership(userId: string, streamId: string): Promise<StreamMembership | null> {
        return prisma.streamMembership.findUnique({
            where: {
                userId_streamId: { userId, streamId },
            },
        });
    },

    async addMember(
        userId: string,
        streamId: string,
        role: string = 'member',
    ): Promise<StreamMembership> {
        return prisma.streamMembership.create({
            data: {
                userId,
                streamId,
                role,
            },
        });
    },

    async findStreamsByUserId(userId: string, includeArchived: boolean = false): Promise<(StreamMembership & { stream: Stream })[]> {
        const streamFilter: Prisma.StreamWhereInput = {}; // Start with empty filter
        // if (!includeArchived) { // Only add the filter if we DON'T want archived
        //     streamFilter.isArchived = false;
        // }
        if (includeArchived) { // If true, we want ONLY archived
            streamFilter.isArchived = true;
        } else { // If false, we want ONLY active
            streamFilter.isArchived = false;
        }
        // If includeArchived is true, streamFilter remains empty for isArchived, so all are fetched
    
        return prisma.streamMembership.findMany({
            where: {
                userId,
                stream: streamFilter, // Apply the conditional filter here
            },
            include: {
                stream: true,
            },
            orderBy: { stream: { name: 'asc' } }
        });
    },

    async findStreamMembers(streamId: string): Promise<StreamMemberWithSelectedUser[]> {
        const result = await prisma.streamMembership.findMany({
            where: { streamId },
            include: {
                user: {
                    // Select specific user fields
                    select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
                },
            },
            orderBy: { joinedAt: 'asc' },
        });
        // Cast might be needed if TS inference isn't perfect, but ideally select matches the type
        return result as StreamMemberWithSelectedUser[];
    },

    async findStreamMemberUserIds(streamId: string): Promise<string[]> {
        const members = await prisma.streamMembership.findMany({
            where: { streamId },
            select: { userId: true }, // Select only the userId
        });
        return members.map((m) => m.userId);
    },

    async removeMember(userId: string, streamId: string): Promise<StreamMembership | null> {
        try {
            return await prisma.streamMembership.delete({
                where: {
                    userId_streamId: { userId, streamId }
                }
            });
        } catch (error: any) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                return null;
            }
            throw error;
        }
    },

    async setArchiveStatus(streamId: string, ownerId: string, isArchived: boolean): Promise<Stream | null> {
        try {
            return await prisma.stream.update({
                where: {
                    id: streamId,
                    ownerId: ownerId,
                },
                data: {
                    isArchived: isArchived,
                }
            });
        } catch (error: any) {
             if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                return null;
            }
            throw error;
        }
    },

    async isUserMember(userId: string, streamId: string): Promise<boolean> {
        const count = await prisma.streamMembership.count({
            where: { userId, streamId },
        });
        return count > 0;
    },

    async isUserAdmin(userId: string, streamId: string): Promise<boolean> {
        const membership = await prisma.streamMembership.findUnique({
            where: {
                userId_streamId: { userId, streamId },
            },
            select: { role: true }, // Only select role
        });
        return membership?.role === 'admin';
    },
};
