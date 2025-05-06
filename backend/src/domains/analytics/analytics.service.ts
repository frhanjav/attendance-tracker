// backend/src/domains/analytics/analytics.service.ts

import { attendanceRepository } from '../attendance/attendance.repository';
import { streamService } from '../stream/stream.service';
// Import DTOs and ensure field names match (e.g., totalHeldClasses)
import {
    AttendanceCalculatorInput,
    StreamAnalyticsOutput,
    SubjectStatsOutput,
    AttendanceProjectionOutput,
} from './analytics.dto';
import { NotFoundError, BadRequestError } from '../../core/errors';
// Import needed Prisma types, including ClassOverride and OverrideType
import {
    AttendanceStatus,
    Timetable,
    TimetableEntry,
    ClassOverride,
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
import { addDays, isBefore, startOfToday, parseISO } from 'date-fns';
import prisma from '../../infrastructure/prisma';

type TimetableWithEntries = Timetable & { entries: TimetableEntry[] };

export const analyticsService = {
    /**
     * Calculates detailed attendance statistics for a user in a stream.
     * Optimized to fetch data efficiently.
     */
    async getStreamAttendanceStats(
        streamId: string,
        targetUserId: string,
        requestingUserId: string,
        startDateStr?: string,
        endDateStr?: string,
    ): Promise<StreamAnalyticsOutput> {
        const logCtx = { streamId, targetUserId, requestingUserId, startDateStr, endDateStr };
        console.log(`[Analytics Service BE] START getStreamAttendanceStats`, logCtx);
        await streamService.ensureMemberAccess(streamId, requestingUserId);

        let startDate: Date;
        const endDate = endDateStr ? normalizeDate(endDateStr) : normalizeDate(new Date());

        // --- Determine Start Date ---
        if (startDateStr) {
            // If a specific start date is provided (e.g., for projection's past stats), use it.
            startDate = normalizeDate(startDateStr);
            // console.log(`[Analytics Service BE] Using provided startDate: ${formatDate(startDate)}`); // Removed logger
        } else {
            // If no startDateStr is provided (e.g., when AnalyticsPage calls this directly),
            // find the earliest timetable's validFrom date for this stream.
            // console.log(`[Analytics Service BE] No startDateStr provided. Finding earliest timetable for stream ${streamId}...`); // Removed logger
            const earliestTimetable = await prisma.timetable.findFirst({
                where: { streamId: streamId },
                orderBy: { validFrom: 'asc' },
                select: { validFrom: true }
            });

            if (earliestTimetable && earliestTimetable.validFrom) {
                startDate = normalizeDate(earliestTimetable.validFrom);
                // console.log(`[Analytics Service BE] Found earliest timetable start: ${formatDate(startDate)}`); // Removed logger
            } else {
                // Fallback ONLY if no timetables exist for the stream at all.
                // This would mean no scheduled classes, so stats would be 0.
                // console.log(`[Analytics Service BE] No timetables found for stream. Defaulting startDate to epoch.`); // Removed logger
                startDate = new Date(0); // Unix Epoch (Jan 01, 1970)
            }
        }

        // --- Fetch potentially active timetables ONCE ---
        console.log(`[Analytics Service BE] Fetching potentially active timetables...`, logCtx);
        const potentiallyActiveTimetables: TimetableWithEntries[] = await prisma.timetable.findMany(
            {
                where: {
                    streamId,
                    validFrom: { lte: endDate },
                    OR: [{ validUntil: null }, { validUntil: { gte: startDate } }],
                },
                include: { entries: true },
                orderBy: { validFrom: 'desc' },
            },
        );
        console.log(`[Analytics Service BE] Found potentially active timetables.`, {
            ...logCtx,
            count: potentiallyActiveTimetables.length,
        });

        // --- Calculate scheduled counts and gather subject details ONCE ---
        console.log(`[Analytics Service BE] Calculating scheduled classes count...`, logCtx);
        const scheduledCounts: Record<string, number> = {};
        const subjectDetailsMap: Map<string, { subjectName: string; courseCode?: string | null }> =
            new Map();
        const days = getDaysInInterval(startDate, endDate);
        for (const day of days) {
            const activeTimetable = potentiallyActiveTimetables.find((tt) =>
                isDateInTimetableRange(day, tt.validFrom, tt.validUntil),
            );
            if (activeTimetable) {
                const dayOfWeek = getISODayOfWeek(day);
                activeTimetable.entries
                    .filter((entry) => entry.dayOfWeek === dayOfWeek)
                    .forEach((entry) => {
                        scheduledCounts[entry.subjectName] =
                            (scheduledCounts[entry.subjectName] || 0) + 1;
                        if (!subjectDetailsMap.has(entry.subjectName)) {
                            subjectDetailsMap.set(entry.subjectName, {
                                subjectName: entry.subjectName,
                                courseCode: entry.courseCode,
                            });
                        }
                    });
            }
        }
        const allSubjects = Array.from(subjectDetailsMap.values());
        console.log(`[Analytics Service BE] Scheduled counts calculation complete.`, {
            ...logCtx,
            subjectCount: allSubjects.length,
        });

        // --- Fetch user's attendance records ---
        console.log(
            `[Analytics Service BE] Fetching attendance records for user ${targetUserId}...`,
            logCtx,
        );
        // Ensure findRecordsByUserAndDateRange selects necessary fields (status, isReplacement, subjectName, classDate)
        const records: AttendanceRecord[] =
            await attendanceRepository.findRecordsByUserAndDateRange(
                targetUserId,
                streamId,
                startDate,
                endDate,
            );
        console.log(`[Analytics Service BE] Found attendance records.`, {
            ...logCtx,
            recordCount: records.length,
        });

        // --- Fetch Class Overrides for the period ---
        console.log(`[Analytics Service BE] Fetching class overrides...`, logCtx);
        const overrides = await attendanceRepository.findOverridesForWeek(
            streamId,
            startDate,
            endDate,
        ); // Use existing repo method
        console.log(`[Analytics Service BE] Found class overrides.`, {
            ...logCtx,
            overrideCount: overrides.length,
        });

        // --- Calculate Cancelled and Replacement Counts from Overrides ---
        const cancelledCounts: Record<string, number> = {}; // { [originalSubjectName]: count }
        const replacementCounts: Record<string, number> = {}; // { [replacementSubjectName]: count }
        const cancelledKeys = new Set<string>(); // Store unique Date_Subject_Time keys for cancelled originals

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
        console.log(`[Analytics Service BE] Calculated counts from overrides.`, {
            ...logCtx,
            cancelledCounts,
            replacementCounts,
        });
        // --- End Calculation from Overrides ---

        // --- Calculate stats per subject ---
        console.log(`[Analytics Service BE] Calculating subject stats...`, logCtx);
        const subjectStats: SubjectStatsOutput[] = [];
        let overallAttended = 0;
        let overallHeld = 0;

        // Ensure all subjects (scheduled original OR used as replacement) are included
        const allSubjectNames = new Set([
            ...subjectDetailsMap.keys(), // Subjects originally scheduled
            ...Object.keys(replacementCounts), // Subjects used as replacements
        ]);

        for (const subjectName of allSubjectNames) {
            const subjectInfo = subjectDetailsMap.get(subjectName); // May be undefined if only a replacement
            const totalScheduled = scheduledCounts[subjectName] || 0;
            // Use counts derived from overrides
            const totalCancelled = cancelledCounts[subjectName] || 0;
            const totalTimesWasReplacement = replacementCounts[subjectName] || 0;

            // Revised Definition of Held
            const totalHeld =
                Math.max(0, totalScheduled - totalCancelled) + totalTimesWasReplacement;

            // Attended only counts OCCURRED records for THIS subject (could be original or replacement)
            const attended = records.filter(
                (r) => r.subjectName === subjectName && r.status === AttendanceStatus.OCCURRED,
            ).length;
            // Marked: Count records for this subject that are Occurred or Cancelled (globally)
            // Note: This definition of 'marked' might need refinement based on exact requirements
            const markedRecords = records.filter(
                (r) =>
                    r.subjectName === subjectName &&
                    (r.status === AttendanceStatus.OCCURRED ||
                        r.status === AttendanceStatus.CANCELLED),
            );
            const totalMarked = markedRecords.length; // Count user's relevant records

            const attendancePercentage =
                totalHeld > 0 ? parseFloat(((attended / totalHeld) * 100).toFixed(2)) : null;

            subjectStats.push({
                subjectName,
                courseCode: subjectInfo?.courseCode ?? null, // Use code from map if available
                totalScheduled,
                totalMarked,
                totalHeldClasses: totalHeld, // Use DTO field name
                attended,
                attendancePercentage,
            });

            overallAttended += attended;
            overallHeld += totalHeld;
        }

        const overallAttendancePercentage =
            overallHeld > 0 ? parseFloat(((overallAttended / overallHeld) * 100).toFixed(2)) : null;

        console.log(`[Analytics Service BE] Stats calculation complete. Returning result.`, logCtx);
        return {
            streamId,
            userId: targetUserId,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            overallAttendancePercentage,
            totalAttendedClasses: overallAttended,
            totalHeldClasses: overallHeld, // Use DTO field name
            subjectStats,
        };
    },

    async calculateAttendanceProjection(
        input: AttendanceCalculatorInput,
        userId: string,
    ): Promise<AttendanceProjectionOutput> {
        const logCtx = { ...input, userId }; // For logging
        console.log(`[Analytics Service BE] START calculateAttendanceProjection`, logCtx); // Use console.log if logger removed
        await streamService.ensureMemberAccess(input.streamId, userId);

        const today = startOfToday();
        const targetDate = normalizeDate(input.targetDate);

        if (isBefore(targetDate, today)) {
            throw new BadRequestError('Target date must be today or in the future.');
        }

        let currentAttended = 0;
        let currentHeld = 0;

        // --- THIS IS THE CRITICAL LOGIC ---
        // Check if the frontend provided manual override counts
        if (input.currentAttendedInput !== undefined && input.currentHeldInput !== undefined) {
            // Frontend is in "Manual Override Mode" and sent the current state
            console.log(
                `[Analytics Service BE] Using provided manual counts: Attended=${input.currentAttendedInput}, Held=${input.currentHeldInput}`,
            );
            currentAttended = input.currentAttendedInput;
            currentHeld = input.currentHeldInput;
        } else {
            // Frontend is NOT in manual mode, so backend fetches historical data
            console.log(
                `[Analytics Service BE] No manual counts provided. Fetching current stats up to yesterday...`,
            );
            const yesterday = addDays(today, -1);
            try {
                // Call getStreamAttendanceStats to get historical data
                const currentStats = await this.getStreamAttendanceStats(
                    input.streamId,
                    userId,
                    userId, // requestingUserId is the same as targetUserId for this internal call
                    undefined, // Default start date (earliest timetable or epoch)
                    formatDate(yesterday), // Up to yesterday
                );

                if (input.subjectName) {
                    const subjectStat = currentStats.subjectStats.find(
                        (s) => s.subjectName === input.subjectName,
                    );
                    currentAttended = subjectStat?.attended ?? 0;
                    currentHeld = subjectStat?.totalHeldClasses ?? 0; // Use the 'Held' count
                    if (!subjectStat) {
                        console.log(
                            `[Analytics Service BE] Subject ${input.subjectName} not found in past stats (when fetching).`,
                        );
                    }
                } else {
                    currentAttended = currentStats.totalAttendedClasses;
                    currentHeld = currentStats.totalHeldClasses; // Use the 'Held' count
                }
            } catch (e) {
                if (e instanceof NotFoundError) {
                    console.log(
                        `[Analytics Service BE] NotFoundError fetching past stats: ${e.message}`,
                    );
                    // Defaults remain 0 if no historical data
                } else {
                    console.error(`[Analytics Service BE] Error fetching past stats:`, e);
                    throw e; // Re-throw unexpected errors
                }
            }
        }
        // --- END CRITICAL LOGIC ---
        console.log(
            `[Analytics Service BE] Using for calculation: Attended=${currentAttended}, Held=${currentHeld}`,
        );

        // 2. Calculate future "Scheduled", "Cancelled", and "Replacements"
        console.log(`[Analytics Service BE] Calculating future schedule/overrides...`, logCtx);
        let futureScheduled = 0;
        let futureCancelled = 0;
        let futureReplacements = 0; // Times the target subject IS the replacement

        if (!isBefore(targetDate, today)) {
            // Fetch future timetables
            const futureTimetables: TimetableWithEntries[] = await prisma.timetable.findMany({
                where: {
                    streamId: input.streamId,
                    validFrom: { lte: targetDate },
                    OR: [{ validUntil: null }, { validUntil: { gte: today } }],
                },
                include: { entries: true },
                orderBy: { validFrom: 'desc' },
            });
            // Fetch future overrides ONCE
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

            // Iterate future days to count scheduled
            const futureDays = getDaysInInterval(today, targetDate);
            const futureScheduledMap: Record<string, number> = {};
            for (const day of futureDays) {
                const activeTimetable = futureTimetables.find((tt) =>
                    isDateInTimetableRange(day, tt.validFrom, tt.validUntil),
                );
                if (activeTimetable) {
                    const dayOfWeek = getISODayOfWeek(day);
                    activeTimetable.entries
                        .filter((entry) => entry.dayOfWeek === dayOfWeek)
                        .forEach((entry) => {
                            if (!input.subjectName || entry.subjectName === input.subjectName) {
                                futureScheduledMap[entry.subjectName] =
                                    (futureScheduledMap[entry.subjectName] || 0) + 1;
                            }
                        });
                }
            }

            // Sum up based on filter
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

        // Calculate future "Held" classes
        const futureHeld = Math.max(0, futureScheduled - futureCancelled) + futureReplacements;
        console.log(`[Analytics Service BE] Future held: ${futureHeld}`);

        // 3. Calculate projection (using currentHeld, futureHeld)
        console.log(`[Analytics Service BE] Calculating projection...`);
        // ... (projection calculation logic as before) ...
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
            // Check using the original neededToAttend before clamping
            const maxPossibleAttended = currentAttended + futureHeld;
            const maxPossiblePercentage = parseFloat(
                ((maxPossibleAttended / totalFutureHeldPotential) * 100).toFixed(2),
            );
            message = `Even if you attend all ${futureHeld} upcoming held classes, the maximum percentage you can reach by ${formatDate(targetDate)} is approximately ${maxPossiblePercentage.toFixed(1)}%. Your target of ${input.targetPercentage}% is unreachable in this period.`;
            neededToAttend = clampedNeededToAttend; // Report the max possible attendance needed
        } else if (
            clampedNeededToAttend <= 0 &&
            currentPercentage !== null &&
            currentPercentage >= input.targetPercentage
        ) {
            message += `you have already met or exceeded the target! You can skip all ${futureHeld} upcoming held classes.`;
            neededToAttend = 0; // Reset needed if already met
        } else if (futureHeld === 0) {
            message = `No more classes are scheduled to be held${input.subjectName ? ' for ' + input.subjectName : ''} until ${formatDate(targetDate)}. Current percentage is ${currentPercentage ?? 'N/A'}%.`;
            neededToAttend = 0;
        } else {
            message += `you need to attend ${clampedNeededToAttend} out of the next ${futureHeld} held classes. You can skip ${canSkip} classes.`;
            neededToAttend = clampedNeededToAttend; // Ensure neededToAttend reflects the clamped value
        }

        console.log(`[Analytics Service BE] Projection calculation complete.`);
        // Return object matching AttendanceProjectionOutput DTO (using renamed fields)
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
