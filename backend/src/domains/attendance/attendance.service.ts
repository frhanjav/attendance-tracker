import { attendanceRepository } from './attendance.repository';
import { timetableService, WeeklyScheduleEntry as TimetableScheduleEntry } from '../timetable/timetable.service';
import { streamService } from '../stream/stream.service';
import { MarkAttendanceInput, BulkAttendanceInput, AttendanceRecordOutput, ReplaceClassInput, CancelClassInput } from './attendance.dto';
import { BadRequestError } from '../../core/errors';
import { AttendanceRecord, AttendanceStatus, ClassOverride, OverrideType } from '@prisma/client';
import { normalizeDate, formatDate } from '../../core/utils';
import prisma from '../../infrastructure/prisma';

export interface WeeklyAttendanceViewEntry {
    date: string;
    dayOfWeek: number;
    subjectName: string;
    courseCode: string | null;
    startTime: string | null;
    endTime: string | null;
    status: AttendanceStatus;
    recordId?: string;
    isReplacement: boolean;
    originalSubjectName: string | null;
    isGloballyCancelled: boolean;
}

export const attendanceService = {
    async markDailyAttendance(input: MarkAttendanceInput, userId: string): Promise<AttendanceRecordOutput> {
        await streamService.ensureMemberAccess(input.streamId, userId);
        const classDateNorm = normalizeDate(input.classDate);

        const override = await prisma.classOverride.findUnique({
             where: { streamId_classDate_originalSubjectName: {
                 streamId: input.streamId, classDate: classDateNorm,
                 originalSubjectName: input.subjectName,
             }}
        });

        if (override?.overrideType === OverrideType.CANCELLED) {
            throw new BadRequestError(`This class (${input.subjectName} on ${input.classDate}) was cancelled.`);
        }
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

        return {
             id: record.id, userId: record.userId, streamId: record.streamId,
             subjectName: record.subjectName, courseCode: record.courseCode,
             classDate: record.classDate.toISOString(), status: record.status,
             markedAt: record.markedAt.toISOString(),
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
        const records: AttendanceRecord[] = await attendanceRepository.findRecordsByUserAndDateRange(userId, streamId, start, end, subjectName);

        return records.map((record: AttendanceRecord) => ({
             id: record.id, userId: record.userId, streamId: record.streamId,
             subjectName: record.subjectName, courseCode: record.courseCode,
             classDate: record.classDate.toISOString(), status: record.status,
             markedAt: record.markedAt.toISOString(),
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

        const weeklySchedule: TimetableScheduleEntry[] = await timetableService.getWeeklySchedule(streamId, startDateStr, endDateStr, userId);

        const userAttendanceRecords: AttendanceRecord[] = await attendanceRepository.findRecordsByUserAndDateRange(userId, streamId, startDate, endDate);
        const recordsMap = new Map<string, AttendanceRecord>();
        userAttendanceRecords.forEach((rec: AttendanceRecord) => {
            const key = `${formatDate(rec.classDate)}_${rec.subjectName}`;
            recordsMap.set(key, rec);
        });

        const overrides = await attendanceRepository.findOverridesForWeek(streamId, startDate, endDate);
        const overrideMap = new Map<string, ClassOverride>();
        overrides.forEach(ov => {
            const key = `${formatDate(ov.classDate)}_${ov.originalSubjectName}_${ov.originalStartTime || 'no-start'}`;
            overrideMap.set(key, ov);
        });

        for (const scheduledEntry of weeklySchedule) {
            const dateStr = scheduledEntry.date;
            const timeStr = scheduledEntry.startTime || 'no-start';
            const overrideKey = `${dateStr}_${scheduledEntry.subjectName}_${timeStr}`;
            const override = overrideMap.get(overrideKey);

            const isGloballyCancelled = override?.overrideType === OverrideType.CANCELLED;
            const isReplaced = override?.overrideType === OverrideType.REPLACED;

            if (isReplaced && override && override.replacementSubjectName) {
                finalViewEntries.push({
                    date: scheduledEntry.date, dayOfWeek: scheduledEntry.dayOfWeek,
                    subjectName: scheduledEntry.subjectName, courseCode: scheduledEntry.courseCode,
                    startTime: scheduledEntry.startTime, endTime: scheduledEntry.endTime,
                    status: AttendanceStatus.CANCELLED,
                    recordId: undefined,
                    isReplacement: false, originalSubjectName: null,
                    isGloballyCancelled: true,
                });

                const replacementKey = `${dateStr}_${override.replacementSubjectName}`;
                const userRecordForReplacement = recordsMap.get(replacementKey);
                finalViewEntries.push({
                    date: dateStr, dayOfWeek: scheduledEntry.dayOfWeek,
                    subjectName: override.replacementSubjectName,
                    courseCode: override.replacementCourseCode,
                    startTime: override.replacementStartTime ?? scheduledEntry.startTime,
                    endTime: override.replacementEndTime ?? scheduledEntry.endTime,
                    status: userRecordForReplacement?.status ?? AttendanceStatus.MISSED,
                    recordId: userRecordForReplacement?.id,
                    isReplacement: true,
                    originalSubjectName: scheduledEntry.subjectName,
                    isGloballyCancelled: false,
                });
            } else {
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
                    ...scheduledEntry,
                    status: finalStatus,
                    recordId: userRecord?.id,
                    isReplacement: false,
                    originalSubjectName: null,
                    isGloballyCancelled: isGloballyCancelled,
                });
            }
        }

        finalViewEntries.sort((a, b) => {
            const dateComparison = a.date.localeCompare(b.date);
            if (dateComparison !== 0) return dateComparison;
            return (a.startTime || '99:99').localeCompare(b.startTime || '99:99');
        });

        return finalViewEntries;
    },

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
        return { message: `Class cancellation recorded for ${input.subjectName} on ${input.classDate}.`, updatedCount: 1 };
    },

    async replaceClassGlobally(input: ReplaceClassInput, adminUserId: string): Promise<{ message: string; updatedCount: number }> {
        await streamService.ensureAdminAccess(input.streamId, adminUserId);
        const classDateNorm = normalizeDate(input.classDate);

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

        const userIds = await streamService.getStreamMemberUserIds(input.streamId);
        let createdCount = 0;
        for (const userId of userIds) {
             try {
                 await prisma.attendanceRecord.create({
                     data: {
                         userId, streamId: input.streamId,
                         subjectName: input.replacementSubjectName,
                         courseCode: input.replacementCourseCode ?? null,
                         classDate: classDateNorm,
                         status: AttendanceStatus.MISSED,
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

    async recordBulkAttendance(input: BulkAttendanceInput, userId: string): Promise<{ message: string, entriesCreated: number }> {
        await streamService.ensureMemberAccess(input.streamId, userId);
        const startDate = normalizeDate(input.startDate);
        const endDate = input.endDate ? normalizeDate(input.endDate) : normalizeDate(new Date());
        if (endDate < startDate) throw new BadRequestError('End date cannot be before start date.');

        const scheduledCounts = await timetableService.calculateScheduledClasses(input.streamId, startDate, endDate, userId);

        const overrides = await attendanceRepository.findOverridesForWeek(input.streamId, startDate, endDate);
        const cancelledCounts: Record<string, number> = {};
        const replacementCounts: Record<string, number> = {};

        overrides.forEach(ov => {
            const originalSubjectKey = ov.originalSubjectName;
            if (ov.overrideType === OverrideType.CANCELLED) {
                cancelledCounts[originalSubjectKey] = (cancelledCounts[originalSubjectKey] || 0) + 1;
            } else if (ov.overrideType === OverrideType.REPLACED) {
                cancelledCounts[originalSubjectKey] = (cancelledCounts[originalSubjectKey] || 0) + 1;
                if (ov.replacementSubjectName) {
                     replacementCounts[ov.replacementSubjectName] = (replacementCounts[ov.replacementSubjectName] || 0) + 1;
                }
            }
        });

        let entriesCreated = 0;
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

            const courseCode = null;

            await attendanceRepository.createBulkEntry({
                userId, streamId: input.streamId, subjectName, courseCode,
                attendedClasses,
                totalHeldClasses: totalHeld,
                startDate, endDate,
            });
            entriesCreated++;
        }

        if (entriesCreated === 0) return { message: "No valid bulk entries created.", entriesCreated };
        return { message: `Successfully recorded bulk attendance for ${entriesCreated} subjects.`, entriesCreated };
    },
};