import apiClient from '../lib/apiClient';

export interface SubjectStats {
    subjectName: string;
    courseCode: string | null;
    totalScheduled: number;
    totalMarked: number;
    totalHeldClasses: number;
    attended: number;
    attendancePercentage: number | null;
}

export interface StreamAnalyticsData {
    streamId: string;
    userId: string;
    startDate: string;
    endDate: string;
    overallAttendancePercentage: number | null;
    totalAttendedClasses: number;
    totalHeldClasses: number;
    subjectStats: SubjectStats[];
}

export interface AttendanceCalculatorInput {
    streamId: string;
    targetPercentage: number;
    targetDate: string;
    subjectName?: string;
    currentAttendedInput?: number;
    currentHeldInput?: number;
}

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

interface AnalyticsResponse {
    status: string;
    data: { stats: StreamAnalyticsData };
}

interface CalculatorResponse {
    status: string;
    data: { projection: AttendanceProjection };
}

export const analyticsService = {
    getStreamAnalytics: async (streamId: string): Promise<StreamAnalyticsData> => {
        console.log(`[Analytics Service] START Fetching analytics for stream: ${streamId}`);
        if (!streamId) {
            console.error('[Analytics Service] Attempted fetch with invalid streamId:', streamId);
            throw new Error('Invalid Stream ID provided for analytics fetch.');
        }
        try {
            const endpoint = `/analytics/streams/${streamId}`;
            console.log(`[Analytics Service] Calling apiClient.get for endpoint: ${endpoint}`);

            const response = await apiClient.get<AnalyticsResponse>(endpoint);

            console.log('[Analytics Service] API Response RECEIVED:', response);
            console.log('[Analytics Service] API Response Data:', response.data);

            if (response.data?.status !== 'success' || !response.data?.data?.stats) {
                console.error('[Analytics Service] Invalid API response structure:', response.data);
                throw new Error('Invalid API response structure for analytics data.');
            }

            console.log('[Analytics Service] Returning stats:', response.data.data.stats);
            return response.data.data.stats;
        } catch (error: any) {
            console.error(
                `[Analytics Service] CATCH block - Error fetching analytics for stream ${streamId}:`,
                error,
            );
            if (error.response) {
                console.error('[Analytics Service] Error Response:', error.response.data);
                console.error('[Analytics Service] Error Status:', error.response.status);
                console.error('[Analytics Service] Error Headers:', error.response.headers);
            } else if (error.request) {
                console.error('[Analytics Service] Error Request:', error.request);
            } else {
                console.error('[Analytics Service] Error Message:', error.message);
            }
            throw new Error(
                error.response?.data?.message || error.message || 'Failed to fetch analytics',
            );
        } finally {
            console.log(`[Analytics Service] END Fetching analytics for stream: ${streamId}`);
        }
    },

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
