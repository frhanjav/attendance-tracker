import prisma from '../../infrastructure/prisma';
import { Prisma, Stream, StreamMembership, User, Timetable } from '@prisma/client';

type SelectedUser = {
    id: string;
    email: string;
    name: string | null;
    createdAt: Date;
    updatedAt: Date;
};

type MembershipWithSelectedUser = StreamMembership & {
    user: SelectedUser;
};

export type StreamWithDetailsAndTimetables = Stream & {
    owner: User;
    members: MembershipWithSelectedUser[];
    timetables: Pick<Timetable, 'validFrom'>[];
};

export type StreamMemberWithSelectedUser = MembershipWithSelectedUser;

export const streamRepository = {
    async create(name: string, ownerId: string): Promise<Stream> {
        return prisma.stream.create({
            data: {
                name,
                ownerId,
                members: {
                    create: {
                        userId: ownerId,
                        role: 'admin',
                    },
                },
            },
        });
    },

    async findById(streamId: string): Promise<StreamWithDetailsAndTimetables | null> {
        const result = await prisma.stream.findUnique({
            where: { id: streamId },
            include: {
                owner: true,
                members: {
                    include: {
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
                        joinedAt: 'asc',
                    },
                },
                timetables: {
                    select: {
                        validFrom: true,
                    },
                    orderBy: {
                        validFrom: 'asc',
                    },
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
        const streamFilter: Prisma.StreamWhereInput = {};

        if (includeArchived) {
            streamFilter.isArchived = true;
        } else {
            streamFilter.isArchived = false;
        }
    
        return prisma.streamMembership.findMany({
            where: {
                userId,
                stream: streamFilter,
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
                    select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
                },
            },
            orderBy: { joinedAt: 'asc' },
        });
        return result as StreamMemberWithSelectedUser[];
    },

    async findStreamMemberUserIds(streamId: string): Promise<string[]> {
        const members = await prisma.streamMembership.findMany({
            where: { streamId },
            select: { userId: true },
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
            select: { role: true },
        });
        return membership?.role === 'admin';
    },
};
