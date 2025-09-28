import apiClient from '../lib/apiClient';

export enum AttendanceStatus {
    OCCURRED = 'OCCURRED',
    MISSED   = 'MISSED',
    CANCELLED = 'CANCELLED',
}

export interface WeeklyAttendanceViewEntry {
    date: string;
    dayOfWeek: number;
    subjectName: string;
    courseCode: string | null;
    startTime: string | null;
    endTime: string | null;
    status: AttendanceStatus;
    recordId?: string;
    isReplacement?: boolean;
    originalSubjectName?: string | null;
    isGloballyCancelled?: boolean;
    isAdded?: boolean;
    subjectIndex?: number;
}

export interface MarkAttendanceInput {
    streamId: string;
    subjectName: string;
    courseCode?: string | null;
    classDate: string;
    status: AttendanceStatus;
    subjectIndex: number;
}

export interface BulkAttendanceInput {
    streamId: string;
    startDate: string;
    endDate?: string;
    attendance: Record<string, number>;
}

export interface CancelClassInput {
    streamId: string;
    classDate: string;
    subjectName: string;
    startTime?: string | null;
    entryIndex: number;
}

export interface ReplaceClassInput {
    streamId: string;
    classDate: string;
    originalSubjectName: string;
    originalStartTime?: string | null;
    replacementSubjectName: string;
    replacementCourseCode?: string | null;
    replacementStartTime?: string | null;
    replacementEndTime?: string | null;
    entryIndex: number;
}

export interface AddSubjectInput {
    streamId: string;
    classDate: string;
    subjectName: string;
    courseCode?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    entryIndex: number;
}

export interface AttendanceRecordOutput {
    id: string;
    userId: string;
    streamId: string;
    subjectName: string;
    courseCode: string | null;
    classDate: string;
    status: AttendanceStatus;
    markedAt: string;
    isReplacement?: boolean;
    originalSubjectName?: string | null;
}

interface MarkAttendanceResponse {
  status: string;
  data: { record: AttendanceRecordOutput };
}

interface BulkAttendanceResponse {
    status: string;
    data: { message: string; entriesCreated: number };
}

interface ClassUpdateResponse { status: string; data: { message: string; updatedCount: number }; }

interface WeeklyAttendanceViewResponse {
    status: string;
    data: { attendanceView: WeeklyAttendanceViewEntry[] };
}

export const attendanceService = {

    getWeeklyAttendanceView: async (streamId: string, startDate: string, endDate: string): Promise<WeeklyAttendanceViewEntry[]> => {
        try {
            const response = await apiClient.get<WeeklyAttendanceViewResponse>(`/attendance/weekly/${streamId}`, {
                params: {
                    startDate,
                    endDate,
                    _t: Date.now()
                },
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            if (response.data?.status !== 'success' || !response.data?.data?.attendanceView) {
                throw new Error("Invalid API response structure for weekly attendance view.");
            }
            return response.data.data.attendanceView;
        } catch (error: any) {
            console.error("Error fetching weekly attendance view:", error);
            throw new Error(error.message || 'Failed to fetch weekly attendance view');
        }
    },

    cancelClassGlobally: async (data: { streamId: string; classDate: string; subjectName: string; startTime?: string | null }): Promise<{ message: string; updatedCount: number }> => {
        try {
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

    addSubjectGlobally: async (data: AddSubjectInput): Promise<{ message: string; updatedCount: number }> => {
        try {
            const response = await apiClient.post<ClassUpdateResponse>('/attendance/add', data);
            if (response.data?.status !== 'success' || !response.data?.data) {
                throw new Error("Invalid API response structure for add subject.");
            }
            return response.data.data;
        } catch (error: any) {
            console.error("Error adding subject:", error);
            throw new Error(error.message || 'Failed to add subject');
        }
    },

    markAttendance: async (data: MarkAttendanceInput): Promise<AttendanceRecordOutput> => {
      try {
          const response = await apiClient.post<MarkAttendanceResponse>('/attendance/mark', data);

          if (response.data?.status !== 'success' || !response.data?.data?.record) {
               throw new Error("Invalid API response structure when marking attendance.");
          }
          return response.data.data.record;
      } catch (error: any) {
          console.error("Error marking attendance:", error);
          throw new Error(error?.message || 'Failed to mark attendance');
      }
  },

    recordBulkAttendance: async (data: BulkAttendanceInput): Promise<BulkAttendanceResponse['data']> => {
      try {
         const response = await apiClient.post<BulkAttendanceResponse>('/attendance/bulk', data);

          if (response.data?.status !== 'success' || !response.data?.data) {
              throw new Error("Invalid API response structure for bulk attendance.");
         }
         return response.data.data;
     } catch (error: any) {
         console.error("Error recording bulk attendance:", error);
         throw new Error(error?.message || 'Failed to record bulk attendance');
     }
 },
};