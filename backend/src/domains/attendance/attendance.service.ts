import { attendanceRepository } from './attendance.repository';
import { timetableService } from '../timetable/timetable.service';
import { streamService } from '../stream/stream.service';
import { MarkAttendanceInput, BulkAttendanceInput, AttendanceRecordOutput, ReplaceClassInput, CancelClassInput } from './attendance.dto';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../core/errors';
import { AttendanceRecord, AttendanceStatus, User } from '@prisma/client';
import { normalizeDate, getDaysInInterval, getISODayOfWeek, formatDate } from '../../core/utils';
import { parseISO } from 'date-fns';
import prisma from '../../infrastructure/prisma';
import { StreamMemberOutput } from '../stream/stream.dto';
import { WeeklyScheduleEntry as TimetableScheduleEntry } from '../timetable/timetable.service';

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
    isReplacement?: boolean;
    originalSubjectName?: string | null;
}

export const attendanceService = {
    // --- Mark Daily Attendance (Student Action) ---
    async markDailyAttendance(
        input: MarkAttendanceInput,
        userId: string,
    ): Promise<AttendanceRecordOutput> {
        await streamService.ensureMemberAccess(input.streamId, userId);
        const classDate = normalizeDate(input.classDate);

        // Optional: Prevent marking if class was globally cancelled
        // This requires fetching the status first, adding complexity.
        // Let's assume for now upsert handles overwriting if needed,
        // but ideally, UI prevents marking cancelled classes.

        // Allow only setting OCCURRED or MISSED by student
        if (
            input.status !== AttendanceStatus.OCCURRED &&
            input.status !== AttendanceStatus.MISSED
        ) {
            throw new BadRequestError('Invalid status. You can only mark as Attended or Missed.');
        }

        const record = await attendanceRepository.upsertRecord({
            userId: userId,
            streamId: input.streamId,
            subjectName: input.subjectName,
            courseCode: input.courseCode,
            classDate: classDate,
            status: input.status,
            // markedByUserId: userId, // Removed if column dropped
        });

        // Map to output DTO, converting dates to ISO strings
        return {
            id: record.id,
            userId: record.userId,
            streamId: record.streamId,
            subjectName: record.subjectName,
            courseCode: record.courseCode,
            classDate: record.classDate.toISOString(), // Convert Date
            status: record.status,
            markedAt: record.markedAt.toISOString(), // Convert Date
            isReplacement: record.isReplacement ?? false, // Default to false if null/undefined
            originalSubjectName: record.originalSubjectName ?? null, // Default to null
            originalCourseCode: record.originalCourseCode ?? null, // Default to null
            originalStartTime: record.originalStartTime ?? null, // Default to null
            originalEndTime: record.originalEndTime ?? null, // Default to null
        };
    },

    // --- Get Attendance Records (Ensure date mapping) ---
    async getAttendanceRecords(
        streamId: string,
        userId: string,
        filterUserId: string,
        startDate?: string,
        endDate?: string,
        subjectName?: string,
    ): Promise<AttendanceRecordOutput[]> {
        await streamService.ensureMemberAccess(streamId, filterUserId);
        const start = startDate ? normalizeDate(startDate) : new Date(0);
        const end = endDate ? normalizeDate(endDate) : new Date();
        const records = await attendanceRepository.findRecordsByUserAndDateRange(
            userId,
            streamId,
            start,
            end,
            subjectName,
        );
        // Map to output DTO, converting dates
        return records.map((record) => ({
            id: record.id,
            userId: record.userId,
            streamId: record.streamId,
            subjectName: record.subjectName,
            courseCode: record.courseCode,
            classDate: record.classDate.toISOString(), // Convert Date
            status: record.status,
            markedAt: record.markedAt.toISOString(), // Convert Date
            isReplacement: record.isReplacement ?? false,
            originalSubjectName: record.originalSubjectName ?? null,
            originalCourseCode: record.originalCourseCode ?? null,
            originalStartTime: record.originalStartTime ?? null,
            originalEndTime: record.originalEndTime ?? null,
        }));
    },

    // --- NEW: Get Weekly Attendance View ---
    async getWeeklyAttendanceView(streamId: string, startDateStr: string, endDateStr: string, userId: string): Promise<WeeklyAttendanceViewEntry[]> {
        await streamService.ensureMemberAccess(streamId, userId);
        const startDate = normalizeDate(startDateStr);
        const endDate = normalizeDate(endDateStr);

        // 1. Get base schedule
        const weeklySchedule: TimetableScheduleEntry[] = await timetableService.getWeeklySchedule(streamId, startDateStr, endDateStr, userId);

        // 2. Get user's records (Prisma should return objects including new optional fields)
        const userAttendanceRecords: AttendanceRecord[] = await attendanceRepository.findRecordsByUserAndDateRange(userId, streamId, startDate, endDate);

        // 3. Map records (Key: Date_SubjectName_IsReplacement)
        const recordsMap = new Map<string, AttendanceRecord>();
        userAttendanceRecords.forEach(rec => {
            const dateStr = formatDate(rec.classDate);
            // Use boolean directly in key
            const key = `${dateStr}_${rec.subjectName}_${rec.isReplacement}`;
            recordsMap.set(key, rec);
        });

        // 4. Process scheduled entries
        const finalViewEntries: WeeklyAttendanceViewEntry[] = [];
        for (const scheduledEntry of weeklySchedule) {
            // Key for the original scheduled item (isReplacement=false)
            const scheduleKey = `${scheduledEntry.date}_${scheduledEntry.subjectName}_false`;
            const userRecordForOriginal = recordsMap.get(scheduleKey);

            // Determine status based on record for the original slot
            const isGloballyCancelled = scheduledEntry.status === 'CANCELLED'; // Status from timetableService now reflects global cancellation
            let finalStatus: AttendanceStatus;

            if (isGloballyCancelled) {
                finalStatus = AttendanceStatus.CANCELLED;
            } else if (userRecordForOriginal) {
                finalStatus = userRecordForOriginal.status; // User's specific status (OCCURRED/MISSED)
            } else {
                finalStatus = AttendanceStatus.MISSED; // Default
            }

            finalViewEntries.push({
                date: scheduledEntry.date, dayOfWeek: scheduledEntry.dayOfWeek,
                subjectName: scheduledEntry.subjectName, courseCode: scheduledEntry.courseCode,
                startTime: scheduledEntry.startTime, endTime: scheduledEntry.endTime,
                status: finalStatus, recordId: userRecordForOriginal?.id,
                isReplacement: false, // This represents the original schedule slot
                originalSubjectName: null,
            });
        }

        // 5. Add standalone replacement records found for the user
        userAttendanceRecords.forEach(rec => {
            // Process only records marked as replacements
            if (rec.isReplacement) {
                const dateStr = formatDate(rec.classDate);
                // Check if we already added an entry for this exact replacement instance
                // (e.g., if multiple records existed somehow, though unlikely with unique constraint)
                const alreadyAdded = finalViewEntries.some(e =>
                    e.date === dateStr &&
                    e.subjectName === rec.subjectName &&
                    e.isReplacement === true &&
                    e.recordId === rec.id // Check recordId for uniqueness
                );

                if (!alreadyAdded) {
                     finalViewEntries.push({
                        date: dateStr,
                        dayOfWeek: getISODayOfWeek(rec.classDate),
                        subjectName: rec.subjectName, // Replacement subject
                        courseCode: rec.courseCode,
                        // Use original times stored on the replacement record
                        startTime: rec.originalStartTime ?? null, // Use ?? null for safety
                        endTime: rec.originalEndTime ?? null,   // Use ?? null for safety
                        status: rec.status, // Status of the replacement class (OCCURRED/MISSED)
                        recordId: rec.id,
                        isReplacement: true,
                        originalSubjectName: rec.originalSubjectName ?? null, // Use ?? null
                    });
                }
            }
        });

        // 6. Sort final viewEntries by date then time
        finalViewEntries.sort((a, b) => {
            const dateComparison = a.date.localeCompare(b.date);
            if (dateComparison !== 0) return dateComparison;
            // Sort by start time after comparing dates
            return (a.startTime || '99:99').localeCompare(b.startTime || '99:99'); // Ensure return value is number
        });

        return finalViewEntries;
    },

    // --- Cancel Class Globally ---
    async cancelClassGlobally(input: CancelClassInput, adminUserId: string): Promise<{ message: string; updatedCount: number }> {
        await streamService.ensureAdminAccess(input.streamId, adminUserId);
        const classDateNorm = normalizeDate(input.classDate);
        // Use the correct service method to get IDs
        const userIds = await streamService.getStreamMemberUserIds(input.streamId);
        if (userIds.length === 0) return { message: "No members found.", updatedCount: 0 };

        const updatedCount = await attendanceRepository.updateStatusForAllUsers(
            input.streamId, userIds, classDateNorm, input.subjectName, AttendanceStatus.CANCELLED
        );
        return { message: `Class cancelled. Status updated for ${updatedCount} students.`, updatedCount: updatedCount };
    },

    // --- NEW: Replace Class Globally (Admin Action - Option B Implementation) ---
    async replaceClassGlobally(
        input: ReplaceClassInput,
        adminUserId: string,
    ): Promise<{ message: string; updatedCount: number }> {
        console.log(`[Attendance Service BE] Attempting to replace class:`, input);
        await streamService.ensureAdminAccess(input.streamId, adminUserId);
        const classDateNorm = normalizeDate(input.classDate);

        // 1. Get user IDs
        const userIds = await streamService.getStreamMemberUserIds(input.streamId);
        if (userIds.length === 0) return { message: 'No members found.', updatedCount: 0 };

        // --- Use a Transaction ---
        let finalUpdatedCount = 0;
        try {
            await prisma.$transaction(async (tx) => {
                // 2. Mark original class as CANCELLED for all users (using upsert)
                console.log(
                    `[Replace] Marking original '${input.originalSubjectName}' as CANCELLED`,
                );
                let cancelledCount = 0;
                for (const userId of userIds) {
                    await tx.attendanceRecord.upsert({
                        where: {
                            userId_streamId_subjectName_classDate: {
                                userId,
                                streamId: input.streamId,
                                subjectName: input.originalSubjectName,
                                classDate: classDateNorm,
                            },
                        },
                        update: { status: AttendanceStatus.CANCELLED },
                        create: {
                            userId,
                            streamId: input.streamId,
                            subjectName: input.originalSubjectName,
                            classDate: classDateNorm,
                            status: AttendanceStatus.CANCELLED,
                            isReplacement: false,
                        },
                    });
                    cancelledCount++;
                }
                console.log(`[Replace] Marked original as CANCELLED for ${cancelledCount} users.`);

                // 3. Create NEW records for the REPLACEMENT class for all users (defaulting to MISSED)
                console.log(
                    `[Replace] Creating MISSED records for replacement '${input.replacementSubjectName}'`,
                );
                let createdCount = 0;
                for (const userId of userIds) {
                    // Use create - we assume no record exists for the replacement subject *as a replacement* on this date yet
                    // If duplicates are possible, use upsert carefully
                    await tx.attendanceRecord.create({
                        data: {
                            userId: userId,
                            streamId: input.streamId,
                            subjectName: input.replacementSubjectName, // New subject
                            courseCode: input.replacementCourseCode,
                            classDate: classDateNorm,
                            status: AttendanceStatus.MISSED, // Default replacement to MISSED
                            isReplacement: true,
                            originalSubjectName: input.originalSubjectName,
                            originalCourseCode: null, // TODO: Fetch original code if needed
                            originalStartTime: input.originalStartTime,
                            originalEndTime: null, // TODO: Fetch original end time if needed
                        },
                    });
                    createdCount++;
                }
                console.log(`[Replace] Created replacement records for ${createdCount} users.`);
                finalUpdatedCount = createdCount; // Or maybe cancelledCount? Define what count means.
            });

            // Invalidate caches (frontend handles this)
            return {
                message: `Class replaced. Original cancelled, replacement '${input.replacementSubjectName}' added for ${finalUpdatedCount} students.`,
                updatedCount: finalUpdatedCount,
            };
        } catch (error) {
            console.error('[Replace] Transaction failed.', { error, input });
            throw new Error('Failed to replace class due to a database error.'); // Throw generic error
        }
    },

    // --- Record Bulk Attendance (Fix field name) ---
    async recordBulkAttendance(
        input: BulkAttendanceInput,
        userId: string,
    ): Promise<{ message: string; entriesCreated: number }> {
        await streamService.ensureMemberAccess(input.streamId, userId);
        const startDate = normalizeDate(input.startDate);
        const endDate = input.endDate ? normalizeDate(input.endDate) : normalizeDate(new Date());
        if (endDate < startDate) throw new BadRequestError('End date cannot be before start date.');

        const scheduledCounts = await timetableService.calculateScheduledClasses(
            input.streamId,
            startDate,
            endDate,
            userId,
        );
        const cancelledCounts = await attendanceRepository.countCancelledClasses(
            input.streamId,
            startDate,
            endDate,
        );

        let entriesCreated = 0;
        for (const [subjectName, attendedClasses] of Object.entries(input.attendance)) {
            const totalScheduled = scheduledCounts[subjectName] || 0;
            const totalCancelled = cancelledCounts[subjectName] || 0;
            const totalHeld = Math.max(0, totalScheduled - totalCancelled);

            if (totalScheduled === 0) continue; // Skip if never scheduled
            if (attendedClasses > totalHeld) {
                throw new BadRequestError(
                    `Attended (${attendedClasses}) for "${subjectName}" exceeds Held (${totalHeld}) [Sch: ${totalScheduled}, Can: ${totalCancelled}].`,
                );
            }

            const courseCode = null; // Placeholder - need better way to get this

            await attendanceRepository.createBulkEntry({
                userId,
                streamId: input.streamId,
                subjectName,
                courseCode,
                attendedClasses,
                totalHeldClasses: totalHeld, // Use correct field name
                startDate,
                endDate,
            });
            entriesCreated++;
        }

        if (entriesCreated === 0)
            return { message: 'No valid bulk entries created.', entriesCreated };
        // Remove frontend queryClient call
        return {
            message: `Successfully recorded bulk attendance for ${entriesCreated} subjects.`,
            entriesCreated,
        };
    },
};
