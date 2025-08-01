import apiClient from '../lib/apiClient';

export interface StreamBasic {
    id: string;
    name: string;
    streamCode: string;
    ownerId: string;
    isArchived: boolean;
}

export interface StreamDetailed extends StreamBasic {
     owner: { id: string; name: string | null; email: string; };
     members: Array<{
         userId: string;
         streamId: string;
         role: string;
         joinedAt: Date;
         user: { id: string; name: string | null; email: string; };
     }>;
     streamStartDate: string | null;
}

interface CreateStreamInput {
    name: string;
}

interface JoinStreamInput {
    streamCode: string;
}

interface StreamListResponse {
    status: string;
    results: number;
    data: { streams: StreamBasic[] };
}
interface StreamDetailResponse {
    status: string;
    data: { stream: StreamDetailed };
}
 interface StreamCreateResponse {
    status: string;
    data: { stream: StreamBasic };
}
 interface StreamJoinResponse {
    status: string;
    data: { stream: StreamBasic };
}


export const streamService = {
    getMyStreams: async (includeArchived: boolean = false): Promise<StreamBasic[]> => {
        try {
            const response = await apiClient.get<StreamListResponse>('/streams', {
                params: { includeArchived }
            });
            return response.data.data.streams;
        } catch (error: any) {
            console.error("Error fetching streams:", error);
            throw new Error(error.message || 'Failed to fetch streams');
        }
    },

    leaveStream: async (streamId: string): Promise<{ message: string }> => {
        try {
            const response = await apiClient.post<{ status: string, data: { message: string } }>(`/streams/${streamId}/leave`);
            return response.data.data;
        } catch (error: any) { throw new Error(error.message || 'Failed to leave stream'); }
    },

    archiveStream: async (streamId: string): Promise<StreamBasic> => {
        try {
            const response = await apiClient.post<{ status: string, data: { stream: StreamBasic } }>(`/streams/${streamId}/archive`);
            return response.data.data.stream;
        } catch (error: any) { throw new Error(error.message || 'Failed to archive stream'); }
    },

    unarchiveStream: async (streamId: string): Promise<StreamBasic> => {
        try {
            const response = await apiClient.post<{ status: string, data: { stream: StreamBasic } }>(`/streams/${streamId}/unarchive`);
            return response.data.data.stream;
        } catch (error: any) { throw new Error(error.message || 'Failed to unarchive stream'); }
    },

    getStreamDetails: async (streamId: string): Promise<StreamDetailed> => {
         try {
            const response = await apiClient.get<StreamDetailResponse>(`/streams/${streamId}`);
            return response.data.data.stream;
        } catch (error: any) {
            console.error(`Error fetching stream ${streamId}:`, error);
            throw new Error(error.message || 'Failed to fetch stream details');
        }
    },

    createStream: async (data: CreateStreamInput): Promise<StreamBasic> => {
         try {
            const response = await apiClient.post<StreamCreateResponse>('/streams', data);
            return response.data.data.stream;
        } catch (error: any) {
            console.error("Error creating stream:", error);
            throw new Error(error.message || 'Failed to create stream');
        }
    },

    joinStream: async (data: JoinStreamInput): Promise<StreamBasic> => {
         try {
            const response = await apiClient.post<StreamJoinResponse>('/streams/join', data);
            return response.data.data.stream;
        } catch (error: any) {
            console.error("Error joining stream:", error);
            throw new Error(error.message || 'Failed to join stream');
        }
    },

};