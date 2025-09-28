import { AttendanceRecord, AttendanceStatus, ClassOverride, OverrideType } from '@prisma/client';
import { assignConsistentIndices } from '../../core/entryIndexing';
import { BadRequestError } from '../../core/errors';
import { formatDate, getDaysInInterval, getISODayOfWeek, normalizeDate } from '../../core/utils';
import prisma from '../../infrastructure/prisma';
import { streamService } from '../stream/stream.service';
import { timetableService } from '../timetable/timetable.service';
import { AddSubjectInput, AttendanceRecordOutput, BulkAttendanceInput, CancelClassInput, MarkAttendanceInput, ReplaceClassInput } from './attendance.dto';
import { attendanceRepository } from './attendance.repository';

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
    isAdded?: boolean;
    subjectIndex?: number;
}

export const attendanceService = {
    async markDailyAttendance(input: MarkAttendanceInput, userId: string): Promise<AttendanceRecordOutput> {
        await streamService.ensureMemberAccess(input.streamId, userId);
        const classDateNorm = normalizeDate(input.classDate);

        const override = await prisma.classOverride.findUnique({
             where: { streamId_classDate_originalSubjectName_entryIndex: {
                 streamId: input.streamId, classDate: classDateNorm,
                 originalSubjectName: input.subjectName, entryIndex: input.subjectIndex,
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
            subjectIndex: input.subjectIndex,
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

        const [weeklySchedule, attendanceData] = await Promise.all([
            timetableService.getWeeklySchedule(streamId, startDateStr, endDateStr, userId),
            attendanceRepository.getWeeklyAttendanceData(userId, streamId, startDate, endDate)
        ]);

        const { attendanceRecords: userAttendanceRecords, overrides } = attendanceData;

        const recordsMap = new Map<string, AttendanceRecord>();
        userAttendanceRecords.forEach((rec: AttendanceRecord) => {
            const key = `${formatDate(rec.classDate)}_${rec.subjectName}_${rec.subjectIndex}`;
            recordsMap.set(key, rec);
        });
        const indexedSchedule = assignConsistentIndices(weeklySchedule);

        const overrideMap = new Map<string, ClassOverride>();

        overrides.forEach(ov => {
            const key = `${formatDate(ov.classDate)}_${ov.originalSubjectName}_${ov.originalStartTime || 'no-start'}_${ov.entryIndex}`;
            overrideMap.set(key, ov);
        });

        for (const scheduledEntry of indexedSchedule) {
            const dateStr = scheduledEntry.date;
            const timeStr = scheduledEntry.startTime || 'no-start';
            const overrideKey = `${dateStr}_${scheduledEntry.subjectName}_${timeStr}_${scheduledEntry.subjectIndex}`;
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
                    isAdded: false,
                    subjectIndex: scheduledEntry.subjectIndex,
                });

                const replacementRecord = userAttendanceRecords.find(r =>
                    formatDate(r.classDate) === dateStr &&
                    r.subjectName === override.replacementSubjectName &&
                    r.isReplacement &&
                    r.originalSubjectName === scheduledEntry.subjectName
                );

                const replacementKey = replacementRecord
                    ? `${dateStr}_${override.replacementSubjectName}_${replacementRecord.subjectIndex}`
                    : `${dateStr}_${override.replacementSubjectName}_${scheduledEntry.subjectIndex}`; // fallback

                const userRecordForReplacement = recordsMap.get(replacementKey);

                const replacementEntry = {
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
                    isAdded: false,
                    subjectIndex: replacementRecord?.subjectIndex ?? scheduledEntry.subjectIndex,
                };

                finalViewEntries.push(replacementEntry);

            } else {
                const userRecordKey = `${dateStr}_${scheduledEntry.subjectName}_${scheduledEntry.subjectIndex}`;
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
                    isAdded: false,
                });
            }
        }

        const daysInWeek = getDaysInInterval(startDate, endDate);
        for (const override of overrides) {
            if (override.overrideType === OverrideType.ADDED && override.replacementSubjectName) {
                const dateStr = formatDate(override.classDate);
                const dayOfWeek = getISODayOfWeek(override.classDate);
                
                if (daysInWeek.some(d => formatDate(d) === dateStr)) {
                    const userRecordKey = `${dateStr}_${override.replacementSubjectName}_${override.entryIndex}`;
                    const userRecord = recordsMap.get(userRecordKey);
                    
                    finalViewEntries.push({
                        date: dateStr,
                        dayOfWeek: dayOfWeek,
                        subjectName: override.replacementSubjectName,
                        courseCode: override.replacementCourseCode,
                        startTime: override.replacementStartTime,
                        endTime: override.replacementEndTime,
                        status: userRecord?.status ?? AttendanceStatus.MISSED,
                        recordId: userRecord?.id,
                        isReplacement: false,
                        originalSubjectName: null,
                        isGloballyCancelled: false,
                        isAdded: true,
                        subjectIndex: override.entryIndex,
                    });
                }
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
            entryIndex: input.entryIndex,
            overrideType: OverrideType.CANCELLED, adminUserId: adminUserId,
            replacementSubjectName: null, replacementCourseCode: null,
            replacementStartTime: null, replacementEndTime: null,
        });
        return { message: `Class cancellation recorded for ${input.subjectName} on ${input.classDate}.`, updatedCount: 1 };
    },

    async replaceClassGlobally(input: ReplaceClassInput, adminUserId: string): Promise<{ message: string; updatedCount: number; replacementSubjectIndex: number }> {
        await streamService.ensureAdminAccess(input.streamId, adminUserId);
        const classDateNorm = normalizeDate(input.classDate);

        await attendanceRepository.createOrUpdateClassOverride({
            streamId: input.streamId, classDate: classDateNorm,
            originalSubjectName: input.originalSubjectName,
            originalStartTime: input.originalStartTime ?? null,
            entryIndex: input.entryIndex,
            overrideType: OverrideType.REPLACED, adminUserId: adminUserId,
            replacementSubjectName: input.replacementSubjectName,
            replacementCourseCode: input.replacementCourseCode ?? null,
            replacementStartTime: input.replacementStartTime ?? null,
            replacementEndTime: input.replacementEndTime ?? null,
        });

        const existingReplacementRecords = await prisma.attendanceRecord.findMany({
            where: {
                streamId: input.streamId,
                classDate: classDateNorm,
                subjectName: input.replacementSubjectName,
            },
            select: { subjectIndex: true }
        });

        const existingIndices = existingReplacementRecords.map(r => r.subjectIndex);
        const nextReplacementIndex = existingIndices.length > 0 ? Math.max(...existingIndices) + 1 : 0;

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
                         subjectIndex: nextReplacementIndex,
                         isReplacement: true,
                         originalSubjectName: input.originalSubjectName,
                         originalStartTime: input.originalStartTime,
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
        return {
            message: `Class replacement recorded. Initial records created/found for ${userIds.length} students.`,
            updatedCount: userIds.length,
            replacementSubjectIndex: nextReplacementIndex
        };
    },

    async addSubjectGlobally(input: AddSubjectInput, adminUserId: string): Promise<{ message: string; updatedCount: number }> {
        await streamService.ensureAdminAccess(input.streamId, adminUserId);
        const classDateNorm = normalizeDate(input.classDate);

        await attendanceRepository.createOrUpdateClassOverride({
            streamId: input.streamId,
            classDate: classDateNorm,
            originalSubjectName: input.subjectName,
            originalStartTime: input.startTime ?? null,
            entryIndex: input.entryIndex,
            overrideType: OverrideType.ADDED,
            adminUserId: adminUserId,
            replacementSubjectName: input.subjectName,
            replacementCourseCode: input.courseCode ?? null,
            replacementStartTime: input.startTime ?? null,
            replacementEndTime: input.endTime ?? null,
        });

        const userIds = await streamService.getStreamMemberUserIds(input.streamId);
        let createdCount = 0;
        for (const userId of userIds) {
            try {
                await prisma.attendanceRecord.create({
                    data: {
                        userId,
                        streamId: input.streamId,
                        subjectName: input.subjectName,
                        courseCode: input.courseCode ?? null,
                        classDate: classDateNorm,
                        status: AttendanceStatus.MISSED,
                        subjectIndex: input.entryIndex,
                        isReplacement: false,
                    }
                });
                createdCount++;
            } catch (e: any) {
                if (e.code !== 'P2002') {
                    console.error("Failed to create initial added subject record", {
                        err: e,
                        userId,
                        input
                    });
                } else {
                    console.warn("Added subject record already existed for user.", {
                        userId,
                        input
                    });
                }
            }
        }
        return { message: `Added subject recorded. Initial records created/found for ${userIds.length} students.`, updatedCount: userIds.length };
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
            } else if (ov.overrideType === OverrideType.ADDED) {
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