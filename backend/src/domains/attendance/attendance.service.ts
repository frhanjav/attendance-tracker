import { attendanceRepository } from './attendance.repository';
import { timetableService, WeeklyScheduleEntry as TimetableScheduleEntry } from '../timetable/timetable.service'; // Use alias
import { streamService } from '../stream/stream.service';
import { StreamMemberOutput } from '../stream/stream.dto';
import { MarkAttendanceInput, BulkAttendanceInput, AttendanceRecordOutput, ReplaceClassInput, CancelClassInput } from './attendance.dto';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../core/errors';
import { AttendanceRecord, AttendanceStatus, User, ClassOverride, OverrideType } from '@prisma/client'; // Import OverrideType
import { normalizeDate, getDaysInInterval, getISODayOfWeek, formatDate } from '../../core/utils';
import { parseISO } from 'date-fns';
import prisma from '../../infrastructure/prisma';

// Type for the output of this service's function
export interface WeeklyAttendanceViewEntry {
    date: string; // YYYY-MM-DD
    dayOfWeek: number;
    subjectName: string;
    courseCode: string | null;
    startTime: string | null;
    endTime: string | null;
    status: AttendanceStatus;
    recordId?: string;
    isReplacement: boolean;
    originalSubjectName: string | null;
    isGloballyCancelled: boolean; // Explicit flag
}

export const attendanceService = {
    async markDailyAttendance(input: MarkAttendanceInput, userId: string): Promise<AttendanceRecordOutput> {
        await streamService.ensureMemberAccess(input.streamId, userId);
        const classDateNorm = normalizeDate(input.classDate);

        // Check for global override
        const override = await prisma.classOverride.findUnique({
             where: { streamId_classDate_originalSubjectName: { // Use updated unique constraint name
                 streamId: input.streamId, classDate: classDateNorm,
                 originalSubjectName: input.subjectName,
                 // originalStartTime: input.startTime || null // Remove if not part of key
             }}
        });

        if (override?.overrideType === OverrideType.CANCELLED) {
            throw new BadRequestError(`This class (${input.subjectName} on ${input.classDate}) was cancelled.`);
        }
        // If it was replaced, the student should mark attendance for the REPLACEMENT subject,
        // so prevent marking the original.
        if (override?.overrideType === OverrideType.REPLACED) {
             throw new BadRequestError(`This class (${input.subjectName} on ${input.classDate}) was replaced by ${override.replacementSubjectName}. Mark attendance for the replacement class.`);
        }

        if (input.status !== AttendanceStatus.OCCURRED && input.status !== AttendanceStatus.MISSED) {
             throw new BadRequestError("Invalid status.");
        }

        const record = await attendanceRepository.upsertRecord({
            userId: userId, streamId: input.streamId, subjectName: input.subjectName,
            courseCode: input.courseCode, classDate: classDateNorm, status: input.status,
        });

        // Map to output DTO
        return {
             id: record.id, userId: record.userId, streamId: record.streamId,
             subjectName: record.subjectName, courseCode: record.courseCode,
             classDate: record.classDate.toISOString(), status: record.status,
             markedAt: record.markedAt.toISOString(),
             // Add defaults for fields not on AttendanceRecord anymore
             isReplacement: false, originalSubjectName: null,
             originalCourseCode: null, originalStartTime: null, originalEndTime: null,
        };
    },

    async getAttendanceRecords(
        streamId: string, userId: string, filterUserId: string,
        startDate?: string, endDate?: string, subjectName?: string
    ): Promise<AttendanceRecordOutput[]> {
        await streamService.ensureMemberAccess(streamId, filterUserId);
        const start = startDate ? normalizeDate(startDate) : new Date(0);
        const end = endDate ? normalizeDate(endDate) : new Date();
        // Fetch records - repo now selects the new fields if they exist after migration/generate
        const records: AttendanceRecord[] = await attendanceRepository.findRecordsByUserAndDateRange(userId, streamId, start, end, subjectName);
        // Map to output DTO
        return records.map((record: AttendanceRecord) => ({ // Add explicit type
             id: record.id, userId: record.userId, streamId: record.streamId,
             subjectName: record.subjectName, courseCode: record.courseCode,
             classDate: record.classDate.toISOString(), status: record.status,
             markedAt: record.markedAt.toISOString(),
             // Map fields from record, provide defaults
             isReplacement: record.isReplacement ?? false,
             originalSubjectName: record.originalSubjectName ?? null,
             originalCourseCode: record.originalCourseCode ?? null,
             originalStartTime: record.originalStartTime ?? null,
             originalEndTime: record.originalEndTime ?? null,
        }));
    },

    async getWeeklyAttendanceView(streamId: string, startDateStr: string, endDateStr: string, userId: string): Promise<WeeklyAttendanceViewEntry[]> {
        await streamService.ensureMemberAccess(streamId, userId);
        const startDate = normalizeDate(startDateStr);
        const endDate = normalizeDate(endDateStr);
        const finalViewEntries: WeeklyAttendanceViewEntry[] = [];

        // 1. Get base schedule
        const weeklySchedule: TimetableScheduleEntry[] = await timetableService.getWeeklySchedule(streamId, startDateStr, endDateStr, userId);

        // 2. Get user's attendance records
        const userAttendanceRecords: AttendanceRecord[] = await attendanceRepository.findRecordsByUserAndDateRange(userId, streamId, startDate, endDate);
        const recordsMap = new Map<string, AttendanceRecord>(); // Key: Date_SubjectName
        userAttendanceRecords.forEach((rec: AttendanceRecord) => { // Add type
            const key = `${formatDate(rec.classDate)}_${rec.subjectName}`;
            recordsMap.set(key, rec);
        });

        // 3. Get ALL overrides for the week
        const overrides = await attendanceRepository.findOverridesForWeek(streamId, startDate, endDate);
        const overrideMap = new Map<string, ClassOverride>(); // Key: Date_OriginalSubjectName_OriginalStartTime
        overrides.forEach(ov => {
            const key = `${formatDate(ov.classDate)}_${ov.originalSubjectName}_${ov.originalStartTime || 'no-start'}`;
            overrideMap.set(key, ov);
        });

        // 4. Process scheduled entries and apply overrides/user status
        for (const scheduledEntry of weeklySchedule) {
            const dateStr = scheduledEntry.date;
            const timeStr = scheduledEntry.startTime || 'no-start';
            const overrideKey = `${dateStr}_${scheduledEntry.subjectName}_${timeStr}`;
            const override = overrideMap.get(overrideKey);

            const isGloballyCancelled = override?.overrideType === OverrideType.CANCELLED;
            const isReplaced = override?.overrideType === OverrideType.REPLACED;

            if (isReplaced && override && override.replacementSubjectName) {
                // --- Handle Replaced Slot ---
                // a) Add original as CANCELLED
                finalViewEntries.push({
                    date: scheduledEntry.date, dayOfWeek: scheduledEntry.dayOfWeek,
                    subjectName: scheduledEntry.subjectName, courseCode: scheduledEntry.courseCode,
                    startTime: scheduledEntry.startTime, endTime: scheduledEntry.endTime,
                    status: AttendanceStatus.CANCELLED, // Mark original as cancelled
                    recordId: undefined, // No user record for this view of original
                    isReplacement: false, originalSubjectName: null,
                    isGloballyCancelled: true, // Indicate it was overridden
                });
                // b) Add the REPLACEMENT class
                const replacementKey = `${dateStr}_${override.replacementSubjectName}`; // Key for user's record
                const userRecordForReplacement = recordsMap.get(replacementKey);
                finalViewEntries.push({
                    date: dateStr, dayOfWeek: scheduledEntry.dayOfWeek,
                    subjectName: override.replacementSubjectName,
                    courseCode: override.replacementCourseCode,
                    startTime: override.replacementStartTime ?? scheduledEntry.startTime,
                    endTime: override.replacementEndTime ?? scheduledEntry.endTime,
                    status: userRecordForReplacement?.status ?? AttendanceStatus.MISSED, // User's status for replacement
                    recordId: userRecordForReplacement?.id,
                    isReplacement: true, // Mark as replacement
                    originalSubjectName: scheduledEntry.subjectName,
                    isGloballyCancelled: false,
                });
            } else {
                // --- Handle Non-Replaced Slot (Scheduled or Cancelled) ---
                const userRecordKey = `${dateStr}_${scheduledEntry.subjectName}`;
                const userRecord = recordsMap.get(userRecordKey);
                let finalStatus: AttendanceStatus;

                if (isGloballyCancelled) {
                    finalStatus = AttendanceStatus.CANCELLED;
                } else if (userRecord) {
                    finalStatus = userRecord.status;
                } else {
                    finalStatus = AttendanceStatus.MISSED;
                }

                finalViewEntries.push({
                    ...scheduledEntry, // Spread base schedule info
                    status: finalStatus,
                    recordId: userRecord?.id,
                    isReplacement: false,
                    originalSubjectName: null,
                    isGloballyCancelled: isGloballyCancelled,
                });
            }
        }

        // 5. Sort final viewEntries
        finalViewEntries.sort((a, b) => {
            const dateComparison = a.date.localeCompare(b.date);
            if (dateComparison !== 0) return dateComparison;
            return (a.startTime || '99:99').localeCompare(b.startTime || '99:99'); // Return number
        });

        return finalViewEntries;
    },

    // --- Cancel Class Globally ---
    async cancelClassGlobally(input: CancelClassInput, adminUserId: string): Promise<{ message: string; updatedCount: number }> {
        await streamService.ensureAdminAccess(input.streamId, adminUserId);
        const classDateNorm = normalizeDate(input.classDate);

        await attendanceRepository.createOrUpdateClassOverride({
            streamId: input.streamId, classDate: classDateNorm,
            originalSubjectName: input.subjectName, originalStartTime: input.startTime || null,
            overrideType: OverrideType.CANCELLED, adminUserId: adminUserId,
            replacementSubjectName: null, replacementCourseCode: null,
            replacementStartTime: null, replacementEndTime: null,
        });
        // No need to update individual records anymore with this model
        return { message: `Class cancellation recorded for ${input.subjectName} on ${input.classDate}.`, updatedCount: 1 };
    },

    // --- Replace Class Globally ---
    async replaceClassGlobally(input: ReplaceClassInput, adminUserId: string): Promise<{ message: string; updatedCount: number }> {
        await streamService.ensureAdminAccess(input.streamId, adminUserId);
        const classDateNorm = normalizeDate(input.classDate);

        // 1. Create/Update the override record
        await attendanceRepository.createOrUpdateClassOverride({
            streamId: input.streamId, classDate: classDateNorm,
            originalSubjectName: input.originalSubjectName, 
            originalStartTime: input.originalStartTime ?? null,
            overrideType: OverrideType.REPLACED, adminUserId: adminUserId,
            replacementSubjectName: input.replacementSubjectName,
            replacementCourseCode: input.replacementCourseCode ?? null,
            replacementStartTime: input.replacementStartTime ?? null,
            replacementEndTime: input.replacementEndTime ?? null,
        });

        // 2. Create initial MISSED records for the replacement class for all users
        const userIds = await streamService.getStreamMemberUserIds(input.streamId);
        let createdCount = 0;
        for (const userId of userIds) {
             try {
                 // Use create - if a record for the replacement subject already exists (e.g. from previous manual marking)
                 // this might fail. Consider upsert if needed, but create is simpler.
                 await prisma.attendanceRecord.create({
                     data: {
                         userId, streamId: input.streamId,
                         subjectName: input.replacementSubjectName, // Use replacement subject
                         courseCode: input.replacementCourseCode ?? null,
                         classDate: classDateNorm,
                         status: AttendanceStatus.MISSED, // Default to missed
                         // No replacement fields needed on AttendanceRecord anymore
                     }
                 });
                 createdCount++;
             } catch (e: any) {
                if (e.code !== 'P2002') {
                    console.error("Failed to create initial replacement record", {
                        err: e,
                        userId,
                        input
                    });
                } else {
                    console.warn("Replacement record already existed for user.", {
                        userId,
                        input
                    });
                }
            }
        }
        return { message: `Class replacement recorded. Initial records created/found for ${userIds.length} students.`, updatedCount: userIds.length };
    },

    // --- Record Bulk Attendance ---
    async recordBulkAttendance(input: BulkAttendanceInput, userId: string): Promise<{ message: string, entriesCreated: number }> {
        await streamService.ensureMemberAccess(input.streamId, userId);
        const startDate = normalizeDate(input.startDate);
        const endDate = input.endDate ? normalizeDate(input.endDate) : normalizeDate(new Date());
        if (endDate < startDate) throw new BadRequestError('End date cannot be before start date.');

        // 1. Calculate total scheduled classes
        const scheduledCounts = await timetableService.calculateScheduledClasses(input.streamId, startDate, endDate, userId);

        // 2. Fetch Overrides for the period
        const overrides = await attendanceRepository.findOverridesForWeek(input.streamId, startDate, endDate);
        const cancelledCounts: Record<string, number> = {};
        const replacementCounts: Record<string, number> = {}; // Counts times a subject WAS a replacement

        overrides.forEach(ov => {
            // Key uses original subject name for cancellation counting
            const originalSubjectKey = ov.originalSubjectName;
            if (ov.overrideType === OverrideType.CANCELLED) {
                cancelledCounts[originalSubjectKey] = (cancelledCounts[originalSubjectKey] || 0) + 1;
            } else if (ov.overrideType === OverrideType.REPLACED) {
                // Original subject counts as cancelled
                cancelledCounts[originalSubjectKey] = (cancelledCounts[originalSubjectKey] || 0) + 1;
                // Replacement subject counts as an extra "held" class
                if (ov.replacementSubjectName) {
                     replacementCounts[ov.replacementSubjectName] = (replacementCounts[ov.replacementSubjectName] || 0) + 1;
                }
            }
        });

        let entriesCreated = 0;
        // Use Object.entries correctly
        for (const [subjectName, attendedInput] of Object.entries(input.attendance)) {
             const attendedClasses = Number(attendedInput);
             if (isNaN(attendedClasses)) continue;

            const totalScheduled = scheduledCounts[subjectName] || 0;
            const totalCancelled = cancelledCounts[subjectName] || 0;
            const totalTimesWasReplacement = replacementCounts[subjectName] || 0;
            const totalHeld = Math.max(0, totalScheduled - totalCancelled) + totalTimesWasReplacement;

            if (totalScheduled === 0 && totalTimesWasReplacement === 0) continue;
            if (attendedClasses > totalHeld) {
                throw new BadRequestError(`Attended (${attendedClasses}) for "${subjectName}" exceeds Held (${totalHeld}) [Sch: ${totalScheduled}, Can: ${totalCancelled}, Rep: ${totalTimesWasReplacement}].`);
            }

            const courseCode = null; // Placeholder

            await attendanceRepository.createBulkEntry({
                userId, streamId: input.streamId, subjectName, courseCode,
                attendedClasses,
                totalHeldClasses: totalHeld, // Use correct field name (ensure it's Int? or Int in schema)
                startDate, endDate,
            });
            entriesCreated++;
        }

        if (entriesCreated === 0) return { message: "No valid bulk entries created.", entriesCreated };
        return { message: `Successfully recorded bulk attendance for ${entriesCreated} subjects.`, entriesCreated };
    },
};