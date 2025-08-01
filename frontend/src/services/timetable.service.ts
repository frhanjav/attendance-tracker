import apiClient from '../lib/apiClient';

export interface TimeSlotInput {
    dayOfWeek: number;
    startTime?: string;
    endTime?: string;
}

export interface SubjectInput {
    subjectName: string;
    courseCode?: string;
    timeSlots: TimeSlotInput[];
}

export interface CreateTimetableFrontendInput {
    name: string;
    validFrom: string;
    validUntil?: string | null;
    subjects: SubjectInput[];
}

export interface SetEndDateInput {
    validUntil: string;
}

export interface TimetableOutput {
    id: string;
    streamId: string;
    name: string;
    validFrom: string;
    validUntil: string | null;
    createdAt: string;
    entries: Array<{
        id: string;
        timetableId: string;
        dayOfWeek: number;
        subjectName: string;
        courseCode: string | null;
        startTime: string | null;
        endTime: string | null;
    }>;
}

export interface TimetableBasicInfo {
    id: string;
    name: string;
    validFrom: string;
    validUntil: string | null;
}

export interface WeeklyScheduleEntry {
    date: string;
    dayOfWeek: number;
    subjectName: string;
    courseCode: string | null;
    startTime: string | null;
    endTime: string | null;
    status: 'SCHEDULED' | 'CANCELLED';
}

interface TimetableBasicListResponse { status: string; results: number; data: { timetables: TimetableBasicInfo[] }; }
interface TimetableCreateResponse { status: string; data: { timetable: TimetableOutput }; }
interface WeeklyScheduleResponse { status: string; data: { schedule: WeeklyScheduleEntry[] }; }

export const timetableService = {

    getTimetableListForImport: async (streamId: string): Promise<TimetableBasicInfo[]> => {
        try {
            const response = await apiClient.get<TimetableBasicListResponse>(`/timetables/list/${streamId}`);
            if (response.data?.status !== 'success' || !response.data?.data?.timetables) {
                 throw new Error("Invalid API response structure for timetable list.");
            }
            return response.data.data.timetables;
        } catch (error: any) {
            console.error(`Error fetching timetable list for stream ${streamId}:`, error);
            throw new Error(error.message || 'Failed to fetch timetable list');
        }
    },

    getTimetableDetails: async (timetableId: string): Promise<TimetableOutput> => {
         try {
            const response = await apiClient.get<{ status: string; data: { timetable: TimetableOutput } }>(`/timetables/${timetableId}`);
             if (response.data?.status !== 'success' || !response.data?.data?.timetable) {
                 throw new Error("Invalid API response structure for timetable details.");
            }
            return response.data.data.timetable;
        } catch (error: any) {
             console.error(`Error fetching timetable details ${timetableId}:`, error);
             throw new Error(error.message || 'Failed to fetch timetable details');
        }
    },

    getWeeklySchedule: async (streamId: string, startDate: string, endDate: string): Promise<WeeklyScheduleEntry[]> => {
         try {
            const response = await apiClient.get<WeeklyScheduleResponse>(`/timetables/weekly/${streamId}`, {
                params: { startDate, endDate }
            });
             if (response.data?.status !== 'success' || !response.data?.data?.schedule) {
                throw new Error("Invalid API response structure for weekly schedule.");
            }
            return response.data.data.schedule;
        } catch (error: any) {
            console.error(`Error fetching weekly schedule for stream ${streamId}:`, error);
            throw new Error(error.message || 'Failed to fetch weekly schedule');
        }
    },

    createTimetable: async (data: { streamId: string } & CreateTimetableFrontendInput): Promise<TimetableOutput> => {
        const { streamId, ...payload } = data;
        const createPayload = {
            ...payload,
            validUntil: payload.validUntil || null,
        };
        console.log("Payload sent to backend for CREATE (nested):", createPayload);
        try {
            const response = await apiClient.post<TimetableCreateResponse>(`/streams/${streamId}/timetables`, createPayload);
             if (response.data?.status !== 'success' || !response.data?.data?.timetable) {
                 throw new Error("Invalid API response structure for create timetable.");
            }
            return response.data.data.timetable;
        } catch (error: any) {
            console.error(`Error creating timetable for stream ${streamId}:`, error);
            throw new Error(error.message || 'Failed to create timetable');
        }
    },

    getActiveTimetableForDate: async (streamId: string, dateString: string): Promise<TimetableOutput | null> => {
        try {
            const response = await apiClient.get<{ status: string; data: { timetable: TimetableOutput } }>(`/streams/${streamId}/timetables/active`, {
                params: { date: dateString }
            });
             if (response.data?.status === 'success' && response.data?.data?.timetable) {
                 return response.data.data.timetable;
             }
             return null;
        } catch (error: any) {
             if (error.response?.status === 404) {
                 return null;
             }
             console.error(`Error fetching active timetable for stream ${streamId} on ${dateString}:`, error);
             throw new Error(error.message || 'Failed to fetch active timetable');
        }
    },

    setEndDate: async (timetableId: string, data: SetEndDateInput): Promise<TimetableOutput> => {
        try {
            const response = await apiClient.patch<{ status: string, data: { timetable: TimetableOutput } }>(
                `/timetables/${timetableId}/set-end-date`,
                data
            );
            if (response.data?.status !== 'success' || !response.data?.data?.timetable) {
                throw new Error("Invalid API response when setting end date.");
            }
            return response.data.data.timetable;
        } catch (error: any) {
            console.error(`Error setting end date for timetable ${timetableId}:`, error);
            throw new Error(error.message || 'Failed to set end date');
        }
    },
};