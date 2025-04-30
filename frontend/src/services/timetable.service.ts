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
// interface CreateTimetableBackendPayload {
//     name: string;
//     validFrom: string;
//     validUntil?: string | null;
//     entries: Array<{
//         dayOfWeek: number;
//         subjectName: string;
//         courseCode?: string | null;
//         startTime?: string | null;
//         endTime?: string | null;
//     }>;
// }

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

interface TimetableListResponse {
    status: string;
    results: number;
    data: { timetables: TimetableOutput[] };
}

interface TimetableCreateResponse {
    status: string;
    data: { timetable: TimetableOutput };
}

interface TimetableUpdateResponse { // Define response type for update
    status: string;
    data: { timetable: TimetableOutput };
}
// --- End Types ---


type FlatTimetableEntryInput = Omit<TimetableEntry, 'id' | 'timetableId'>;

// Helper function to transform nested subjects to flat entries
// const transformSubjectsToEntries = (subjects: CreateTimetableFrontendInput['subjects']): FlatTimetableEntryInput[] => {
//     const entries: FlatTimetableEntryInput[] = [];
//     subjects.forEach(subject => {
//         subject.timeSlots.forEach(slot => {
//             entries.push({
//                 dayOfWeek: slot.dayOfWeek,
//                 subjectName: subject.subjectName,
//                 // Map empty strings/undefined from frontend to null for DB consistency
//                 courseCode: subject.courseCode || null,
//                 startTime: slot.startTime || null,
//                 endTime: slot.endTime || null,
//             });
//         });
//     });
//     return entries;
// };

export const timetableService = {
    // Function to get timetables for a stream
    getTimetablesForStream: async (streamId: string): Promise<TimetableOutput[]> => {
        try {
            const response = await apiClient.get<TimetableListResponse>(`/streams/${streamId}/timetables`);
            return response.data.data.timetables;
        } catch (error: any) {
            console.error(`Error fetching timetables for stream ${streamId}:`, error);
            throw new Error(error.message || 'Failed to fetch timetables');
        }
    },

    // Update createTimetable to accept frontend structure and transform it
    createTimetable: async (data: { streamId: string } & CreateTimetableFrontendInput): Promise<TimetableOutput> => {
        const { streamId, ...payload } = data;
        // Ensure payload sent matches CreateTimetableFrontendInput (nested subjects)
         const createPayload = {
            ...payload,
            validUntil: payload.validUntil || null, // Handle empty string for optional date
         };
        console.log("Payload sent to backend for CREATE (nested):", createPayload);
        try {
            const response = await apiClient.post<TimetableCreateResponse>(`/streams/${streamId}/timetables`, createPayload);
            return response.data.data.timetable;
        } catch (error: any) {
            console.error(`Error creating timetable for stream ${streamId}:`, error);
            throw new Error(error.message || 'Failed to create timetable');
        }
    },

    updateTimetable: async (payload: { timetableId: string } & CreateTimetableFrontendInput): Promise<TimetableOutput> => {
        const { timetableId, ...updateData } = payload; // updateData contains 'subjects'

         // Ensure payload sent matches CreateTimetableFrontendInput (nested subjects)
         const updatePayload = {
            ...updateData,
            validUntil: updateData.validUntil || null, // Handle empty string for optional date
         };

        console.log("Payload sent to backend for UPDATE (nested):", updatePayload);

        try {
            // Send the updateData object which contains the nested 'subjects' array
            const response = await apiClient.put<TimetableUpdateResponse>(
                `/timetables/${timetableId}`,
                updatePayload
            );
            return response.data.data.timetable;
        } catch (error: any) {
            console.error(`Error updating timetable ${timetableId}:`, error);
            throw new Error(error.response?.data?.message || error.message || 'Failed to update timetable');
        }
    },

    // Add deleteTimetable function (as before)
    deleteTimetable: async (timetableId: string): Promise<void> => {
        try {
            // Adjust endpoint if your backend route is different
            await apiClient.delete(`/timetables/${timetableId}`);
        } catch (error: any) {
            console.error(`Error deleting timetable ${timetableId}:`, error);
            // Rethrow a more specific error message if possible
            throw new Error(error.response?.data?.message || error.message || 'Failed to delete timetable');
        }
    },

    // Function to get details for ONE timetable (for View/Edit page)
    getTimetableDetails: async (timetableId: string): Promise<TimetableOutput> => {
        try {
            // Adjust endpoint if your backend route is different
            const response = await apiClient.get<{ status: string; data: { timetable: TimetableOutput } }>(`/timetables/${timetableId}`);
            return response.data.data.timetable;
        } catch (error: any) {
            console.error(`Error fetching timetable details ${timetableId}:`, error);
            throw new Error(error.response?.data?.message || error.message || 'Failed to fetch timetable details');
        }
    },
};