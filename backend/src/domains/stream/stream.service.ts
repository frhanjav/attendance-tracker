import { streamRepository, StreamMemberWithSelectedUser } from './stream.repository';
import { CreateStreamInput, JoinStreamInput, StreamBasicOutput, StreamDetailedOutput, StreamMemberOutput } from './stream.dto';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../core/errors';
import { Stream } from '@prisma/client';

const mapStreamToBasicOutput = (stream: Stream): StreamBasicOutput => ({
    id: stream.id,
    name: stream.name,
    streamCode: stream.streamCode,
    ownerId: stream.ownerId,
    isArchived: stream.isArchived,
});

const mapMembershipToOutput = (membership: StreamMemberWithSelectedUser): StreamMemberOutput => ({
    userId: membership.userId,
    streamId: membership.streamId,
    role: membership.role,
    joinedAt: membership.joinedAt,
    user: {
        id: membership.user.id,
        name: membership.user.name ?? null,
        email: membership.user.email,
    }
});

export const streamService = {
    async createStream(input: CreateStreamInput, ownerId: string): Promise<StreamBasicOutput> {
        const newStream = await streamRepository.create(input.name, ownerId);
        return mapStreamToBasicOutput(newStream);
    },

    async joinStream(input: JoinStreamInput, userId: string): Promise<StreamBasicOutput> {
        const stream = await streamRepository.findByCode(input.streamCode);
        if (!stream) {
            throw new NotFoundError('Stream not found with the provided code');
        }

        const existingMembership = await streamRepository.findMembership(userId, stream.id);
        if (existingMembership) {
            throw new BadRequestError('You are already a member of this stream');
        }

        await streamRepository.addMember(userId, stream.id);
        return mapStreamToBasicOutput(stream);
    },

    async getMyStreams(userId: string, includeArchived: boolean = false): Promise<StreamBasicOutput[]> {
        const memberships = await streamRepository.findStreamsByUserId(userId, includeArchived);
        return memberships.map(m => mapStreamToBasicOutput(m.stream));
    },

    async getStreamDetails(streamId: string, userId: string): Promise<StreamDetailedOutput> {
        await this.ensureMemberAccess(streamId, userId);
        const stream = await streamRepository.findById(streamId);
        if (!stream) throw new NotFoundError('Stream not found');

        let earliestValidFrom: Date | null = null;
        if (stream.timetables && stream.timetables.length > 0 && stream.timetables[0].validFrom) {
            earliestValidFrom = stream.timetables[0].validFrom;
        }

        const result: StreamDetailedOutput = {
            id: stream.id, name: stream.name, streamCode: stream.streamCode, ownerId: stream.ownerId,
            isArchived: stream.isArchived,
            owner: { id: stream.owner.id, name: stream.owner.name ?? null, email: stream.owner.email },
            members: stream.members.map(mapMembershipToOutput),
            streamStartDate: earliestValidFrom ? earliestValidFrom.toISOString() : null,
        };
        return result;
    },

    async leaveStream(streamId: string, userId: string): Promise<{ message: string }> {
        const stream = await streamRepository.findById(streamId);
        if (!stream) {
            throw new NotFoundError("Stream not found.");
        }
        if (stream.ownerId === userId) {
            throw new ForbiddenError("Stream owner cannot leave the stream. You can archive or delete it instead.");
        }

        const membership = await streamRepository.removeMember(userId, streamId);
        if (!membership) {
            throw new NotFoundError("You are not a member of this stream or have already left.");
        }
        return { message: "Successfully left the stream." };
    },

    async archiveStream(streamId: string, ownerId: string): Promise<StreamBasicOutput> {
        const updatedStream = await streamRepository.setArchiveStatus(streamId, ownerId, true);
        if (!updatedStream) {
            throw new ForbiddenError("Stream not found or you are not the owner.");
        }
        return mapStreamToBasicOutput(updatedStream);
    },

    async unarchiveStream(streamId: string, ownerId: string): Promise<StreamBasicOutput> {
        const updatedStream = await streamRepository.setArchiveStatus(streamId, ownerId, false);
        if (!updatedStream) {
            throw new ForbiddenError("Stream not found or you are not the owner.");
        }
        return mapStreamToBasicOutput(updatedStream);
    },

    async getStreamMembers(streamId: string): Promise<StreamMemberOutput[]> {
        const members = await streamRepository.findStreamMembers(streamId);
        return members.map(mapMembershipToOutput);
    },

    async getStreamMemberUserIds(streamId: string): Promise<string[]> {
        return streamRepository.findStreamMemberUserIds(streamId);
    },

    async ensureAdminAccess(streamId: string, userId: string): Promise<void> {
         const isAdmin = await streamRepository.isUserAdmin(userId, streamId);
         if (!isAdmin) {
             throw new ForbiddenError('You must be an admin of this stream to perform this action.');
         }
     },

     async ensureMemberAccess(streamId: string, userId: string): Promise<void> {
        const isMember = await streamRepository.isUserMember(userId, streamId);
        if (!isMember) {
            throw new ForbiddenError('You must be a member of this stream to perform this action.');
        }
    },
};