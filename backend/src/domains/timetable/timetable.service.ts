import { timetableRepository } from './timetable.repository';
import { attendanceRepository } from '../attendance/attendance.repository';
import { streamService } from '../stream/stream.service'; // To check permissions
import {
    CreateTimetableFrontendInput,
    TimetableOutput,
    TimetableEntryOutput,
    TimetableBasicInfo,
} from './timetable.dto';
import { NotFoundError, BadRequestError } from '../../core/errors';
import { Timetable, TimetableEntry } from '@prisma/client';
import {
    formatDate,
    normalizeDate,
    getISODayOfWeek,
    getDaysInInterval,
    isDateInTimetableRange,
} from '../../core/utils';
import { parseISO, isBefore } from 'date-fns';
import prisma from '../../infrastructure/prisma';
import { SetEndDateInput } from './timetable.dto';

// --- Helper Types ---
type FlatTimetableEntryInput = Omit<TimetableEntry, 'id' | 'timetableId'>;
type TimetableWithEntries = Timetable & { entries: TimetableEntry[] };

// --- Helper Functions ---
// Helper to map Prisma TimetableEntry to Output DTO
const mapEntryToOutput = (entry: TimetableEntry): TimetableEntryOutput => ({
    id: entry.id,
    timetableId: entry.timetableId,
    dayOfWeek: entry.dayOfWeek,
    subjectName: entry.subjectName,
    courseCode: entry.courseCode,
    startTime: entry.startTime,
    endTime: entry.endTime,
});

// Helper to map Prisma Timetable (with entries) to Output DTO
const mapTimetableToOutput = (
    timetable: Timetable & { entries: TimetableEntry[] },
): TimetableOutput => ({
    id: timetable.id,
    streamId: timetable.streamId,
    name: timetable.name,
    // Convert Date objects to ISO strings
    validFrom: timetable.validFrom.toISOString(),
    validUntil: timetable.validUntil ? timetable.validUntil.toISOString() : null,
    createdAt: timetable.createdAt.toISOString(),
    entries: timetable.entries.map(mapEntryToOutput), // Map nested entries
});

// Helper function to transform nested subjects to flat entries
const transformSubjectsToEntries = (
    subjects: CreateTimetableFrontendInput['subjects'],
): FlatTimetableEntryInput[] => {
    const entries: FlatTimetableEntryInput[] = [];
    subjects.forEach((subject) => {
        subject.timeSlots.forEach((slot) => {
            entries.push({
                dayOfWeek: slot.dayOfWeek,
                subjectName: subject.subjectName,
                // Map empty strings/undefined from frontend to null for DB consistency
                courseCode: subject.courseCode || null,
                startTime: slot.startTime || null,
                endTime: slot.endTime || null,
            });
        });
    });
    return entries;
};

// --- NEW: Type for Weekly Schedule Entry ---
export interface WeeklyScheduleEntry {
    // Use a unique key combining date and entry details if TimetableEntry ID isn't sufficient
    // Or rely on frontend to generate keys for rendering
    // id: string;
    date: string; // YYYY-MM-DD
    dayOfWeek: number;
    subjectName: string;
    courseCode: string | null;
    startTime: string | null;
    endTime: string | null;
    status: 'SCHEDULED' | 'CANCELLED'; // Reflects if cancelled globally
}

export const timetableService = {
    // --- Create Timetable (Updated to use transformer) ---
    async createTimetable(
        streamId: string,
        input: CreateTimetableFrontendInput,
        userId: string,
    ): Promise<TimetableOutput> {
        await streamService.ensureAdminAccess(streamId, userId); // Only admins create

        const validFrom = normalizeDate(input.validFrom);
        const validUntil = input.validUntil ? normalizeDate(input.validUntil) : null;

        if (validUntil && validUntil < validFrom) {
            throw new BadRequestError('End date cannot be before start date.');
        }

        // Transform nested subjects to flat entries
        const flatEntries = transformSubjectsToEntries(input.subjects);
        if (flatEntries.length === 0) {
            throw new BadRequestError('Timetable must have at least one schedule entry.');
        }

        const newTimetable = await timetableRepository.create(
            streamId,
            input.name,
            validFrom,
            validUntil,
            flatEntries, // Pass flat entries to repository
        );

        return mapTimetableToOutput(newTimetable);
    },

    async getTimetablesForStream(streamId: string, userId: string): Promise<TimetableOutput[]> {
        // Ensure user is at least a member to view timetables
        await streamService.ensureMemberAccess(streamId, userId);

        const timetables = await timetableRepository.findByStream(streamId);
        return timetables.map(mapTimetableToOutput);
    },

    // --- NEW: Get List for Import Feature ---
    async getTimetableListForImport(
        streamId: string,
        userId: string,
    ): Promise<TimetableBasicInfo[]> {
        await streamService.ensureMemberAccess(streamId, userId); // Any member can see list to import
        const timetables = await timetableRepository.findManyForStream(streamId);
        // Map to basic info DTO, converting dates to ISO strings
        return timetables.map((tt) => ({
            id: tt.id,
            name: tt.name,
            validFrom: tt.validFrom.toISOString(),
            validUntil: tt.validUntil ? tt.validUntil.toISOString() : null,
        }));
    },

    // --- NEW: Get Weekly Schedule View ---
    // Fetches the scheduled classes for a week based on the active timetable(s)
    // Optionally includes global cancellation status (requires joining/checking attendance)
    async getWeeklySchedule(
        streamId: string,
        startDateStr: string,
        endDateStr: string,
        userId: string,
    ): Promise<WeeklyScheduleEntry[]> {
        await streamService.ensureMemberAccess(streamId, userId);
        const startDate = normalizeDate(startDateStr);
        const endDate = normalizeDate(endDateStr);
        const schedule: WeeklyScheduleEntry[] = [];

        // Fetch potentially active timetables (optimized)
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

        // TODO Optional Optimization: Fetch global cancellations for this week/stream once
        // const cancellations = await prisma.attendanceRecord.findMany({ where: { streamId, status: AttendanceStatus.CANCELLED, classDate: { gte: startDate, lte: endDate }, /* Maybe filter by a specific user or check if ANY user has it cancelled? */ }});
        // const cancelledKeys = new Set(cancellations.map(c => `${formatDate(c.classDate)}_${c.subjectName}`)); // Create lookup set

        // --- 2. Fetch the Set of cancelled class keys for the week ONCE ---
        const cancelledKeys = await attendanceRepository.getCancelledClassKeys(
            streamId,
            startDate,
            endDate,
        );
        console.log(`[Timetable Service BE] Cancelled Keys for week:`, cancelledKeys); // Log fetched keys
        // ---

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
                        const dateStr = formatDate(day);
                        // --- 3. Check if this specific instance is in the cancelled set ---
                        const cancellationKey = `${dateStr}_${entry.subjectName}`;
                        const isGloballyCancelled = cancelledKeys.has(cancellationKey);
                        const status = isGloballyCancelled ? 'CANCELLED' : 'SCHEDULED';
                        // ---

                        schedule.push({
                            date: dateStr,
                            dayOfWeek: dayOfWeek,
                            subjectName: entry.subjectName,
                            courseCode: entry.courseCode,
                            startTime: entry.startTime,
                            endTime: entry.endTime,
                            status: status, // Set status based on check
                        });
                    });
            }
        }
        // Sort schedule before returning
        schedule.sort((a, b) => {
            const dateComparison = a.date.localeCompare(b.date);
            if (dateComparison !== 0) return dateComparison;
            return (a.startTime || '99:99').localeCompare(b.startTime || '99:99');
        });
        return schedule;
    },

    async getActiveTimetableForDate(
        streamId: string,
        dateString: string,
        userId: string,
    ): Promise<TimetableOutput | null> {
        await streamService.ensureMemberAccess(streamId, userId);

        const targetDate = normalizeDate(dateString);
        const activeTimetable = await timetableRepository.findActiveByStreamAndDate(
            streamId,
            targetDate,
        );

        if (!activeTimetable) {
            return null;
        }

        return mapTimetableToOutput(activeTimetable);
    },

    /**
     * Calculates the number of scheduled classes for each subject between two dates,
     * based on the active timetable(s) during that period.
     * Returns a map of { subjectName: count }.
     */
    async calculateScheduledClasses(
        streamId: string,
        startDate: Date,
        endDate: Date,
        userId: string,
    ): Promise<Record<string, number>> {
        // This function needs the same optimization as getWeeklySchedule
        console.log(`[Timetable Service BE] Calculating scheduled classes count for analytics...`);
        const potentiallyActiveTimetables: TimetableWithEntries[] = await prisma.timetable.findMany(
            {
                where: {
                    streamId,
                    validFrom: { lte: endDate },
                    OR: [{ validUntil: null }, { validUntil: { gte: startDate } }],
                },
                include: { entries: true }, // <-- ADD THIS INCLUDE
                orderBy: { validFrom: 'desc' },
            },
        );
        const scheduledCounts: Record<string, number> = {};
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
                    });
            }
        }
        console.log(`[Timetable Service BE] Analytics scheduled counts calculated.`);
        return scheduledCounts;
    },

    // --- NEW: Get Timetable Details ---
    async getTimetableDetails(timetableId: string, userId: string): Promise<TimetableOutput> {
        const timetable = await timetableRepository.findById(timetableId);
        if (!timetable) {
            throw new NotFoundError('Timetable not found');
        }
        // Check if user is member of the stream this timetable belongs to
        await streamService.ensureMemberAccess(timetable.streamId, userId);
        return mapTimetableToOutput(timetable);
    },

    async setTimetableEndDate(
        timetableId: string,
        input: SetEndDateInput,
        adminUserId: string,
    ): Promise<TimetableOutput> {
        const timetable = await timetableRepository.findById(timetableId);
        if (!timetable) {
            throw new NotFoundError('Timetable not found.');
        }

        // Check permissions: only admin of the stream can set end date
        await streamService.ensureAdminAccess(timetable.streamId, adminUserId);

        const endDate = normalizeDate(input.validUntil);
        // Business rule: End date cannot be before start date
        if (isBefore(endDate, timetable.validFrom)) {
            throw new BadRequestError(
                "End date cannot be earlier than the timetable's start date.",
            );
        }

        const updatedTimetable = await timetableRepository.setEndDate(timetableId, endDate);
        // Need to get entries again as .update doesn't return relations by default
        const finalTimetable = await timetableRepository.findById(timetableId);

        if (!finalTimetable) throw new NotFoundError('Failed to retrieve updated timetable.'); // Should not happen

        return mapTimetableToOutput(finalTimetable);
    },
};
