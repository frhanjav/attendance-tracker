// frontend/src/services/timetable.service.ts
import apiClient from '../lib/apiClient';
import { format, parseISO } from 'date-fns';

// --- Exported Types for Frontend Usage ---

export interface TimeSlotInput {
    dayOfWeek: number;
    startTime?: string;
    endTime?: string;
}

export interface SubjectInput {
    subjectName: string; // REQUIRED
    courseCode?: string;
    timeSlots: TimeSlotInput[];
}

// Input type for create/update PAYLOAD SENT TO BACKEND SERVICE
// This structure matches the form state and backend DTO validation schema
export interface CreateTimetableFrontendInput {
    name: string;
    validFrom: string; // YYYY-MM-DD string
    validUntil?: string | null; // YYYY-MM-DD string, empty string, or null
    subjects: SubjectInput[]; // Use the SubjectInput type (subjectName is required)
}

// Type for the full timetable object RETURNED FROM BACKEND API
export interface TimetableOutput {
    id: string;
    streamId: string;
    name: string;
    validFrom: string; // ISO String from backend
    validUntil: string | null; // ISO String or null from backend
    createdAt: string; // ISO String from backend
    updatedAt?: string; // ISO String (if applicable)
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

// Type for basic timetable info RETURNED FROM BACKEND API (for import list)
export interface TimetableBasicInfo {
    id: string;
    name: string;
    validFrom: string; // ISO String
    validUntil: string | null; // ISO String or null
}

// Type for weekly schedule entry RETURNED FROM BACKEND API
export interface WeeklyScheduleEntry {
    date: string; // YYYY-MM-DD
    dayOfWeek: number;
    subjectName: string;
    courseCode: string | null;
    startTime: string | null;
    endTime: string | null;
    status: 'SCHEDULED' | 'CANCELLED'; // Global status from backend
}
// --- End Exported Types ---


// Internal types for API response structures
interface TimetableListResponse { status: string; results: number; data: { timetables: TimetableOutput[] }; }
interface TimetableBasicListResponse { status: string; results: number; data: { timetables: TimetableBasicInfo[] }; }
interface TimetableCreateResponse { status: string; data: { timetable: TimetableOutput }; }
interface WeeklyScheduleResponse { status: string; data: { schedule: WeeklyScheduleEntry[] }; }


// --- REMOVED CreateTimetableBackendPayload type ---
// --- REMOVED transformSubjectsToEntries helper function ---


// --- Service Object ---
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

    // --- Create Timetable ---
    // Accepts the nested structure and SENDS IT DIRECTLY to the backend
    createTimetable: async (data: { streamId: string } & CreateTimetableFrontendInput): Promise<TimetableOutput> => {
        const { streamId, ...payload } = data;
        // Prepare payload, ensuring validUntil is null if empty string
        const createPayload = {
            ...payload,
            validUntil: payload.validUntil || null,
        };
        console.log("Payload sent to backend for CREATE (nested):", createPayload); // Log the actual payload being sent
        try {
            // Backend endpoint /streams/:streamId/timetables expects the nested structure in the body
            // because its validation schema (TimetableBodySchema) expects 'subjects'
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
};