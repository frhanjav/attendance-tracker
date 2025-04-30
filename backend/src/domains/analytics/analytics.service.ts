// backend/src/domains/analytics/analytics.service.ts

import { attendanceRepository } from '../attendance/attendance.repository';
// NOTE: We directly query timetables here for optimization, reducing dependency on timetableService for this specific task.
// import { timetableService } from '../timetable/timetable.service';
import { streamService } from '../stream/stream.service';
import { AttendanceCalculatorInput, StreamAnalyticsOutput, SubjectStatsOutput, AttendanceProjectionOutput } from './analytics.dto';
import { NotFoundError, BadRequestError } from '../../core/errors';
import { AttendanceStatus, Timetable, TimetableEntry } from '@prisma/client'; // Import necessary Prisma types
import { normalizeDate, getDaysInInterval, getISODayOfWeek, formatDate, isDateInTimetableRange } from '../../core/utils';
import { addDays, isBefore, startOfToday, parseISO } from 'date-fns';
import prisma from '../../infrastructure/prisma'; // Import prisma client directly for optimized query

// Define type for timetable with entries for clarity within this service
type TimetableWithEntries = Timetable & { entries: TimetableEntry[] };

export const analyticsService = {

    /**
     * Calculates detailed attendance statistics for a user in a stream, optionally filtered by date range.
     * Optimized to fetch timetables once.
     */
    async getStreamAttendanceStats(
        streamId: string,
        targetUserId: string, // The user whose stats are being calculated
        requestingUserId: string, // The user making the request
        startDateStr?: string,
        endDateStr?: string
    ): Promise<StreamAnalyticsOutput> {
        console.log(`[Analytics Service BE] START getStreamAttendanceStats for stream ${streamId}, user ${targetUserId}`);
        await streamService.ensureMemberAccess(streamId, requestingUserId); // Permission check

        // Determine date range, default to epoch start / today end if not provided
        const startDate = startDateStr ? normalizeDate(startDateStr) : new Date(0);
        const endDate = endDateStr ? normalizeDate(endDateStr) : normalizeDate(new Date());
        console.log(`[Analytics Service BE] Date range: ${formatDate(startDate)} to ${formatDate(endDate)}`);

        // --- Optimization 1: Fetch relevant timetables ONCE ---
        console.log(`[Analytics Service BE] Fetching potentially active timetables for stream ${streamId}`);
        const potentiallyActiveTimetables: TimetableWithEntries[] = await prisma.timetable.findMany({
             where: {
                 streamId: streamId,
                 validFrom: { lte: endDate }, // Started before/on range end
                 OR: [
                     { validUntil: null }, // No end date OR
                     { validUntil: { gte: startDate } } // Ends after/on range start
                 ]
             },
             include: { entries: true }, // Include entries needed for schedule calculation
             orderBy: { validFrom: 'desc' } // Most recent first helps find active one faster
        });
        console.log(`[Analytics Service BE] Found ${potentiallyActiveTimetables.length} potentially active timetables.`);

        // --- Optimization 2: Calculate scheduled classes ONCE while iterating days ---
        console.log(`[Analytics Service BE] Calculating scheduled classes count...`);
        const scheduledCounts: Record<string, number> = {}; // { [subjectName]: count }
        // Map to store subject details (name, code) to avoid duplicates
        const subjectDetailsMap: Map<string, { subjectName: string; courseCode?: string | null }> = new Map();
        const days = getDaysInInterval(startDate, endDate); // Get all days in the range

        for (const day of days) {
            // Find the active timetable for this specific day from the pre-fetched list
            const activeTimetable = potentiallyActiveTimetables.find(tt =>
                isDateInTimetableRange(day, tt.validFrom, tt.validUntil) // Utility to check if day falls within tt's range
            );

            if (activeTimetable) {
                const dayOfWeek = getISODayOfWeek(day); // Get ISO day (Mon=1, Sun=7)
                // Find entries scheduled for this day of the week
                activeTimetable.entries
                    .filter(entry => entry.dayOfWeek === dayOfWeek)
                    .forEach(entry => {
                        // Increment count for this subject
                        scheduledCounts[entry.subjectName] = (scheduledCounts[entry.subjectName] || 0) + 1;
                        // Store subject details if not already seen
                        if (!subjectDetailsMap.has(entry.subjectName)) {
                             subjectDetailsMap.set(entry.subjectName, { subjectName: entry.subjectName, courseCode: entry.courseCode });
                        }
                    });
            }
        }
        // Get unique subject info from the map
        const allSubjects = Array.from(subjectDetailsMap.values());
        console.log(`[Analytics Service BE] Scheduled counts calculation complete. Subjects found: ${allSubjects.length}`);


        // --- Get all relevant attendance records for the user in the range ---
        console.log(`[Analytics Service BE] Fetching attendance records for user ${targetUserId}...`);
        const records = await attendanceRepository.findRecordsByUserAndDateRange(targetUserId, streamId, startDate, endDate);
        console.log(`[Analytics Service BE] Found ${records.length} attendance records.`);


        // --- Calculate stats per subject ---
        console.log(`[Analytics Service BE] Calculating subject stats...`);
        const subjectStats: SubjectStatsOutput[] = [];
        let overallAttended = 0;
        let overallOccurred = 0; // Classes marked as OCCURRED

        for (const subjectInfo of allSubjects) {
            const subjectName = subjectInfo.subjectName;
            // Use the pre-calculated scheduled count
            const totalScheduled = scheduledCounts[subjectName] || 0;

            // Filter records for the current subject
            const subjectRecords = records.filter(r => r.subjectName === subjectName);

            // Calculate counts based on status from actual records
            const attended = subjectRecords.filter(r => r.status === AttendanceStatus.OCCURRED).length;
            const occurred = attended; // For percentage, usually based on OCCURRED status
            const cancelled = subjectRecords.filter(r => r.status === AttendanceStatus.CANCELLED).length;
            const replaced = subjectRecords.filter(r => r.status === AttendanceStatus.REPLACED).length;
            const totalMarked = occurred + cancelled + replaced; // Total records with a non-pending status

            // Calculate percentage based on occurred classes
            const attendancePercentage = occurred > 0
                ? parseFloat(((attended / occurred) * 100).toFixed(2))
                : null; // Avoid division by zero

            subjectStats.push({
                subjectName,
                courseCode: subjectInfo.courseCode,
                totalScheduled, // Calculated from timetable
                totalMarked,    // Calculated from records
                totalOccurred: occurred, // Classes that actually happened
                attended,       // User's attended count for occurred classes
                attendancePercentage,
            });

            // Aggregate overall counts
            overallAttended += attended;
            overallOccurred += occurred;
        }

        // Calculate overall percentage
        const overallAttendancePercentage = overallOccurred > 0
            ? parseFloat(((overallAttended / overallOccurred) * 100).toFixed(2))
            : null;

        console.log(`[Analytics Service BE] Stats calculation complete. Returning result.`);
        // Return dates as ISO strings for API consistency
        return {
            streamId,
            userId: targetUserId,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            overallAttendancePercentage,
            totalAttendedClasses: overallAttended,
            totalOccurredClasses: overallOccurred,
            subjectStats,
        };
    },

    /**
     * Calculates the attendance projection based on current stats and future scheduled classes.
     * Optimized to fetch future timetables once.
     */
    async calculateAttendanceProjection(input: AttendanceCalculatorInput, userId: string): Promise<AttendanceProjectionOutput> {
        console.log(`[Analytics Service BE] START calculateAttendanceProjection for stream ${input.streamId}, user ${userId}`);
        await streamService.ensureMemberAccess(input.streamId, userId); // Permission check

        const today = startOfToday();
        const targetDate = normalizeDate(input.targetDate);

        if (isBefore(targetDate, today)) {
            throw new BadRequestError('Target date must be today or in the future.');
        }

        // 1. Get current attendance stats up to yesterday
        console.log(`[Analytics Service BE] Fetching current stats up to yesterday...`);
        const yesterday = addDays(today, -1);
        let currentAttended = 0;
        let currentOccurred = 0;

        try {
            // Call the optimized stats function for the past period
            const currentStats = await this.getStreamAttendanceStats(
                input.streamId,
                userId,
                userId, // Requesting user is the target user
                undefined, // Use default start (epoch)
                formatDate(yesterday) // End date is yesterday
            );

            // Extract stats based on whether a specific subject was requested
            if (input.subjectName) {
                const subjectStat = currentStats.subjectStats.find(s => s.subjectName === input.subjectName);
                if (!subjectStat) {
                    // If subject not found in past stats, assume 0/0
                    console.log(`[Analytics Service BE] Subject ${input.subjectName} not found in past stats.`);
                    currentAttended = 0;
                    currentOccurred = 0;
                    // Optionally throw error: throw new NotFoundError(`Subject ${input.subjectName} not found or no classes held yet.`);
                } else {
                    currentAttended = subjectStat.attended;
                    currentOccurred = subjectStat.totalOccurred;
                }
            } else {
                // Use overall stats
                currentAttended = currentStats.totalAttendedClasses;
                currentOccurred = currentStats.totalOccurredClasses;
            }
        } catch (e) {
             // Handle cases where getStreamAttendanceStats might fail (e.g., no timetables ever)
             if (e instanceof NotFoundError) {
                 console.log(`[Analytics Service BE] NotFoundError fetching past stats: ${e.message}`);
                 currentAttended = 0;
                 currentOccurred = 0;
             } else {
                 console.error(`[Analytics Service BE] Error fetching past stats:`, e);
                 throw e; // Re-throw unexpected errors
             }
        }
        console.log(`[Analytics Service BE] Current stats: Attended=${currentAttended}, Occurred=${currentOccurred}`);


        // 2. Calculate future scheduled classes (Optimized)
        console.log(`[Analytics Service BE] Calculating future scheduled classes from ${formatDate(today)} to ${formatDate(targetDate)}...`);
        let futureScheduled = 0;
        // Only calculate if target date is not in the past relative to today
        if (!isBefore(targetDate, today)) { // Check if targetDate is today or future
             // Fetch potentially active timetables ONCE for the future range
            const futureTimetables: TimetableWithEntries[] = await prisma.timetable.findMany({
                 where: {
                     streamId: input.streamId,
                     validFrom: { lte: targetDate }, // Started before or on target date
                     OR: [ { validUntil: null }, { validUntil: { gte: today } } ] // Ends after or on today, or never ends
                 },
                 include: { entries: true },
                 orderBy: { validFrom: 'desc' } // Most recent first
            });

            const futureDays = getDaysInInterval(today, targetDate); // Includes today and targetDate
            const futureScheduledMap: Record<string, number> = {};

            for (const day of futureDays) {
                const activeTimetable = futureTimetables.find(tt =>
                    isDateInTimetableRange(day, tt.validFrom, tt.validUntil)
                );
                if (activeTimetable) {
                    const dayOfWeek = getISODayOfWeek(day);
                    activeTimetable.entries
                        .filter(entry => entry.dayOfWeek === dayOfWeek)
                        .forEach(entry => {
                            // Count only if the subject matches the input filter, or count all if no filter
                            if (!input.subjectName || entry.subjectName === input.subjectName) {
                                futureScheduledMap[entry.subjectName] = (futureScheduledMap[entry.subjectName] || 0) + 1;
                            }
                        });
                }
            }

            // Sum up counts based on filter
            if (input.subjectName) {
                futureScheduled = futureScheduledMap[input.subjectName] || 0;
            } else {
                futureScheduled = Object.values(futureScheduledMap).reduce((sum, count) => sum + count, 0);
            }
        }
        console.log(`[Analytics Service BE] Future scheduled count: ${futureScheduled}`);


        // 3. Calculate projection (Logic remains the same)
        console.log(`[Analytics Service BE] Calculating projection...`);
        const targetDecimal = input.targetPercentage / 100;
        // Assume all future scheduled classes will eventually be marked as 'OCCURRED' for projection
        const totalFutureOccurredPotential = currentOccurred + futureScheduled;

        let neededToAttend = Math.ceil(targetDecimal * totalFutureOccurredPotential - currentAttended);
        neededToAttend = Math.max(0, neededToAttend); // Cannot need negative attendance
        // Cannot need to attend more classes than are scheduled in the future
        neededToAttend = Math.min(futureScheduled, neededToAttend);

        const canSkip = futureScheduled - neededToAttend;
        const currentPercentage = currentOccurred > 0 ? parseFloat(((currentAttended / currentOccurred) * 100).toFixed(2)) : null;

        // Generate user-friendly message (Logic remains the same)
        let message = `To reach ${input.targetPercentage}% by ${formatDate(targetDate)}${input.subjectName ? ' for ' + input.subjectName : ''}, `;
        // ... (message generation logic as before) ...
         if (neededToAttend > futureScheduled) { message = `It's impossible to reach ${input.targetPercentage}% by ${formatDate(targetDate)} even attending all future ${futureScheduled} classes.`; }
         else if (neededToAttend <= 0 && currentPercentage !== null && currentPercentage >= input.targetPercentage) { message += `you have already met the target! You can skip all ${futureScheduled} upcoming classes.`; neededToAttend = 0; }
         else if (futureScheduled === 0) { message = `No classes are scheduled${input.subjectName ? ' for ' + input.subjectName : ''} until ${formatDate(targetDate)}. Current percentage is ${currentPercentage ?? 'N/A'}%.`; }
         else { message += `you need to attend ${neededToAttend} out of the next ${futureScheduled} scheduled classes. You can skip ${canSkip} classes.`; }

        console.log(`[Analytics Service BE] Projection calculation complete.`);
        return {
            currentAttended,
            currentOccurred,
            currentPercentage,
            futureScheduled,
            targetPercentage: input.targetPercentage,
            neededToAttend,
            canSkip,
            message,
        };
    },
};