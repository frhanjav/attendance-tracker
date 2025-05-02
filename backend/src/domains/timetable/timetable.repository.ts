import prisma from '../../infrastructure/prisma';
import { Prisma, Timetable, TimetableEntry } from '@prisma/client';
import { normalizeDate } from '../../core/utils';

type TimetableEntryCreateInput = Omit<TimetableEntry, 'id' | 'timetableId'>;

export const timetableRepository = {
    // --- CREATE (Remains largely the same) ---
    async create(
        streamId: string,
        name: string,
        validFrom: Date,
        validUntil: Date | null,
        entriesData: TimetableEntryCreateInput[]
    ): Promise<Timetable & { entries: TimetableEntry[] }> {
        // Use transaction to ensure timetable and entries are created together
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
                        timetableId: newTimetable.id, // Link to the new timetable
                    })),
                });
            }
            // Fetch again to include entries
            return tx.timetable.findUniqueOrThrow({
                 where: { id: newTimetable.id },
                 include: { entries: true }
            });
        });
    },

    // --- FIND BY ID (Remains the same) ---
    async findById(timetableId: string): Promise<(Timetable & { entries: TimetableEntry[] }) | null> {
        return prisma.timetable.findUnique({
            where: { id: timetableId },
            include: { entries: true },
        });
    },

    async findByStream(streamId: string): Promise<(Timetable & { entries: TimetableEntry[] })[]> {
        return prisma.timetable.findMany({
            where: { streamId },
            include: { entries: true }, // Make sure to include entries
            orderBy: { validFrom: 'desc' },
        });
    },

    // --- FIND MANY FOR STREAM (For Import List) ---
     async findManyForStream(streamId: string): Promise<Pick<Timetable, 'id' | 'name' | 'validFrom' | 'validUntil'>[]> {
        return prisma.timetable.findMany({
            where: { streamId },
            select: { // Select only needed fields for the list
                id: true,
                name: true,
                validFrom: true,
                validUntil: true,
            },
            orderBy: { validFrom: 'desc' }, // Show newest first
        });
    },

    // --- FIND ACTIVE (Remains the same, used by other services) ---
    async findActiveByStreamAndDate(streamId: string, date: Date): Promise<(Timetable & { entries: TimetableEntry[] }) | null> {
        // ... (implementation remains the same) ...
         const normalizedTargetDate = normalizeDate(date);
        const candidates = await prisma.timetable.findMany({
            where: {
                streamId: streamId,
                validFrom: { lte: normalizedTargetDate },
                OR: [ { validUntil: null }, { validUntil: { gte: normalizedTargetDate } } ],
            },
            include: { entries: true },
            orderBy: { validFrom: 'desc' },
            take: 1,
        });
        return candidates.length > 0 ? candidates[0] : null;
    },

    // --- REMOVED update method ---
    // --- REMOVED deleteById method ---
    // --- REMOVED getStreamIdForTimetable (no longer needed for update/delete permissions) ---
};