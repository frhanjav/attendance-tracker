import prisma from '../../infrastructure/prisma';
import { Timetable, TimetableEntry } from '@prisma/client';
import { isDateInTimetableRange, normalizeDate } from '../../core/utils';
import { isAfter, isEqual } from 'date-fns';

type TimetableEntryCreateInput = Omit<TimetableEntry, 'id' | 'timetableId'>;

export const timetableRepository = {
    async create(
        streamId: string,
        name: string,
        validFrom: Date,
        validUntil: Date | null,
        entriesData: TimetableEntryCreateInput[]
    ): Promise<Timetable & { entries: TimetableEntry[] }> {
        return prisma.$transaction(async (tx) => {
            const newTimetable = await tx.timetable.create({
                data: {
                    streamId,
                    name,
                    validFrom: normalizeDate(validFrom),
                    validUntil: validUntil ? normalizeDate(validUntil) : null,
                },
            });

            if (entriesData.length > 0) {
                await tx.timetableEntry.createMany({
                    data: entriesData.map(entry => ({
                        ...entry,
                        timetableId: newTimetable.id,
                    })),
                });
            }
            
            return tx.timetable.findUniqueOrThrow({
                 where: { id: newTimetable.id },
                 include: { entries: true }
            });
        });
    },

    // --- FIND BY ID ---
    async findById(timetableId: string): Promise<(Timetable & { entries: TimetableEntry[] }) | null> {
        return prisma.timetable.findUnique({
            where: { id: timetableId },
            include: { entries: true },
        });
    },

    async findByStream(streamId: string): Promise<(Timetable & { entries: TimetableEntry[] })[]> {
        return prisma.timetable.findMany({
            where: { streamId },
            include: { entries: true },
            orderBy: { validFrom: 'desc' },
        });
    },

    // --- FIND MANY FOR STREAM (For Import List) ---
     async findManyForStream(streamId: string): Promise<Pick<Timetable, 'id' | 'name' | 'validFrom' | 'validUntil'>[]> {
        return prisma.timetable.findMany({
            where: { streamId },
            select: {
                id: true,
                name: true,
                validFrom: true,
                validUntil: true,
            },
            orderBy: { validFrom: 'desc' },
        });
    },

    async findActiveByStreamAndDate(streamId: string, date: Date): Promise<(Timetable & { entries: TimetableEntry[] }) | null> {
        const normalizedTargetDate = normalizeDate(date);
        
        const latestPossibleTimetable = await prisma.timetable.findFirst({
            where: {
                streamId: streamId,
                validFrom: { lte: normalizedTargetDate },
            },
            include: { entries: true },
            orderBy: { validFrom: 'desc' },
        });

        if (!latestPossibleTimetable) {
            return null;
        }

        if (
            latestPossibleTimetable.validUntil === null ||
            isAfter(latestPossibleTimetable.validUntil, normalizedTargetDate) ||
            isEqual(latestPossibleTimetable.validUntil, normalizedTargetDate)
        ) {
            return latestPossibleTimetable;
        }

        return null;
    },

    async setEndDate(timetableId: string, endDate: Date): Promise<Timetable> {
        return prisma.timetable.update({
            where: { id: timetableId },
            data: {
                validUntil: normalizeDate(endDate),
            },
        });
    }
};
