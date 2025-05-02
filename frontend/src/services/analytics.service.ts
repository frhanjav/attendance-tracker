import apiClient from '../lib/apiClient';

// --- Define Types (Match Backend DTOs) ---

// Matches SubjectStatsOutput DTO
export interface SubjectStats {
    subjectName: string;
    courseCode: string | null;
    totalScheduled: number;
    totalMarked: number;
    totalHeldClasses: number;
    attended: number;
    attendancePercentage: number | null;
}

// Matches StreamAnalyticsOutput DTO (dates as strings from API)
export interface StreamAnalyticsData {
    streamId: string;
    userId: string;
    startDate: string; // ISO String
    endDate: string; // ISO String
    overallAttendancePercentage: number | null;
    totalAttendedClasses: number;
    totalHeldClasses: number;
    subjectStats: SubjectStats[];
}

// Input for calculator (Matches AttendanceCalculatorInput DTO)
export interface AttendanceCalculatorInput {
    streamId: string;
    targetPercentage: number;
    targetDate: string; // YYYY-MM-DD
    subjectName?: string;
    // --- ADD Optional Fields ---
    currentAttendedInput?: number;
    currentHeldInput?: number;
    // --- End Add ---
}

// Output from calculator (Matches AttendanceProjectionOutput DTO)
export interface AttendanceProjection {
    currentAttended: number;
    currentHeld: number;
    currentPercentage: number | null;
    futureHeld: number;
    targetPercentage: number;
    neededToAttend: number;
    canSkip: number;
    message: string;
}

// API Response Types
interface AnalyticsResponse {
    status: string;
    data: { stats: StreamAnalyticsData }; // Matches backend structure
}

interface CalculatorResponse {
    status: string;
    data: { projection: AttendanceProjection }; // Matches backend structure
}

// --- Service Functions ---
export const analyticsService = {
    /**
     * Fetches stream attendance statistics.
     * Can add optional userId, startDate, endDate params if backend supports them.
     */
    getStreamAnalytics: async (streamId: string): Promise<StreamAnalyticsData> => {
        // --- Add Log Immediately ---
        console.log(`[Analytics Service] START Fetching analytics for stream: ${streamId}`);
        if (!streamId) {
            // Add a guard just in case
            console.error('[Analytics Service] Attempted fetch with invalid streamId:', streamId);
            throw new Error('Invalid Stream ID provided for analytics fetch.');
        }
        // --------------------------
        try {
            const endpoint = `/analytics/streams/${streamId}`;
            console.log(`[Analytics Service] Calling apiClient.get for endpoint: ${endpoint}`); // Log endpoint

            // --- The await call might be hanging ---
            const response = await apiClient.get<AnalyticsResponse>(endpoint);
            // ---------------------------------------

            // --- If execution reaches here, the API call returned ---
            console.log('[Analytics Service] API Response RECEIVED:', response); // Log the whole response object
            console.log('[Analytics Service] API Response Data:', response.data); // Log just the data part

            // Check structure carefully
            if (response.data?.status !== 'success' || !response.data?.data?.stats) {
                console.error('[Analytics Service] Invalid API response structure:', response.data);
                throw new Error('Invalid API response structure for analytics data.');
            }

            console.log('[Analytics Service] Returning stats:', response.data.data.stats);
            return response.data.data.stats;
        } catch (error: any) {
            // --- Log if an error is caught ---
            console.error(
                `[Analytics Service] CATCH block - Error fetching analytics for stream ${streamId}:`,
                error,
            );
            // Log specific parts of the error if available (Axios errors often have response/request)
            if (error.response) {
                console.error('[Analytics Service] Error Response:', error.response.data);
                console.error('[Analytics Service] Error Status:', error.response.status);
                console.error('[Analytics Service] Error Headers:', error.response.headers);
            } else if (error.request) {
                console.error('[Analytics Service] Error Request:', error.request);
            } else {
                console.error('[Analytics Service] Error Message:', error.message);
            }
            // Rethrow the specific message if possible
            throw new Error(
                error.response?.data?.message || error.message || 'Failed to fetch analytics',
            );
        } finally {
            // --- Add Log to see if function completes ---
            console.log(`[Analytics Service] END Fetching analytics for stream: ${streamId}`);
        }
    },

    /**
     * Calculates attendance projection.
     */
    calculateProjection: async (
        input: AttendanceCalculatorInput,
    ): Promise<AttendanceProjection> => {
        try {
            const response = await apiClient.post<CalculatorResponse>(
                '/analytics/calculator',
                input,
            );
            if (response.data?.status !== 'success' || !response.data?.data?.projection) {
                throw new Error('Invalid API response structure for calculator.');
            }
            return response.data.data.projection;
        } catch (error: any) {
            console.error('Error calculating projection:', error);
            throw new Error(error.message || 'Failed to calculate projection');
        }
    },
};
