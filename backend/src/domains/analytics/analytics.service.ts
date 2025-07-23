import { attendanceRepository } from '../attendance/attendance.repository';
import { streamService } from '../stream/stream.service';
import {
    AttendanceCalculatorInput,
    StreamAnalyticsOutput,
    SubjectStatsOutput,
    AttendanceProjectionOutput,
} from './analytics.dto';
import { NotFoundError, BadRequestError } from '../../core/errors';
import {
    AttendanceStatus,
    Timetable,
    TimetableEntry,
    OverrideType,
    AttendanceRecord,
} from '@prisma/client';
import {
    normalizeDate,
    getDaysInInterval,
    getISODayOfWeek,
    formatDate,
    isDateInTimetableRange,
} from '../../core/utils';
import { addDays, isBefore, isPast, startOfToday} from 'date-fns';
import prisma from '../../infrastructure/prisma';
import { timetableService } from '../timetable/timetable.service';

type TimetableWithEntries = Timetable & { entries: TimetableEntry[] };

export const analyticsService = {
    async getStreamAttendanceStats(
        streamId: string,
        targetUserId: string,
        requestingUserId: string,
        startDateStr?: string,
        endDateStr?: string,
    ): Promise<StreamAnalyticsOutput> {
        console.log(`[Analytics Service BE] START getStreamAttendanceStats for stream ${streamId}, user ${targetUserId}`);
        await streamService.ensureMemberAccess(streamId, requestingUserId);

        let startDate: Date;
        let endDate: Date;

        if (endDateStr) {
            endDate = normalizeDate(endDateStr);
        } else {
            const mostRecentTimetable = await prisma.timetable.findFirst({
                where: { streamId: streamId },
                orderBy: { validFrom: 'desc' },
                select: { validUntil: true }
            });

            const today = normalizeDate(new Date());
            if (mostRecentTimetable?.validUntil && isPast(mostRecentTimetable.validUntil)) {
                endDate = normalizeDate(mostRecentTimetable.validUntil);
                console.log(`[Analytics Service BE] Using timetable end date as endDate: ${formatDate(endDate)}`);
            } else {
                endDate = today;
                console.log(`[Analytics Service BE] Using today as endDate: ${formatDate(endDate)}`);
            }
        }

        if (startDateStr) {
            startDate = normalizeDate(startDateStr);
        } else {
            const earliestTimetable = await prisma.timetable.findFirst({
                where: { streamId: streamId },
                orderBy: { validFrom: 'asc' },
                select: { validFrom: true }
            });

            if (earliestTimetable && earliestTimetable.validFrom) {
                startDate = normalizeDate(earliestTimetable.validFrom);
            } else {
                startDate = new Date(0);
            }
        }
        console.log(`[Analytics Service BE] Date range: ${formatDate(startDate)} to ${formatDate(endDate)}`);

        console.log(`[Analytics Service BE] Calculating scheduled classes count via timetableService...`);
        const scheduledCounts = await timetableService.calculateScheduledClasses(streamId, startDate, endDate, requestingUserId);

        const allSubjectNames = Object.keys(scheduledCounts);
        console.log(`[Analytics Service BE] Scheduled counts calculation complete. Subjects found: ${allSubjectNames.length}`);

        console.log(`[Analytics Service BE] Fetching attendance records...`);
        const records: AttendanceRecord[] =
            await attendanceRepository.findRecordsByUserAndDateRange(
                targetUserId,
                streamId,
                startDate,
                endDate,
            );
        console.log(`[Analytics Service BE] Fetching class overrides...`);
        const overrides = await attendanceRepository.findOverridesForWeek(
            streamId,
            startDate,
            endDate,
        );

        const cancelledCounts: Record<string, number> = {};
        const replacementCounts: Record<string, number> = {};
        const cancelledKeys = new Set<string>();

        overrides.forEach((ov) => {
            const dateStr = formatDate(ov.classDate);
            const timeStr = ov.originalStartTime || 'no-start';
            const originalKey = `${dateStr}_${ov.originalSubjectName}_${timeStr}`;

            if (ov.overrideType === OverrideType.CANCELLED) {
                if (!cancelledKeys.has(originalKey)) {
                    // Count distinct cancellations
                    cancelledCounts[ov.originalSubjectName] =
                        (cancelledCounts[ov.originalSubjectName] || 0) + 1;
                    cancelledKeys.add(originalKey);
                }
            } else if (ov.overrideType === OverrideType.REPLACED) {
                // Original counts as cancelled
                if (!cancelledKeys.has(originalKey)) {
                    cancelledCounts[ov.originalSubjectName] =
                        (cancelledCounts[ov.originalSubjectName] || 0) + 1;
                    cancelledKeys.add(originalKey);
                }
                // Replacement subject counts as an extra "held" instance
                if (ov.replacementSubjectName) {
                    replacementCounts[ov.replacementSubjectName] =
                        (replacementCounts[ov.replacementSubjectName] || 0) + 1;
                }
            }
        });

        console.log(`[Analytics Service BE] Calculating subject stats...`);
        const subjectStats: SubjectStatsOutput[] = [];
        let overallAttended = 0;
        let overallHeld = 0;

        for (const subjectName of allSubjectNames) {
            const totalScheduled = scheduledCounts[subjectName] || 0;
            const totalCancelled = cancelledCounts[subjectName] || 0;
            const totalTimesWasReplacement = replacementCounts[subjectName] || 0;
            const totalHeld = Math.max(0, totalScheduled - totalCancelled) + totalTimesWasReplacement;

            const subjectRecords = records.filter(r => r.subjectName === subjectName);
            const attended = subjectRecords.filter(r => r.status === AttendanceStatus.OCCURRED).length;
            const totalMarked = subjectRecords.filter(r => r.status === AttendanceStatus.OCCURRED || r.status === AttendanceStatus.CANCELLED).length;

            const attendancePercentage =
                totalHeld > 0 ? parseFloat(((attended / totalHeld) * 100).toFixed(2)) : null;

            subjectStats.push({
                subjectName,
                courseCode: null,
                totalScheduled,
                totalMarked,
                totalHeldClasses: totalHeld,
                attended,
                attendancePercentage,
            });

            overallAttended += attended;
            overallHeld += totalHeld;
        }

        const overallAttendancePercentage =
            overallHeld > 0 ? parseFloat(((overallAttended / overallHeld) * 100).toFixed(2)) : null;

        console.log(`[Analytics Service BE] Stats calculation complete. Returning result.`);
        return {
            streamId,
            userId: targetUserId,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            overallAttendancePercentage,
            totalAttendedClasses: overallAttended,
            totalHeldClasses: overallHeld,
            subjectStats,
        };
    },

    async calculateAttendanceProjection(
        input: AttendanceCalculatorInput,
        userId: string,
    ): Promise<AttendanceProjectionOutput> {
        console.log(`[Analytics Service BE] START calculateAttendanceProjection`);
        await streamService.ensureMemberAccess(input.streamId, userId);

        const today = startOfToday();
        const targetDate = normalizeDate(input.targetDate);

        if (isBefore(targetDate, today)) {
            throw new BadRequestError('Target date must be today or in the future.');
        }

        let currentAttended = 0;
        let currentHeld = 0;

        if (input.currentAttendedInput !== undefined && input.currentHeldInput !== undefined) {
            console.log(
                `[Analytics Service BE] Using provided manual counts: Attended=${input.currentAttendedInput}, Held=${input.currentHeldInput}`,
            );
            currentAttended = input.currentAttendedInput;
            currentHeld = input.currentHeldInput;
        } else {
            console.log(
                `[Analytics Service BE] No manual counts provided. Fetching current stats up to yesterday...`,
            );
            const yesterday = addDays(today, -1);
            try {
                // Call getStreamAttendanceStats to get historical data
                const currentStats = await this.getStreamAttendanceStats(
                    input.streamId,
                    userId,
                    userId,
                    undefined,
                    formatDate(yesterday),
                );

                if (input.subjectName) {
                    const subjectStat = currentStats.subjectStats.find(
                        (s) => s.subjectName === input.subjectName,
                    );
                    currentAttended = subjectStat?.attended ?? 0;
                    currentHeld = subjectStat?.totalHeldClasses ?? 0;
                    if (!subjectStat) {
                        console.log(
                            `[Analytics Service BE] Subject ${input.subjectName} not found in past stats (when fetching).`,
                        );
                    }
                } else {
                    currentAttended = currentStats.totalAttendedClasses;
                    currentHeld = currentStats.totalHeldClasses;
                }
            } catch (e) {
                if (e instanceof NotFoundError) {
                    console.log(
                        `[Analytics Service BE] NotFoundError fetching past stats: ${e.message}`,
                    );
                } else {
                    console.error(`[Analytics Service BE] Error fetching past stats:`, e);
                    throw e;
                }
            }
        }
        console.log(
            `[Analytics Service BE] Using for calculation: Attended=${currentAttended}, Held=${currentHeld}`,
        );

        // 2. Calculate future "Scheduled", "Cancelled", and "Replacements"
        console.log(`[Analytics Service BE] Calculating future schedule/overrides...`);
        let futureScheduled = 0;
        let futureCancelled = 0;
        let futureReplacements = 0;

        if (!isBefore(targetDate, today)) {
            const futureScheduledMap = await timetableService.calculateScheduledClasses(
                input.streamId, today, targetDate, userId
            );
            
            const futureOverrides = await attendanceRepository.findOverridesForWeek(
                input.streamId,
                today,
                targetDate,
            );
            const futureCancelledMap: Record<string, number> = {};
            const futureReplacementMap: Record<string, number> = {};
            const futureCancelledKeys = new Set<string>();

            futureOverrides.forEach((ov) => {
                const dateStr = formatDate(ov.classDate);
                const timeStr = ov.originalStartTime || 'no-start';
                const originalKey = `${dateStr}_${ov.originalSubjectName}_${timeStr}`;
                if (ov.overrideType === OverrideType.CANCELLED) {
                    if (!futureCancelledKeys.has(originalKey)) {
                        futureCancelledMap[ov.originalSubjectName] =
                            (futureCancelledMap[ov.originalSubjectName] || 0) + 1;
                        futureCancelledKeys.add(originalKey);
                    }
                } else if (ov.overrideType === OverrideType.REPLACED) {
                    if (!futureCancelledKeys.has(originalKey)) {
                        futureCancelledMap[ov.originalSubjectName] =
                            (futureCancelledMap[ov.originalSubjectName] || 0) + 1;
                        futureCancelledKeys.add(originalKey);
                    }
                    if (ov.replacementSubjectName) {
                        futureReplacementMap[ov.replacementSubjectName] =
                            (futureReplacementMap[ov.replacementSubjectName] || 0) + 1;
                    }
                }
            });

            if (input.subjectName) {
                futureScheduled = futureScheduledMap[input.subjectName] || 0;
                futureCancelled = futureCancelledMap[input.subjectName] || 0;
                futureReplacements = futureReplacementMap[input.subjectName] || 0;
            } else {
                futureScheduled = Object.values(futureScheduledMap).reduce(
                    (sum, count) => sum + count,
                    0,
                );
                futureCancelled = Object.values(futureCancelledMap).reduce(
                    (sum, count) => sum + count,
                    0,
                );
                futureReplacements = Object.values(futureReplacementMap).reduce(
                    (sum, count) => sum + count,
                    0,
                );
            }
        }
        console.log(
            `[Analytics Service BE] Future scheduled: ${futureScheduled}, Future cancelled: ${futureCancelled}, Future times as replacement: ${futureReplacements}`,
        );

        const futureHeld = Math.max(0, futureScheduled - futureCancelled) + futureReplacements;
        console.log(`[Analytics Service BE] Future held: ${futureHeld}`);

        // 3. Calculate projection (using currentHeld, futureHeld)
        console.log(`[Analytics Service BE] Calculating projection...`);
        const targetDecimal = input.targetPercentage / 100;
        const totalFutureHeldPotential = currentHeld + futureHeld;
        let neededToAttend = Math.ceil(targetDecimal * totalFutureHeldPotential - currentAttended);
        neededToAttend = Math.max(0, neededToAttend);
        const clampedNeededToAttend = Math.min(futureHeld, neededToAttend);
        const canSkip = futureHeld - clampedNeededToAttend;
        const currentPercentage =
            currentHeld > 0 ? parseFloat(((currentAttended / currentHeld) * 100).toFixed(2)) : null;
        let message = `To reach ${input.targetPercentage}% by ${formatDate(targetDate)}${input.subjectName ? ' for ' + input.subjectName : ''}: `;
        if (totalFutureHeldPotential <= 0) {
            message = `No classes ${input.subjectName ? 'for ' + input.subjectName + ' ' : ''}were held or are scheduled to be held by ${formatDate(targetDate)}. Cannot calculate percentage.`;
        } else if (neededToAttend > futureHeld) {
            const maxPossibleAttended = currentAttended + futureHeld;
            const maxPossiblePercentage = parseFloat(
                ((maxPossibleAttended / totalFutureHeldPotential) * 100).toFixed(2),
            );
            message = `Even if you attend all ${futureHeld} upcoming held classes, the maximum percentage you can reach by ${formatDate(targetDate)} is approximately ${maxPossiblePercentage.toFixed(1)}%. Your target of ${input.targetPercentage}% is unreachable in this period.`;
            neededToAttend = clampedNeededToAttend;
        } else if (
            clampedNeededToAttend <= 0 &&
            currentPercentage !== null &&
            currentPercentage >= input.targetPercentage
        ) {
            message += `you have already met or exceeded the target! You can skip all ${futureHeld} upcoming held classes.`;
            neededToAttend = 0;
        } else if (futureHeld === 0) {
            message = `No more classes are scheduled to be held${input.subjectName ? ' for ' + input.subjectName : ''} until ${formatDate(targetDate)}. Current percentage is ${currentPercentage ?? 'N/A'}%.`;
            neededToAttend = 0;
        } else {
            message += `you need to attend ${clampedNeededToAttend} out of the next ${futureHeld} held classes. You can skip ${canSkip} classes.`;
            neededToAttend = clampedNeededToAttend;
        }

        console.log(`[Analytics Service BE] Projection calculation complete.`);
        return {
            currentAttended,
            currentHeld: currentHeld,
            currentPercentage,
            futureHeld: futureHeld,
            targetPercentage: input.targetPercentage,
            neededToAttend: clampedNeededToAttend,
            canSkip,
            message,
        };
    },
};
