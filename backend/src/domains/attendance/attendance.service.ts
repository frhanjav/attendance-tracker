// backend/src/domains/attendance/attendance.service.ts
import { attendanceRepository } from './attendance.repository';
import { timetableService } from '../timetable/timetable.service';
import { streamService } from '../stream/stream.service';
import { MarkAttendanceInput, BulkAttendanceInput, AttendanceRecordOutput, /* CalendarEventOutput - Removed */ } from './attendance.dto'; // Remove CalendarEventOutput if not used
import { NotFoundError, BadRequestError, ForbiddenError } from '../../core/errors';
import { AttendanceRecord, AttendanceStatus, User } from '@prisma/client';
import { normalizeDate, getDaysInInterval, getISODayOfWeek, formatDate } from '../../core/utils';
import { parseISO } from 'date-fns';
import prisma from '../../infrastructure/prisma';
// Import types needed for mapping and parameters
import { StreamMemberOutput } from '../stream/stream.dto';
import { WeeklyScheduleEntry } from '../timetable/timetable.service'; // Import type from timetable service

// --- NEW: Type for Weekly Attendance View Entry ---
export interface WeeklyAttendanceViewEntry {
    date: string; // YYYY-MM-DD
    dayOfWeek: number;
    subjectName: string;
    courseCode: string | null;
    startTime: string | null;
    endTime: string | null;
    status: AttendanceStatus; // User's status or global status
    recordId?: string;
}

export const attendanceService = {
    // --- Mark Daily Attendance (Student Action) ---
    async markDailyAttendance(input: MarkAttendanceInput, userId: string): Promise<AttendanceRecordOutput> {
        await streamService.ensureMemberAccess(input.streamId, userId);
        const classDate = normalizeDate(input.classDate);

        // Optional: Prevent marking if class was globally cancelled
        // This requires fetching the status first, adding complexity.
        // Let's assume for now upsert handles overwriting if needed,
        // but ideally, UI prevents marking cancelled classes.

        // Allow only setting OCCURRED or MISSED by student
        if (input.status !== AttendanceStatus.OCCURRED && input.status !== AttendanceStatus.MISSED) {
             throw new BadRequestError("Invalid status. You can only mark as Attended or Missed.");
        }

        const record = await attendanceRepository.upsertRecord({
            userId: userId, streamId: input.streamId, subjectName: input.subjectName,
            courseCode: input.courseCode, classDate: classDate, status: input.status,
            // markedByUserId: userId, // Removed if column dropped
        });

        // Map to output DTO, converting dates to ISO strings
        return {
             id: record.id, userId: record.userId, streamId: record.streamId,
             subjectName: record.subjectName, courseCode: record.courseCode,
             classDate: record.classDate.toISOString(), // Convert Date
             status: record.status,
             markedAt: record.markedAt.toISOString(), // Convert Date
        };
    },

    // --- Get Attendance Records (Ensure date mapping) ---
    async getAttendanceRecords(
        streamId: string, userId: string, filterUserId: string,
        startDate?: string, endDate?: string, subjectName?: string
    ): Promise<AttendanceRecordOutput[]> {
        await streamService.ensureMemberAccess(streamId, filterUserId);
        const start = startDate ? normalizeDate(startDate) : new Date(0);
        const end = endDate ? normalizeDate(endDate) : new Date();
        const records = await attendanceRepository.findRecordsByUserAndDateRange(userId, streamId, start, end, subjectName);
        // Map to output DTO, converting dates
        return records.map(record => ({
             id: record.id, userId: record.userId, streamId: record.streamId,
             subjectName: record.subjectName, courseCode: record.courseCode,
             classDate: record.classDate.toISOString(), // Convert Date
             status: record.status,
             markedAt: record.markedAt.toISOString(), // Convert Date
        }));
    },

    // --- NEW: Get Weekly Attendance View ---
    async getWeeklyAttendanceView(streamId: string, startDateStr: string, endDateStr: string, userId: string): Promise<WeeklyAttendanceViewEntry[]> {
        console.log(`[Attendance Service BE] Getting weekly view for user ${userId}, stream ${streamId}, ${startDateStr} to ${endDateStr}`);
        await streamService.ensureMemberAccess(streamId, userId);
        const startDate = normalizeDate(startDateStr);
        const endDate = normalizeDate(endDateStr);
        const viewEntries: WeeklyAttendanceViewEntry[] = [];

        // 1. Get the underlying schedule for the week
        console.log(`[Attendance Service BE] Fetching weekly schedule from timetableService...`);
        const weeklySchedule = await timetableService.getWeeklySchedule(streamId, startDateStr, endDateStr, userId);
        console.log(`[Attendance Service BE] Found ${weeklySchedule.length} scheduled entries.`);

        // 2. Get the user's specific attendance records for the week
        console.log(`[Attendance Service BE] Fetching user attendance records...`);
        const userAttendanceRecords = await attendanceRepository.findRecordsByUserAndDateRange(userId, streamId, startDate, endDate);
        console.log(`[Attendance Service BE] Found ${userAttendanceRecords.length} user records.`);

        // 3. Create a map for quick lookup
        const recordsMap = new Map<string, AttendanceRecord>(); // Key: YYYY-MM-DD_SubjectName
        userAttendanceRecords.forEach(rec => {
            // Use normalized date string for key consistency
            const key = `${formatDate(normalizeDate(rec.classDate))}_${rec.subjectName}`;
            recordsMap.set(key, rec);
        });

        // 4. Combine schedule with user's status
        console.log(`[Attendance Service BE] Combining schedule and records...`);
        for (const scheduledEntry of weeklySchedule) {
            const key = `${scheduledEntry.date}_${scheduledEntry.subjectName}`; // Key uses YYYY-MM-DD date string
            const userRecord = recordsMap.get(key);

            let finalStatus: AttendanceStatus;
            // If class was globally cancelled (determined by timetableService.getWeeklySchedule)
            if (scheduledEntry.status === 'CANCELLED') {
                 finalStatus = AttendanceStatus.CANCELLED;
            } else if (userRecord) {
                // User has a specific record (must be OCCURRED or MISSED now)
                finalStatus = userRecord.status;
            } else {
                // No record for user, and class wasn't globally cancelled -> default to MISSED
                finalStatus = AttendanceStatus.MISSED;
            }

            viewEntries.push({
                date: scheduledEntry.date,
                dayOfWeek: scheduledEntry.dayOfWeek,
                subjectName: scheduledEntry.subjectName,
                courseCode: scheduledEntry.courseCode,
                startTime: scheduledEntry.startTime,
                endTime: scheduledEntry.endTime,
                status: finalStatus,
                recordId: userRecord?.id,
            });
        }
        console.log(`[Attendance Service BE] Weekly view generation complete. Entries: ${viewEntries.length}`);
        return viewEntries;
    },

    // --- NEW: Cancel Class Globally (Admin Action) ---
    async cancelClassGlobally(input: { streamId: string; classDate: string; subjectName: string; startTime?: string | null }, adminUserId: string): Promise<{ message: string; updatedCount: number }> {
        console.log(`[Attendance Service BE] Attempting to cancel class:`, input);
        await streamService.ensureAdminAccess(input.streamId, adminUserId);
        const classDateNorm = normalizeDate(input.classDate);

        console.log(`[Attendance Service BE] Fetching members for stream ${input.streamId}`);
        // Use the specific method to get only IDs for efficiency
        const userIds = await streamService.getStreamMemberUserIds(input.streamId);
        console.log(`[Attendance Service BE] Found ${userIds.length} members.`);

        if (userIds.length === 0) {
            return { message: "No members found in the stream.", updatedCount: 0 };
        }

        // Call repository method to update status for all users
        const updatedCount = await attendanceRepository.updateStatusForAllUsers(
            input.streamId,
            userIds,
            classDateNorm,
            input.subjectName,
            AttendanceStatus.CANCELLED
            // Pass adminUserId if tracking who cancelled: adminUserId
        );

        // TODO: Invalidate caches (frontend handles this via query invalidation)

        return { message: `Class cancelled. Status updated for ${updatedCount} students.`, updatedCount: updatedCount };
    },

    // --- Record Bulk Attendance (Fix field name) ---
    async recordBulkAttendance(input: BulkAttendanceInput, userId: string): Promise<{ message: string, entriesCreated: number }> {
        await streamService.ensureMemberAccess(input.streamId, userId);
        const startDate = normalizeDate(input.startDate);
        const endDate = input.endDate ? normalizeDate(input.endDate) : normalizeDate(new Date());
        if (endDate < startDate) throw new BadRequestError('End date cannot be before start date.');

        const scheduledCounts = await timetableService.calculateScheduledClasses(input.streamId, startDate, endDate, userId);
        const cancelledCounts = await attendanceRepository.countCancelledClasses(input.streamId, startDate, endDate);

        let entriesCreated = 0;
        for (const [subjectName, attendedClasses] of Object.entries(input.attendance)) {
            const totalScheduled = scheduledCounts[subjectName] || 0;
            const totalCancelled = cancelledCounts[subjectName] || 0;
            const totalHeld = Math.max(0, totalScheduled - totalCancelled);

            if (totalScheduled === 0) continue; // Skip if never scheduled
            if (attendedClasses > totalHeld) {
                throw new BadRequestError(`Attended (${attendedClasses}) for "${subjectName}" exceeds Held (${totalHeld}) [Sch: ${totalScheduled}, Can: ${totalCancelled}].`);
            }

            const courseCode = null; // Placeholder - need better way to get this

            await attendanceRepository.createBulkEntry({
                userId, streamId: input.streamId, subjectName, courseCode,
                attendedClasses,
                totalHeldClasses: totalHeld, // Use correct field name
                startDate, endDate,
            });
            entriesCreated++;
        }

        if (entriesCreated === 0) return { message: "No valid bulk entries created.", entriesCreated };
        // Remove frontend queryClient call
        return { message: `Successfully recorded bulk attendance for ${entriesCreated} subjects.`, entriesCreated };
    },
};