import { timetableRepository } from './timetable.repository';
import { streamService } from '../stream/stream.service'; // To check permissions
import { TimetableOutput, TimetableEntryOutput, CreateTimetableFrontendInput } from './timetable.dto';
import { NotFoundError, BadRequestError } from '../../core/errors';
import { Timetable, TimetableEntry } from '@prisma/client';
import { normalizeDate, getISODayOfWeek, getDaysInInterval, isDateInTimetableRange } from '../../core/utils';

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
const mapTimetableToOutput = (timetable: Timetable & { entries: TimetableEntry[] }): TimetableOutput => ({
    id: timetable.id,
    streamId: timetable.streamId,
    name: timetable.name,
    // Convert Date objects to ISO strings
    validFrom: timetable.validFrom.toISOString(),
    validUntil: timetable.validUntil ? timetable.validUntil.toISOString() : null,
    createdAt: timetable.createdAt.toISOString(),
    updatedAt: timetable.updatedAt.toISOString(),
    entries: timetable.entries.map(mapEntryToOutput), // Map nested entries
});

// Helper type for flat entry structure expected by repository/backend
type FlatTimetableEntryInput = Omit<TimetableEntry, 'id' | 'timetableId'>;

// Helper function to transform nested subjects to flat entries
const transformSubjectsToEntries = (subjects: CreateTimetableFrontendInput['subjects']): FlatTimetableEntryInput[] => {
    const entries: FlatTimetableEntryInput[] = [];
    subjects.forEach(subject => {
        subject.timeSlots.forEach(slot => {
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

export const timetableService = {
    // --- Create Timetable (Updated to use transformer) ---
    async createTimetable(streamId: string, input: CreateTimetableFrontendInput, userId: string): Promise<TimetableOutput> {
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
            flatEntries // Pass flat entries to repository
        );

        return mapTimetableToOutput(newTimetable);
    },

    async getTimetablesForStream(streamId: string, userId: string): Promise<TimetableOutput[]> {
        // Ensure user is at least a member to view timetables
        await streamService.ensureMemberAccess(streamId, userId);

        const timetables = await timetableRepository.findByStream(streamId);
        return timetables.map(mapTimetableToOutput);
    },

    async getActiveTimetableForDate(streamId: string, dateString: string, userId: string): Promise<TimetableOutput | null> {
        await streamService.ensureMemberAccess(streamId, userId);

        const targetDate = normalizeDate(dateString);
        const activeTimetable = await timetableRepository.findActiveByStreamAndDate(streamId, targetDate);

        if (!activeTimetable) {
            // It's not an error to have no active timetable, just return null
            return null;
        }

        return mapTimetableToOutput(activeTimetable);
    },

    /**
     * Calculates the number of scheduled classes for each subject between two dates,
     * based on the active timetable(s) during that period.
     * Returns a map of { subjectName: count }.
     */
    async calculateScheduledClasses(streamId: string, startDate: Date, endDate: Date, userId: string): Promise<Record<string, number>> {
        await streamService.ensureMemberAccess(streamId, userId);

        const start = normalizeDate(startDate);
        const end = normalizeDate(endDate);
        const subjectCounts: Record<string, number> = {};

        const days = getDaysInInterval(start, end);

        for (const day of days) {
            const activeTimetable = await timetableRepository.findActiveByStreamAndDate(streamId, day);
            if (activeTimetable) {
                const dayOfWeek = getISODayOfWeek(day);
                const entriesForDay = activeTimetable.entries.filter(entry => entry.dayOfWeek === dayOfWeek);

                for (const entry of entriesForDay) {
                    subjectCounts[entry.subjectName] = (subjectCounts[entry.subjectName] || 0) + 1;
                }
            }
        }

        return subjectCounts;
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

    // --- NEW: Update Timetable ---
    async updateTimetable(timetableId: string, input: CreateTimetableFrontendInput, userId: string): Promise<TimetableOutput> {
        // Check if timetable exists and get streamId for permission check
        const streamId = await timetableRepository.getStreamIdForTimetable(timetableId);
        if (!streamId) {
            throw new NotFoundError('Timetable not found');
        }
        await streamService.ensureAdminAccess(streamId, userId); // Only admins update

        const validFrom = normalizeDate(input.validFrom);
        const validUntil = input.validUntil ? normalizeDate(input.validUntil) : null;
        if (validUntil && validUntil < validFrom) {
            throw new BadRequestError('End date cannot be before start date.');
        }

        // Transform nested subjects to flat entries for the repository update method
        const flatEntries = transformSubjectsToEntries(input.subjects);
        if (flatEntries.length === 0) {
            throw new BadRequestError('Timetable must have at least one schedule entry.');
        }

        const updatedTimetable = await timetableRepository.update(timetableId, {
            name: input.name,
            validFrom,
            validUntil,
            entriesData: flatEntries, // Pass flat entries
        });

        return mapTimetableToOutput(updatedTimetable);
    },

    // --- NEW: Delete Timetable ---
    async deleteTimetable(timetableId: string, userId: string): Promise<{ message: string }> {
        // Check if timetable exists and get streamId for permission check
        const streamId = await timetableRepository.getStreamIdForTimetable(timetableId);
        if (!streamId) {
            throw new NotFoundError('Timetable not found');
        }
        await streamService.ensureAdminAccess(streamId, userId); // Only admins delete

        await timetableRepository.deleteById(timetableId);
        return { message: 'Timetable deleted successfully' };
    }
};