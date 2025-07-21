import { timetableRepository } from './timetable.repository';
import { streamService } from '../stream/stream.service';
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
} from '../../core/utils';
import { isBefore, isAfter } from 'date-fns';
import prisma from '../../infrastructure/prisma';
import { SetEndDateInput } from './timetable.dto';

type FlatTimetableEntryInput = Omit<TimetableEntry, 'id' | 'timetableId'>;

const mapEntryToOutput = (entry: TimetableEntry): TimetableEntryOutput => ({
    id: entry.id,
    timetableId: entry.timetableId,
    dayOfWeek: entry.dayOfWeek,
    subjectName: entry.subjectName,
    courseCode: entry.courseCode,
    startTime: entry.startTime,
    endTime: entry.endTime,
});

const mapTimetableToOutput = (
    timetable: Timetable & { entries: TimetableEntry[] },
): TimetableOutput => ({
    id: timetable.id,
    streamId: timetable.streamId,
    name: timetable.name,
    validFrom: timetable.validFrom.toISOString(),
    validUntil: timetable.validUntil ? timetable.validUntil.toISOString() : null,
    createdAt: timetable.createdAt.toISOString(),
    entries: timetable.entries.map(mapEntryToOutput),
});

const transformSubjectsToEntries = (
    subjects: CreateTimetableFrontendInput['subjects'],
): FlatTimetableEntryInput[] => {
    const entries: FlatTimetableEntryInput[] = [];
    subjects.forEach((subject) => {
        subject.timeSlots.forEach((slot) => {
            entries.push({
                dayOfWeek: slot.dayOfWeek,
                subjectName: subject.subjectName,
                courseCode: subject.courseCode || null,
                startTime: slot.startTime || null,
                endTime: slot.endTime || null,
            });
        });
    });
    return entries;
};

export interface WeeklyScheduleEntry {
    date: string;
    dayOfWeek: number;
    subjectName: string;
    courseCode: string | null;
    startTime: string | null;
    endTime: string | null;
}

export const timetableService = {
    async createTimetable(
        streamId: string,
        input: CreateTimetableFrontendInput,
        userId: string,
    ): Promise<TimetableOutput> {
        await streamService.ensureAdminAccess(streamId, userId);

        const validFrom = normalizeDate(input.validFrom);
        const validUntil = input.validUntil ? normalizeDate(input.validUntil) : null;

        if (validUntil && validUntil < validFrom) {
            throw new BadRequestError('End date cannot be before start date.');
        }

        const latestTimetable = await prisma.timetable.findFirst({
            where: { streamId: streamId },
            orderBy: { validFrom: 'desc' },
            select: { validFrom: true },
        });

        if (latestTimetable && !isAfter(validFrom, latestTimetable.validFrom)) {
            throw new BadRequestError(
                `The new timetable's start date must be after the start date of the most recent timetable (${formatDate(latestTimetable.validFrom)}).`,
            );
        }

        const flatEntries = transformSubjectsToEntries(input.subjects);
        if (flatEntries.length === 0) {
            throw new BadRequestError('Timetable must have at least one schedule entry.');
        }

        const newTimetable = await timetableRepository.create(
            streamId,
            input.name,
            validFrom,
            validUntil,
            flatEntries,
        );

        return mapTimetableToOutput(newTimetable);
    },

    async getTimetablesForStream(streamId: string, userId: string): Promise<TimetableOutput[]> {
        await streamService.ensureMemberAccess(streamId, userId);

        const timetables = await timetableRepository.findByStream(streamId);
        return timetables.map(mapTimetableToOutput);
    },

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

        const days = getDaysInInterval(startDate, endDate);
        for (const day of days) {
            const activeTimetable = await timetableRepository.findActiveByStreamAndDate(
                streamId,
                day,
            );

            if (activeTimetable) {
                const dayOfWeek = getISODayOfWeek(day);
                activeTimetable.entries
                    .filter((entry) => entry.dayOfWeek === dayOfWeek)
                    .forEach((entry) => {
                        const dateStr = formatDate(day);
                        // The status here is always 'SCHEDULED' because if it were globally
                        // cancelled, findActiveByStreamAndDate should ideally know this,
                        // or we determine it later in attendanceService.
                        // Let's keep it simple: this function only returns the schedule.
                        schedule.push({
                            date: dateStr,
                            dayOfWeek: dayOfWeek,
                            subjectName: entry.subjectName,
                            courseCode: entry.courseCode,
                            startTime: entry.startTime,
                            endTime: entry.endTime,
                        });
                    });
            }
        }
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

    async calculateScheduledClasses(
        streamId: string,
        startDate: Date,
        endDate: Date,
        userId: string,
    ): Promise<Record<string, number>> {
        await streamService.ensureMemberAccess(streamId, userId);

        const scheduledCounts: Record<string, number> = {};
        const days = getDaysInInterval(startDate, endDate);
        for (const day of days) {
            const activeTimetable = await timetableRepository.findActiveByStreamAndDate(streamId, day);
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

    // --- Get Timetable Details ---
    async getTimetableDetails(timetableId: string, userId: string): Promise<TimetableOutput> {
        const timetable = await timetableRepository.findById(timetableId);
        if (!timetable) {
            throw new NotFoundError('Timetable not found');
        }
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

        await streamService.ensureAdminAccess(timetable.streamId, adminUserId);

        const endDate = normalizeDate(input.validUntil);
        if (isBefore(endDate, timetable.validFrom)) {
            throw new BadRequestError(
                "End date cannot be earlier than the timetable's start date.",
            );
        }

        const updatedTimetable = await timetableRepository.setEndDate(timetableId, endDate);
        const finalTimetable = await timetableRepository.findById(timetableId);

        if (!finalTimetable) throw new NotFoundError('Failed to retrieve updated timetable.');

        return mapTimetableToOutput(finalTimetable);
    },
};
