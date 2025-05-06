import apiClient from '../lib/apiClient';

// Define types for Stream data (match backend DTOs)
// Example - adjust based on your actual StreamBasicOutput DTO
export interface StreamBasic {
    id: string;
    name: string;
    streamCode: string;
    ownerId: string;
}

// Example - adjust based on your actual StreamDetailedOutput DTO
export interface StreamDetailed extends StreamBasic {
     owner: { id: string; name: string | null; email: string; };
     members: Array<{
         userId: string;
         streamId: string;
         role: string;
         joinedAt: Date; // Or string if not parsed
         user: { id: string; name: string | null; email: string; };
     }>;
     streamStartDate: string | null; // Add this field (ISO string)
}

// Define input types
interface CreateStreamInput {
    name: string;
}

interface JoinStreamInput {
    streamCode: string;
}

// Define API response structures (match your backend)
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


// --- DEFINE AND EXPORT the service object ---
export const streamService = {
    // Function to get streams for the logged-in user
    getMyStreams: async (): Promise<StreamBasic[]> => {
        try {
            const response = await apiClient.get<StreamListResponse>('/streams');
            return response.data.data.streams;
        } catch (error: any) {
            console.error("Error fetching streams:", error);
            throw new Error(error.message || 'Failed to fetch streams');
        }
    },

    // Function to get details for a specific stream
    getStreamDetails: async (streamId: string): Promise<StreamDetailed> => {
         try {
            const response = await apiClient.get<StreamDetailResponse>(`/streams/${streamId}`);
            return response.data.data.stream;
        } catch (error: any) {
            console.error(`Error fetching stream ${streamId}:`, error);
            throw new Error(error.message || 'Failed to fetch stream details');
        }
    },

    // Function to create a new stream
    createStream: async (data: CreateStreamInput): Promise<StreamBasic> => {
         try {
            const response = await apiClient.post<StreamCreateResponse>('/streams', data);
            return response.data.data.stream;
        } catch (error: any) {
            console.error("Error creating stream:", error);
            throw new Error(error.message || 'Failed to create stream');
        }
    },

     // Function to join an existing stream
    joinStream: async (data: JoinStreamInput): Promise<StreamBasic> => {
         try {
            const response = await apiClient.post<StreamJoinResponse>('/streams/join', data);
            return response.data.data.stream;
        } catch (error: any) {
            console.error("Error joining stream:", error);
            throw new Error(error.message || 'Failed to join stream');
        }
    },

    // Add other stream-related API functions here (update, manage members, etc.)
};

// Ensure there are no other 'export default' statements if you use named exports