import { attendanceRepository } from './attendance.repository';
import { timetableService } from '../timetable/timetable.service'; // Needed for calendar/bulk calc
import { streamService } from '../stream/stream.service'; // For permissions
import { MarkAttendanceInput, BulkAttendanceInput, AttendanceRecordOutput, CalendarEventOutput } from './attendance.dto';
import { NotFoundError, BadRequestError } from '../../core/errors';
import { AttendanceRecord, AttendanceStatus } from '@prisma/client';
import { normalizeDate, getDaysInInterval, getISODayOfWeek, formatDate } from '../../core/utils';
import { parseISO } from 'date-fns';

// Helper to map Prisma AttendanceRecord to Output DTO
const mapRecordToOutput = (record: AttendanceRecord): AttendanceRecordOutput => ({
    id: record.id,
    userId: record.userId,
    streamId: record.streamId,
    subjectName: record.subjectName,
    courseCode: record.courseCode,
    classDate: record.classDate,
    status: record.status,
    markedAt: record.markedAt,
});

export const attendanceService = {
    async markDailyAttendance(input: MarkAttendanceInput, userId: string): Promise<AttendanceRecordOutput> {
        // 1. Check Permissions
        await streamService.ensureMemberAccess(input.streamId, userId);

        // 2. Validate Date & Check if class was scheduled (optional but good)
        const classDate = normalizeDate(input.classDate);
        // Optional: Fetch active timetable for the date and verify the subject exists on that day
        // const activeTimetable = await timetableService.getActiveTimetableForDate(input.streamId, input.classDate, userId);
        // if (!activeTimetable || !activeTimetable.entries.some(e => e.subjectName === input.subjectName && e.dayOfWeek === getISODayOfWeek(classDate))) {
        //     throw new BadRequestError(`Subject ${input.subjectName} was not scheduled on ${formatDate(classDate)} according to the active timetable.`);
        // }

        // 3. Upsert Record
        const record = await attendanceRepository.upsertRecord({
            userId: userId, // Mark attendance for the logged-in user
            streamId: input.streamId,
            subjectName: input.subjectName,
            courseCode: input.courseCode,
            classDate: classDate,
            status: input.status,
            markedByUserId: userId, // Record who marked it
        });

        return mapRecordToOutput(record);
    },

    async getAttendanceRecords(
        streamId: string,
        userId: string, // The user whose records are being fetched
        filterUserId: string, // The user making the request (for permission check)
        startDate?: string,
        endDate?: string,
        subjectName?: string
    ): Promise<AttendanceRecordOutput[]> {
        await streamService.ensureMemberAccess(streamId, filterUserId);
        // Add more permission logic if needed (e.g., only admins can see others' records)

        const start = startDate ? normalizeDate(startDate) : new Date(0); // Beginning of time if no start date
        const end = endDate ? normalizeDate(endDate) : new Date(); // Today if no end date

        const records = await attendanceRepository.findRecordsByUserAndDateRange(
            userId,
            streamId,
            start,
            end,
            subjectName
        );
        return records.map(mapRecordToOutput);
    },


    /**
     * Generates data suitable for a calendar view, showing scheduled classes
     * and their marked status within a date range.
     */
    async getCalendarData(streamId: string, startDateStr: string, endDateStr: string, userId: string): Promise<CalendarEventOutput[]> {
        await streamService.ensureMemberAccess(streamId, userId);

        const startDate = normalizeDate(startDateStr);
        const endDate = normalizeDate(endDateStr);
        const calendarEvents: CalendarEventOutput[] = [];

        // 1. Get all scheduled classes in the range based on active timetables
        const days = getDaysInInterval(startDate, endDate);
        const scheduledClasses: Map<string, { subjectName: string; courseCode?: string | null }> = new Map(); // Key: YYYY-MM-DD_SubjectName

        for (const day of days) {
            const activeTimetable = await timetableService.getActiveTimetableForDate(streamId, formatDate(day), userId);
            if (activeTimetable) {
                const dayOfWeek = getISODayOfWeek(day);
                const entriesForDay = activeTimetable.entries.filter(entry => entry.dayOfWeek === dayOfWeek);
                for (const entry of entriesForDay) {
                    const key = `${formatDate(day)}_${entry.subjectName}`;
                    scheduledClasses.set(key, { subjectName: entry.subjectName, courseCode: entry.courseCode });
                }
            }
        }

        // 2. Get existing attendance records for the user in the range
        const attendanceRecords = await attendanceRepository.findRecordsByUserAndDateRange(userId, streamId, startDate, endDate);
        const recordsMap: Map<string, AttendanceRecord> = new Map(); // Key: YYYY-MM-DD_SubjectName
        attendanceRecords.forEach(rec => {
            const key = `${formatDate(rec.classDate)}_${rec.subjectName}`;
            recordsMap.set(key, rec);
        });

        // 3. Combine scheduled classes and attendance records
        for (const [key, scheduledClass] of scheduledClasses.entries()) {
            const [dateStr, subjectName] = key.split('_');
            const classDate = parseISO(dateStr); // Use parseISO to get Date object
            const record = recordsMap.get(key);

            const status = record ? record.status : AttendanceStatus.PENDING; // Default to PENDING if not marked
            const title = `${scheduledClass.courseCode ? scheduledClass.courseCode + ': ' : ''}${subjectName} - ${status}`;

            calendarEvents.push({
                title: title,
                start: classDate,
                end: classDate, // Assuming all-day events for simplicity
                allDay: true,
                resource: {
                    recordId: record?.id,
                    streamId: streamId,
                    subjectName: subjectName,
                    courseCode: scheduledClass.courseCode,
                    status: status,
                }
            });
        }

        return calendarEvents;
    },

    /**
     * Records bulk attendance based on user input and calculates total held classes.
     */
    async recordBulkAttendance(input: BulkAttendanceInput, userId: string): Promise<{ message: string, entriesCreated: number }> {
        await streamService.ensureMemberAccess(input.streamId, userId);

        const startDate = normalizeDate(input.startDate);
        const endDate = input.endDate ? normalizeDate(input.endDate) : normalizeDate(new Date()); // Default to today

        if (endDate < startDate) {
            throw new BadRequestError('End date cannot be before start date.');
        }

        // 1. Calculate total scheduled classes for each subject in the period
        const totalScheduled = await timetableService.calculateScheduledClasses(input.streamId, startDate, endDate, userId);

        let entriesCreated = 0;
        // 2. Validate input and create BulkAttendanceEntry for each subject provided
        for (const [subjectName, attendedClasses] of Object.entries(input.attendance)) {
            const totalHeld = totalScheduled[subjectName];

            if (totalHeld === undefined) {
                console.warn(`Bulk entry provided for subject "${subjectName}" which had no scheduled classes in the period ${formatDate(startDate)} to ${formatDate(endDate)}.`);
                // Decide whether to skip or record with 0 totalHeld. Skipping seems safer.
                continue;
                // totalHeld = 0; // Or record it anyway
            }

            if (attendedClasses > totalHeld) {
                throw new BadRequestError(`Attended classes (${attendedClasses}) for subject "${subjectName}" cannot exceed total scheduled classes (${totalHeld}) in the period.`);
            }

            // TODO: Find course code if needed. Requires linking subject name back to timetable entry.
            // This might be tricky if multiple entries have the same name. Maybe store courseCode in input?
            const courseCode = null; // Placeholder

            await attendanceRepository.createBulkEntry({
                userId,
                streamId: input.streamId,
                subjectName,
                courseCode,
                attendedClasses,
                totalClasses: totalHeld, // Store the calculated total held classes
                startDate,
                endDate,
                // calculationDate is defaulted by Prisma
            });
            entriesCreated++;
        }

        if (entriesCreated === 0) {
            return { message: "No valid bulk attendance entries were created. Check if subjects were scheduled in the period.", entriesCreated };
        }

        return { message: `Successfully recorded bulk attendance for ${entriesCreated} subjects.`, entriesCreated };
    },
};