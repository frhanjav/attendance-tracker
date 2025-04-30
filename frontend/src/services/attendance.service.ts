// frontend/src/services/attendance.service.ts (Create or update)
import apiClient from '../lib/apiClient';
import { AttendanceStatus } from '@prisma/client'; // Import if needed, or define enum locally

// Define types matching backend DTOs

// Type for calendar events expected by react-big-calendar
// Match the CalendarEventOutputSchema from backend DTO
export interface CalendarEvent {
    title: string;
    start: Date; // Use Date objects on frontend
    end: Date;
    allDay?: boolean;
    resource?: { // Match backend resource structure
        recordId?: string;
        streamId: string;
        subjectName: string;
        courseCode?: string | null;
        status: AttendanceStatus; // Use the enum/string type
    };
}

// Input for marking attendance
export interface MarkAttendanceInput {
    streamId: string;
    subjectName: string;
    courseCode?: string | null;
    classDate: string; // YYYY-MM-DD format
    status: AttendanceStatus;
}

// Input for bulk attendance
export interface BulkAttendanceInput {
    streamId: string;
    startDate: string; // YYYY-MM-DD
    endDate?: string; // YYYY-MM-DD
    attendance: Record<string, number>; // { [subjectName]: attendedCount }
}

// Response type for marking attendance (matches AttendanceRecordOutput)
export interface AttendanceRecordOutput {
    id: string;
    userId: string;
    streamId: string;
    subjectName: string;
    courseCode: string | null;
    classDate: string; // API returns ISO string
    status: AttendanceStatus;
    markedAt: string; // API returns ISO string
}

// Type for the raw calendar event data received FROM backend API
// Matches CalendarEventOutputSchema from backend DTO (dates are strings)
interface RawCalendarEvent {
  title: string;
  start: string; // ISO String from backend
  end: string;   // ISO String from backend
  allDay?: boolean;
  resource?: {
      recordId?: string;
      streamId: string;
      subjectName: string;
      courseCode?: string | null;
      status: AttendanceStatus; // Use the imported enum
  };
}

// Response type for calendar data
interface CalendarDataResponse {
    status: string;
    results: number;
    data: { events: RawCalendarEvent[] }; // Backend should return dates as ISO strings
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

// --- Service Functions ---
export const attendanceService = {
    /**
     * Fetches calendar event data for a given stream and date range.
     * Converts date strings from the API into Date objects for react-big-calendar.
     */
    getCalendarData: async (streamId: string, startDate: string, endDate: string): Promise<CalendarEvent[]> => {
        try {
            const response = await apiClient.get<CalendarDataResponse>('/attendance/calendar', {
                params: { streamId, startDate, endDate }
            });

            if (response.data?.status !== 'success' || !response.data?.data?.events) {
                console.warn("Received invalid API response structure for calendar data:", response.data);
                return []; // Return empty array on invalid structure
            }

            const rawEvents: RawCalendarEvent[] = response.data.data.events;

            // Use map with explicit typing for the parameter and the return value
            const transformedEvents: CalendarEvent[] = rawEvents.map(
                (rawEvent: RawCalendarEvent): CalendarEvent => {
                    // Construct the CalendarEvent object explicitly
                    const eventResource = rawEvent.resource ? { ...rawEvent.resource } : undefined;
                    return {
                        title: rawEvent.title,
                        start: new Date(rawEvent.start), // Parse date string
                        end: new Date(rawEvent.end),     // Parse date string
                        allDay: rawEvent.allDay,
                        resource: eventResource,
                    };
                }
            );

            return transformedEvents;

        } catch (error: any) {
            console.error("Error fetching calendar data:", error);
            throw new Error(error?.message || 'Failed to fetch calendar data');
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

// Re-export or define AttendanceStatus enum if not importing from backend types
export { AttendanceStatus }; // Assuming it's available globally or imported