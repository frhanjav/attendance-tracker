import apiClient from '../lib/apiClient';
import { TimetableEntry } from '@prisma/client';

// Define types matching backend DTOs
// interface TimetableEntryInput {
//     dayOfWeek: number;
//     subjectName: string;
//     courseCode?: string | null; // Match backend expectation (null)
//     startTime?: string | null;
//     endTime?: string | null;
// }

// interface CreateTimetableInput {
//     name: string;
//     validFrom: string; // Send as ISO string or YYYY-MM-DD
//     validUntil?: string | null;
//     entries: TimetableEntryInput[];
// }

// --- Ensure these types match your form/backend DTOs ---
export interface TimeSlot { // Represents a single time slot in the nested structure
    dayOfWeek: number;
    startTime?: string;
    endTime?: string;
}

export interface SubjectInput { // Represents a subject in the nested structure
    subjectName: string;
    courseCode?: string;
    timeSlots: TimeSlot[];
}

// Define the input type matching the new form schema
export interface CreateTimetableFrontendInput { // Input for create/update from frontend form
    name: string;
    validFrom: string;
    validUntil?: string | null;
    subjects: SubjectInput[];
}

// Removed the transformSubjectsToEntries call and backendPayload creation within the updateTimetable function. It now sends the updateData (containing nested subjects) directly. Also added a similar check/log for createTimetable.

// Keep the backend input type as before (flat entries)
interface CreateTimetableBackendPayload {
    name: string;
    validFrom: string;
    validUntil?: string | null;
    entries: Array<{
        dayOfWeek: number;
        subjectName: string;
        courseCode?: string | null;
        startTime?: string | null;
        endTime?: string | null;
    }>;
}

export interface TimetableOutput { // Match backend TimetableOutput DTO
    id: string;
    streamId: string;
    name: string;
    validFrom: string; // Or Date if you parse on frontend
    validUntil: string | null; // Or Date | null
    createdAt: string; // Or Date
    updatedAt: string; // Or Date
    entries: Array<{
        id: string;
        timetableId: string;
        dayOfWeek: number;
        subjectName: string;
        courseCode?: string | null;
        startTime?: string | null;
        endTime?: string | null;
    }>;
}

export interface TimetableBasicInfo { // For import list
    id: string;
    name: string;
    validFrom: string; // ISO String
    validUntil: string | null; // ISO String or null
}
export interface WeeklyScheduleEntry { // For timetable viewer
    // id: string; // Maybe remove if not stable/needed
    date: string; // YYYY-MM-DD
    dayOfWeek: number;
    subjectName: string;
    courseCode: string | null;
    startTime: string | null;
    endTime: string | null;
    status: 'SCHEDULED' | 'CANCELLED'; // Global status
}

interface TimetableListResponse {
    status: string;
    results: number;
    data: { timetables: TimetableOutput[] };
}
interface TimetableBasicListResponse { status: string; results: number; data: { timetables: TimetableBasicInfo[] }; } // For import list

interface TimetableCreateResponse {
    status: string;
    data: { timetable: TimetableOutput };
}

interface TimetableUpdateResponse { // Define response type for update
    status: string;
    data: { timetable: TimetableOutput };
}

interface WeeklyScheduleResponse { status: string; data: { schedule: WeeklyScheduleEntry[] }; } // For weekly view

// --- End Types ---


type FlatTimetableEntryInput = Omit<TimetableEntry, 'id' | 'timetableId'>;

// Helper function to transform nested subjects to flat entries
const transformSubjectsToEntries = (subjects: CreateTimetableFrontendInput['subjects']): FlatTimetableEntryInput[] => {
    const entries: FlatTimetableEntryInput[] = [];
    subjects.forEach(subject => {
        subject.timeSlots.forEach(slot => {
            entries.push({
                dayOfWeek: slot.dayOfWeek,
                subjectName: subject.subjectName,
                // Map empty strings/undefined from frontend to null for DB consistency
                courseCode: subject.courseCode || null,
                startTime: slot.startTime || null,
                endTime: slot.endTime || null,
            });
        });
    });
    return entries;
};

export const timetableService = {
    // --- Get List for Import ---
    getTimetableListForImport: async (streamId: string): Promise<TimetableBasicInfo[]> => {
        try {
            const response = await apiClient.get<TimetableBasicListResponse>(`/timetables/list/${streamId}`);
            return response.data.data.timetables;
        } catch (error: any) {
            console.error(`Error fetching timetable list for stream ${streamId}:`, error);
            throw new Error(error.message || 'Failed to fetch timetable list');
        }
    },

    // --- Get Timetable Details (for import population) ---
    getTimetableDetails: async (timetableId: string): Promise<TimetableOutput> => {
        try {
            const response = await apiClient.get<{ status: string; data: { timetable: TimetableOutput } }>(`/timetables/${timetableId}`);
            return response.data.data.timetable;
        } catch (error: any) {
            console.error(`Error fetching timetable details ${timetableId}:`, error);
            throw new Error(error.message || 'Failed to fetch timetable details');
        }
    },

    // --- Get Weekly Schedule (for viewer) ---
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
    createTimetable: async (data: { streamId: string } & CreateTimetableFrontendInput): Promise<TimetableOutput> => {
        const { streamId, ...payload } = data;
        const createPayload = { ...payload, validUntil: payload.validUntil || null };
        console.log("Payload sent to backend for CREATE (nested):", createPayload);
        try {
            const response = await apiClient.post<TimetableCreateResponse>(`/streams/${streamId}/timetables`, createPayload);
            return response.data.data.timetable;
        } catch (error: any) {
            console.error(`Error creating timetable for stream ${streamId}:`, error);
            throw new Error(error.message || 'Failed to create timetable');
        }
    },
};