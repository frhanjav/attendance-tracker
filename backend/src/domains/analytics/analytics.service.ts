import { attendanceRepository } from '../attendance/attendance.repository';
import { streamService } from '../stream/stream.service';
// Import DTOs and ensure field names match (e.g., totalHeldClasses)
import { AttendanceCalculatorInput, StreamAnalyticsOutput, SubjectStatsOutput, AttendanceProjectionOutput } from './analytics.dto';
import { NotFoundError, BadRequestError } from '../../core/errors';
import { AttendanceStatus, Timetable, TimetableEntry } from '@prisma/client';
import { normalizeDate, getDaysInInterval, getISODayOfWeek, formatDate, isDateInTimetableRange } from '../../core/utils';
import { addDays, isBefore, startOfToday, parseISO } from 'date-fns';
import prisma from '../../infrastructure/prisma';

// Type for timetable with entries used locally
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
        endDateStr?: string
    ): Promise<StreamAnalyticsOutput> {
        console.log(`[Analytics Service BE] START getStreamAttendanceStats for stream ${streamId}, user ${targetUserId}`);
        await streamService.ensureMemberAccess(streamId, requestingUserId);

        let startDate: Date;
        const endDate = endDateStr ? normalizeDate(endDateStr) : normalizeDate(new Date()); // Default end to today

        if (startDateStr) {
            startDate = normalizeDate(startDateStr);
        } else {
            // --- Find Earliest Timetable Start Date ---
            console.log(`[Analytics Service BE] Finding earliest timetable start date for stream ${streamId}...`);
            const earliestTimetable = await prisma.timetable.findFirst({
                where: { streamId: streamId },
                orderBy: { validFrom: 'asc' }, // Find the one that started first
                select: { validFrom: true }
            });
            // Default to epoch start ONLY if no timetables exist at all
            startDate = earliestTimetable?.validFrom ? normalizeDate(earliestTimetable.validFrom) : new Date(0);
            console.log(`[Analytics Service BE] Using start date: ${formatDate(startDate)}`);
        }
        console.log(`[Analytics Service BE] Date range: ${formatDate(startDate)} to ${formatDate(endDate)}`);

        // --- Fetch potentially active timetables (using calculated startDate/endDate) ---
        console.log(`[Analytics Service BE] Fetching potentially active timetetables...`);
        const potentiallyActiveTimetables: TimetableWithEntries[] = await prisma.timetable.findMany({
             where: { streamId, validFrom: { lte: endDate }, OR: [ { validUntil: null }, { validUntil: { gte: startDate } } ] },
             include: { entries: true },
             orderBy: { validFrom: 'desc' }
        });

        // --- Calculate scheduled counts and gather subject details ONCE ---
        console.log(`[Analytics Service BE] Calculating scheduled classes count...`);
        const scheduledCounts: Record<string, number> = {};
        const subjectDetailsMap: Map<string, { subjectName: string; courseCode?: string | null }> = new Map();
        const days = getDaysInInterval(startDate, endDate);

        for (const day of days) {
            const activeTimetable = potentiallyActiveTimetables.find(tt => isDateInTimetableRange(day, tt.validFrom, tt.validUntil));
            if (activeTimetable) {
                const dayOfWeek = getISODayOfWeek(day);
                activeTimetable.entries
                    .filter(entry => entry.dayOfWeek === dayOfWeek)
                    .forEach(entry => {
                        scheduledCounts[entry.subjectName] = (scheduledCounts[entry.subjectName] || 0) + 1;
                        if (!subjectDetailsMap.has(entry.subjectName)) {
                             subjectDetailsMap.set(entry.subjectName, { subjectName: entry.subjectName, courseCode: entry.courseCode });
                        }
                    });
            }
        }
        const allSubjects = Array.from(subjectDetailsMap.values());
        console.log(`[Analytics Service BE] Scheduled counts calculation complete. Subjects found: ${allSubjects.length}`);

        // --- Fetch user's attendance records ---
        console.log(`[Analytics Service BE] Fetching attendance records for user ${targetUserId}...`);
        const records = await attendanceRepository.findRecordsByUserAndDateRange(targetUserId, streamId, startDate, endDate);
        console.log(`[Analytics Service BE] Found ${records.length} attendance records.`);

        // --- Fetch Cancelled Counts ---
        console.log(`[Analytics Service BE] Fetching cancelled counts...`);
        const cancelledCounts = await attendanceRepository.countCancelledClasses(streamId, startDate, endDate);
        console.log(`[Analytics Service BE] Cancelled counts:`, cancelledCounts);

        // --- NEW: Fetch Replacement Class Instances ---
        console.log(`[Analytics Service BE] Fetching replacement counts...`);
        const replacementInstances = await attendanceRepository.findReplacementClasses(streamId, startDate, endDate);
        const replacementCounts: Record<string, number> = {}; // { [subjectName]: count }
        for (const rep of replacementInstances) {
            replacementCounts[rep.subjectName] = (replacementCounts[rep.subjectName] || 0) + 1;
        }
        console.log(`[Analytics Service BE] Replacement counts:`, replacementCounts);
        // --- End Fetch Replacement ---

         // --- Calculate stats per subject ---
         console.log(`[Analytics Service BE] Calculating subject stats...`);
         const subjectStats: SubjectStatsOutput[] = [];
         let overallAttended = 0;
         let overallHeld = 0;
 
         // Ensure all subjects (scheduled original OR used as replacement) are included
         const allSubjectNames = new Set([
              ...subjectDetailsMap.keys(), // Subjects originally scheduled
              ...Object.keys(replacementCounts) // Subjects used as replacements
         ]);
 
         for (const subjectName of allSubjectNames) {
             // Get details if available (might not be if only used as replacement)
             const subjectInfo = subjectDetailsMap.get(subjectName);
             const totalScheduled = scheduledCounts[subjectName] || 0;
             const totalCancelled = cancelledCounts[subjectName] || 0;
             const totalTimesWasReplacement = replacementCounts[subjectName] || 0;
 
             // --- REVISED Definition of Held ---
             // Held = (Originally Scheduled - Cancelled for this Subject) + (Times this Subject Replaced Others)
             // Note: A class cancelled *because* it was replaced is already counted in totalCancelled.
             const totalHeld = Math.max(0, totalScheduled - totalCancelled) + totalTimesWasReplacement;
 
             const subjectRecords = records.filter(r => r.subjectName === subjectName);
             // Attended counts OCCURRED records (both original and replacement)
             const attended = subjectRecords.filter(r => r.status === AttendanceStatus.OCCURRED).length;
             const totalMarked = subjectRecords.filter(r => r.status === AttendanceStatus.OCCURRED || r.status === AttendanceStatus.CANCELLED).length;
 
             // --- Percentage based on REVISED Held ---
             const attendancePercentage = totalHeld > 0
                 ? parseFloat(((attended / totalHeld) * 100).toFixed(2))
                 : null;
 
             subjectStats.push({
                 subjectName,
                 courseCode: subjectInfo?.courseCode ?? null, // Get code if available
                 totalScheduled, // Stays the same
                 totalMarked,
                 totalHeldClasses: totalHeld, // Use the revised Held count
                 attended,
                 attendancePercentage,
             });
 
             overallAttended += attended;
             overallHeld += totalHeld; // Sum up revised held classes
         }

        const overallAttendancePercentage = overallHeld > 0
            ? parseFloat(((overallAttended / overallHeld) * 100).toFixed(2))
            : null;

            console.log(`[Analytics Service BE] Stats calculation complete. Returning result.`);
            return {
                streamId, userId: targetUserId, startDate: startDate.toISOString(), endDate: endDate.toISOString(),
                overallAttendancePercentage, totalAttendedClasses: overallAttended,
                totalHeldClasses: overallHeld, // Return revised Held count
                subjectStats,
            };
    },

    /**
     * Calculates the attendance projection.
     */
    async calculateAttendanceProjection(input: AttendanceCalculatorInput, userId: string): Promise<AttendanceProjectionOutput> {
        await streamService.ensureMemberAccess(input.streamId, userId);
        const today = startOfToday();
        const targetDate = normalizeDate(input.targetDate);

        if (isBefore(targetDate, today)) {
            throw new BadRequestError('Target date must be today or in the future.');
        }

        const yesterday = addDays(today, -1);
        let currentAttended = 0;
        let currentHeld = 0;

        // --- Use provided counts if available (Manual Override) ---
        if (input.currentAttendedInput !== undefined && input.currentHeldInput !== undefined) {
            console.log(`[Analytics Service BE] Using provided manual counts: Attended=${input.currentAttendedInput}, Held=${input.currentHeldInput}`);
            currentAttended = input.currentAttendedInput;
            currentHeld = input.currentHeldInput;
        } else {
            // --- Fetch current stats if not provided ---
            console.log(`[Analytics Service BE] Fetching current stats up to yesterday...`);
            const yesterday = addDays(today, -1);
            try {
                const currentStats = await this.getStreamAttendanceStats(
                    input.streamId, userId, userId, undefined, formatDate(yesterday)
                );
                if (input.subjectName) {
                    const subjectStat = currentStats.subjectStats.find(s => s.subjectName === input.subjectName);
                    currentAttended = subjectStat?.attended ?? 0;
                    currentHeld = subjectStat?.totalHeldClasses ?? 0; // Use correct field name
                } else {
                    currentAttended = currentStats.totalAttendedClasses;
                    currentHeld = currentStats.totalHeldClasses; // Use correct field name
                }
            } catch (e) {
                if (e instanceof NotFoundError) {
                    console.log(`[Analytics Service BE] NotFoundError fetching past stats: ${e.message}`);
                    // Defaults remain 0
                } else {
                    console.error(`[Analytics Service BE] Error fetching past stats:`, e);
                    throw e;
                }
           }
        }
        console.log(`[Analytics Service BE] Using stats for calculation: Attended=${currentAttended}, Held=${currentHeld}`);

        // try {
        //     // Call the optimized stats function for the past period
        //     const currentStats = await this.getStreamAttendanceStats(
        //         input.streamId, userId, userId, undefined, formatDate(yesterday)
        //     );

        //     // Extract stats based on whether a specific subject was requested
        //     if (input.subjectName) {
        //         const subjectStat = currentStats.subjectStats.find(s => s.subjectName === input.subjectName);
        //         if (!subjectStat) {
        //             console.log(`[Analytics Service BE] Subject ${input.subjectName} not found in past stats.`);
        //             // Defaults remain 0
        //         } else {
        //             currentAttended = subjectStat.attended;
        //             currentHeld = subjectStat.totalHeldClasses; // Use correct field name from DTO
        //         }
        //     } else {
        //         currentAttended = currentStats.totalAttendedClasses;
        //         currentHeld = currentStats.totalHeldClasses; // Use correct field name from DTO
        //     }
        // } catch (e) {
        //      if (e instanceof NotFoundError) {
        //          console.log(`[Analytics Service BE] NotFoundError fetching past stats: ${e.message}`);
        //          // Defaults remain 0
        //      } else {
        //          console.error(`[Analytics Service BE] Error fetching past stats:`, e);
        //          throw e;
        //      }
        // }
        // console.log(`[Analytics Service BE] Current stats: Attended=${currentAttended}, Held=${currentHeld}`);

        // 2. Calculate future "Scheduled" and "Cancelled" classes from today up to targetDate
        console.log(`[Analytics Service BE] Calculating future schedule/cancellations from ${formatDate(today)} to ${formatDate(targetDate)}...`);
        let futureScheduled = 0;
        let futureCancelled = 0;
        let futureReplacements = 0;

        if (!isBefore(targetDate, today)) { // Only if target date is today or future
            // Fetch timetables relevant for the future period
            const futureTimetables: TimetableWithEntries[] = await prisma.timetable.findMany({
                 where: { streamId: input.streamId, validFrom: { lte: targetDate }, OR: [ { validUntil: null }, { validUntil: { gte: today } } ] },
                 include: { entries: true },
                 orderBy: { validFrom: 'desc' }
            });

            // Fetch future cancellations ONCE
            const futureCancelledMap = await attendanceRepository.countCancelledClasses(input.streamId, today, targetDate);

            // --- Fetch future REPLACEMENT instances ---
            const futureReplacementInstances = await attendanceRepository.findReplacementClasses(input.streamId, today, targetDate);
            const futureReplacementMap: Record<string, number> = {};
             for (const rep of futureReplacementInstances) {
                futureReplacementMap[rep.subjectName] = (futureReplacementMap[rep.subjectName] || 0) + 1;
             }
            // ---

            const futureDays = getDaysInInterval(today, targetDate);
            const futureScheduledMap: Record<string, number> = {};

            // Iterate days to count scheduled classes
            for (const day of futureDays) {
                const activeTimetable = futureTimetables.find(tt => isDateInTimetableRange(day, tt.validFrom, tt.validUntil));
                if (activeTimetable) {
                    const dayOfWeek = getISODayOfWeek(day);
                    activeTimetable.entries
                        .filter(entry => entry.dayOfWeek === dayOfWeek)
                        .forEach(entry => {
                            if (!input.subjectName || entry.subjectName === input.subjectName) {
                                futureScheduledMap[entry.subjectName] = (futureScheduledMap[entry.subjectName] || 0) + 1;
                            }
                        });
                }
            }

            // Sum up based on filter
            if (input.subjectName) {
                futureScheduled = futureScheduledMap[input.subjectName] || 0;
                futureCancelled = futureCancelledMap[input.subjectName] || 0;
                futureReplacements = futureReplacementMap[input.subjectName] || 0; // Count replacements FOR this subject
            } else {
                futureScheduled = Object.values(futureScheduledMap).reduce((sum, count) => sum + count, 0);
                futureCancelled = Object.values(futureCancelledMap).reduce((sum, count) => sum + count, 0);
                // Overall future replacements isn't directly meaningful here, we need futureHeld
                // futureReplacements = Object.values(futureReplacementMap).reduce((sum, count) => sum + count, 0);
            }
        }
        console.log(`[Analytics Service BE] Future scheduled: ${futureScheduled}, Future cancelled: ${futureCancelled}, Future times as replacement: ${futureReplacements}`);

        // Calculate future "Held" classes
        const futureHeld = Math.max(0, futureScheduled - futureCancelled) + futureReplacements;
        console.log(`[Analytics Service BE] Future held: ${futureHeld}`);

        // 3. Calculate projection based on "Held" classes
        console.log(`[Analytics Service BE] Calculating projection...`);
        const targetDecimal = input.targetPercentage / 100;
        const totalFutureHeldPotential = currentHeld + futureHeld;

        let neededToAttend = Math.ceil(targetDecimal * totalFutureHeldPotential - currentAttended);
        neededToAttend = Math.max(0, neededToAttend);
        const clampedNeededToAttend = Math.min(futureHeld, neededToAttend); // How many they *can* actually attend

        const canSkip = futureHeld - clampedNeededToAttend;
        const currentPercentage = currentHeld > 0 ? parseFloat(((currentAttended / currentHeld) * 100).toFixed(2)) : null;

        // Generate message using "held" context
        let message = `To reach ${input.targetPercentage}% by ${formatDate(targetDate)}${input.subjectName ? ' for ' + input.subjectName : ''}: `;
        if (totalFutureHeldPotential <= 0) {
             message = `No classes ${input.subjectName ? 'for ' + input.subjectName + ' ' : ''}were held or are scheduled to be held by ${formatDate(targetDate)}. Cannot calculate percentage.`;
        } else if (neededToAttend > futureHeld) { // Check using the original neededToAttend before clamping
            const maxPossibleAttended = currentAttended + futureHeld;
            const maxPossiblePercentage = parseFloat(((maxPossibleAttended / totalFutureHeldPotential) * 100).toFixed(2));
            message = `Even if you attend all ${futureHeld} upcoming held classes, the maximum percentage you can reach by ${formatDate(targetDate)} is approximately ${maxPossiblePercentage.toFixed(1)}%. Your target of ${input.targetPercentage}% is unreachable in this period.`;
            neededToAttend = clampedNeededToAttend; // Report the max possible attendance needed
        } else if (clampedNeededToAttend <= 0 && currentPercentage !== null && currentPercentage >= input.targetPercentage) {
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
            neededToAttend, // Use the realistic clamped value
            canSkip,
            message,
        };
    },
};