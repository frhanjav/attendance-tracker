import { Timetable, TimetableEntry } from '@prisma/client';
import { isAfter, isBefore, isEqual } from 'date-fns';
import { BadRequestError, NotFoundError } from '../../core/errors';
import {
  formatDate,
  getDaysInInterval,
  getISODayOfWeek,
  normalizeDate,
} from '../../core/utils';
import prisma from '../../infrastructure/prisma';
import { streamService } from '../stream/stream.service';
import {
  CreateTimetableFrontendInput,
  SetEndDateInput,
  TimetableBasicInfo,
  TimetableEntryOutput,
  TimetableOutput,
} from './timetable.dto';
import { timetableRepository } from './timetable.repository';

type FlatTimetableEntryInput = Omit<TimetableEntry, 'id' | 'timetableId'>;

type TimetableWithEntries = Timetable & { entries: TimetableEntry[] };

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
            select: { id: true, validFrom: true, validUntil: true },
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

        if (latestTimetable && latestTimetable.validUntil === null) {
            const previousTimetableEndDate = new Date(validFrom);
            previousTimetableEndDate.setDate(previousTimetableEndDate.getDate() - 1);
            
            await timetableRepository.setEndDate(
                latestTimetable.id,
                normalizeDate(previousTimetableEndDate)
            );
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
        await streamService.ensureMemberAccess(streamId, userId);
        const timetables = await timetableRepository.findManyForStream(streamId);
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

        const relevantTimetables = await timetableRepository.findActiveTimetablesForDateRange(
            streamId,
            startDate,
            endDate,
        );

        const days = getDaysInInterval(startDate, endDate);
        for (const day of days) {
            const validTimetablesForDay = relevantTimetables.filter((tt: Timetable & { entries: TimetableEntry[] }) => 
                tt.validFrom <= day && 
                (tt.validUntil === null || tt.validUntil >= day)
            );
            
            const activeTimetable = validTimetablesForDay.sort((a, b) => 
                b.validFrom.getTime() - a.validFrom.getTime()
            )[0];

            if (activeTimetable) {
                const dayOfWeek = getISODayOfWeek(day);
                activeTimetable.entries
                    .filter((entry: TimetableEntry) => entry.dayOfWeek === dayOfWeek)
                    .forEach((entry: TimetableEntry) => {
                        const dateStr = formatDate(day);
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

        const potentiallyActiveTimetables: TimetableWithEntries[] = await prisma.timetable.findMany({
             where: {
                 streamId: streamId,
                 validFrom: { lte: endDate },
                 OR: [
                     { validUntil: null },
                     { validUntil: { gte: startDate } }
                 ]
             },
             include: { entries: true },
             orderBy: { validFrom: 'desc' }
        });

        if (potentiallyActiveTimetables.length === 0) {
            return {};
        }

        const scheduledCounts: Record<string, number> = {};
        const days = getDaysInInterval(startDate, endDate);
        for (const day of days) {
            const latestPossibleTimetable = potentiallyActiveTimetables.find(tt =>
                !isAfter(tt.validFrom, day)
            );

            if (latestPossibleTimetable) {
                const isStillValid = (
                    latestPossibleTimetable.validUntil === null ||
                    isAfter(latestPossibleTimetable.validUntil, day) ||
                    isEqual(latestPossibleTimetable.validUntil, day)
                );

                if (isStillValid) {
                    const dayOfWeek = getISODayOfWeek(day);
                    latestPossibleTimetable.entries
                        .filter(entry => entry.dayOfWeek === dayOfWeek)
                        .forEach(entry => {
                            scheduledCounts[entry.subjectName] = (scheduledCounts[entry.subjectName] || 0) + 1;
                        });
                }
            }
        }
        console.log(`[Timetable Service BE] Analytics scheduled counts calculated.`);
        return scheduledCounts;
    },

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

        const finalTimetable = await timetableRepository.findById(timetableId);

        if (!finalTimetable) throw new NotFoundError('Failed to retrieve updated timetable.');

        return mapTimetableToOutput(finalTimetable);
    },
};
