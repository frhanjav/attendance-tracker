import { streamRepository, StreamWithDetailsAndTimetables, StreamMemberWithSelectedUser } from './stream.repository';
import { CreateStreamInput, JoinStreamInput, StreamBasicOutput, StreamDetailedOutput, StreamMemberOutput } from './stream.dto';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../core/errors';
import { UserOutput } from '../user/user.dto'; // Assuming UserOutput type exists


// --- Update StreamDetailedOutput DTO ---

// Helper to map Prisma Stream to StreamBasicOutput DTO
const mapStreamToBasicOutput = (stream: any): StreamBasicOutput => ({
    id: stream.id,
    name: stream.name,
    streamCode: stream.streamCode,
    ownerId: stream.ownerId,
});

// Helper to map Prisma StreamMembership to StreamMemberOutput DTO
const mapMembershipToOutput = (membership: any): StreamMemberOutput => ({
    userId: membership.userId,
    streamId: membership.streamId,
    role: membership.role,
    joinedAt: membership.joinedAt, // Keep as Date for now, will be stringified later if needed
    user: { // Map nested user safely
        id: membership.user.id,
        name: membership.user.name ?? null, // Handle potential null name from DB/select
        email: membership.user.email,
    }
});

// --- Service Object ---
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
        return mapStreamToBasicOutput(stream); // Return basic info of the joined stream
    },

    async getMyStreams(userId: string): Promise<StreamBasicOutput[]> {
        const memberships = await streamRepository.findStreamsByUserId(userId);
        // Extract and map the stream object from each membership
        return memberships.map(m => mapStreamToBasicOutput(m.stream));
    },

    // Adjust StreamDetailedOutput DTO to include optional streamStartDate: string (ISO)
    // --- Updated getStreamDetails ---

    async getStreamDetails(streamId: string, userId: string): Promise<StreamDetailedOutput> {
        await this.ensureMemberAccess(streamId, userId);
        const stream = await streamRepository.findById(streamId); // Fetches StreamWithDetailsAndTimetables

        if (!stream) {
            throw new NotFoundError('Stream not found');
        }

        let earliestValidFrom: Date | null = null;
        if (stream.timetables && stream.timetables.length > 0 && stream.timetables[0].validFrom) {
            earliestValidFrom = stream.timetables[0].validFrom;
        }

        // Construct the final object matching StreamDetailedOutput DTO
        const result: StreamDetailedOutput = {
            id: stream.id,
            name: stream.name,
            streamCode: stream.streamCode,
            ownerId: stream.ownerId,
            owner: { // Map owner fields matching OwnerUserSchema (dto)
                id: stream.owner.id,
                name: stream.owner.name ?? null,
                email: stream.owner.email,
            },
            // Map members using the corrected helper
            members: stream.members.map(mapMembershipToOutput),
            streamStartDate: earliestValidFrom ? earliestValidFrom.toISOString() : null,
        };
        return result;
    },
    // --- End Updated getStreamDetails ---

    // Utility function to be used by other services (like Timetable) to check admin rights
    async ensureAdminAccess(streamId: string, userId: string): Promise<void> {
         const isAdmin = await streamRepository.isUserAdmin(userId, streamId);
         if (!isAdmin) {
             throw new ForbiddenError('You must be an admin of this stream to perform this action.');
         }
     },

     // Utility function to ensure user is at least a member
     async ensureMemberAccess(streamId: string, userId: string): Promise<void> {
        const isMember = await streamRepository.isUserMember(userId, streamId);
        if (!isMember) {
            throw new ForbiddenError('You must be a member of this stream to perform this action.');
        }
    },
};