import apiClient from '../lib/apiClient';

export enum AttendanceStatus {
    OCCURRED = 'OCCURRED',
    MISSED   = 'MISSED',
    CANCELLED = 'CANCELLED',
}

export interface WeeklyAttendanceViewEntry {
    date: string; // YYYY-MM-DD
    dayOfWeek: number;
    subjectName: string;
    courseCode: string | null;
    startTime: string | null;
    endTime: string | null;
    status: AttendanceStatus;
    recordId?: string;
    isReplacement?: boolean;
    originalSubjectName?: string | null;
}

// Input for marking attendance
export interface MarkAttendanceInput {
    streamId: string;
    subjectName: string;
    courseCode?: string | null;
    classDate: string;
    status: AttendanceStatus;
}

// Input for bulk attendance
export interface BulkAttendanceInput {
    streamId: string;
    startDate: string;
    endDate?: string;
    attendance: Record<string, number>;
}

// Input type for cancelling class (sent TO backend)
export interface CancelClassInput {
    streamId: string;
    classDate: string;
    subjectName: string;
    startTime?: string | null;
}

// Input type for replacing class (sent TO backend)
export interface ReplaceClassInput {
    streamId: string;
    classDate: string; // YYYY-MM-DD
    originalSubjectName: string;
    originalStartTime?: string | null;
    replacementSubjectName: string;
    replacementCourseCode?: string | null;
    replacementStartTime?: string | null; // Optional new times
    replacementEndTime?: string | null;
}

// Type for a single attendance record returned FROM backend API
export interface AttendanceRecordOutput {
    id: string;
    userId: string;
    streamId: string;
    subjectName: string;
    courseCode: string | null;
    classDate: string; // API returns ISO string
    status: AttendanceStatus;
    markedAt: string; // API returns ISO string
    // Add replacement fields if backend DTO includes them
    isReplacement?: boolean;
    originalSubjectName?: string | null;
}

// Expected API response structure for POST /attendance/mark
interface MarkAttendanceResponse {
  status: string;
  data: { record: AttendanceRecordOutput };
}

// Response type for bulk attendance
interface BulkAttendanceResponse {
    status: string;
    data: { message: string; entriesCreated: number };
}

interface ClassUpdateResponse { status: string; data: { message: string; updatedCount: number }; }

interface WeeklyAttendanceViewResponse { // For the new endpoint
    status: string;
    data: { attendanceView: WeeklyAttendanceViewEntry[] };
}

// --- Service Functions ---
export const attendanceService = {

    // --- Get Weekly Attendance View ---
    getWeeklyAttendanceView: async (streamId: string, startDate: string, endDate: string): Promise<WeeklyAttendanceViewEntry[]> => {
        try {
            const response = await apiClient.get<WeeklyAttendanceViewResponse>(`/attendance/weekly/${streamId}`, {
                params: { startDate, endDate }
            });
            if (response.data?.status !== 'success' || !response.data?.data?.attendanceView) {
                throw new Error("Invalid API response structure for weekly attendance view.");
            }
            // Dates are already strings (YYYY-MM-DD) in WeeklyAttendanceViewEntry
            return response.data.data.attendanceView;
        } catch (error: any) {
            console.error("Error fetching weekly attendance view:", error);
            throw new Error(error.message || 'Failed to fetch weekly attendance view');
        }
    },

    // --- Cancel Class Globally ---
    cancelClassGlobally: async (data: { streamId: string; classDate: string; subjectName: string; startTime?: string | null }): Promise<{ message: string; updatedCount: number }> => {
        try {
           // Assuming backend route is POST /attendance/cancel
           const response = await apiClient.post<{ status: string; data: { message: string; updatedCount: number } }>('/attendance/cancel', data);
            if (response.data?.status !== 'success' || !response.data?.data) {
               throw new Error("Invalid API response structure for cancel class.");
           }
           return response.data.data;
       } catch (error: any) {
           console.error("Error cancelling class:", error);
           throw new Error(error.message || 'Failed to cancel class');
       }
   },

   replaceClassGlobally: async (data: ReplaceClassInput): Promise<{ message: string; updatedCount: number }> => {
    try {
        const response = await apiClient.post<ClassUpdateResponse>('/attendance/replace', data);
         if (response.data?.status !== 'success' || !response.data?.data) {
            throw new Error("Invalid API response structure for replace class.");
        }
        return response.data.data;
    } catch (error: any) {
        console.error("Error replacing class:", error);
        throw new Error(error.message || 'Failed to replace class');
    }
},

    /**
     * Sends a request to mark the status of a specific class instance.
     */
    markAttendance: async (data: MarkAttendanceInput): Promise<AttendanceRecordOutput> => {
      try {
          const response = await apiClient.post<MarkAttendanceResponse>('/attendance/mark', data);

          if (response.data?.status !== 'success' || !response.data?.data?.record) {
               throw new Error("Invalid API response structure when marking attendance.");
          }
          return response.data.data.record; // Return the updated/created record
      } catch (error: any) {
          console.error("Error marking attendance:", error);
          throw new Error(error?.message || 'Failed to mark attendance');
      }
  },

    /**
     * Sends bulk attendance data to the backend.
     */
    recordBulkAttendance: async (data: BulkAttendanceInput): Promise<BulkAttendanceResponse['data']> => {
      try {
         const response = await apiClient.post<BulkAttendanceResponse>('/attendance/bulk', data);

          if (response.data?.status !== 'success' || !response.data?.data) {
              throw new Error("Invalid API response structure for bulk attendance.");
         }
         return response.data.data; // Return the message and count from backend
     } catch (error: any) {
         console.error("Error recording bulk attendance:", error);
         throw new Error(error?.message || 'Failed to record bulk attendance');
     }
 },

    // Optional: Function to get subjects for a stream (if needed for bulk form)
    // getStreamSubjects: async (streamId: string): Promise<string[]> => { ... }
};