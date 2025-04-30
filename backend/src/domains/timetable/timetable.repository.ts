import prisma from '../../infrastructure/prisma';
import { Prisma, Timetable, TimetableEntry } from '@prisma/client';
import { normalizeDate } from '../../core/utils';

type TimetableEntryCreateInput = Omit<TimetableEntry, 'id' | 'timetableId'>;

export const timetableRepository = {
    async create(
        streamId: string,
        name: string,
        validFrom: Date,
        validUntil: Date | null,
        entries: Omit<TimetableEntry, 'id' | 'timetableId'>[]
    ): Promise<Timetable & { entries: TimetableEntry[] }>{
        return prisma.timetable.create({
            data: {
                streamId,
                name,
                validFrom: normalizeDate(validFrom), // Store normalized date
                validUntil: validUntil ? normalizeDate(validUntil) : null,
                entries: {
                    create: entries, // Use Prisma's nested create feature
                },
            },
            include: {
                entries: true, // Include entries in the returned object
            }
        });
    },

    async findByStream(streamId: string): Promise<(Timetable & { entries: TimetableEntry[] })[]> {
        return prisma.timetable.findMany({
            where: { streamId },
            include: { entries: true },
            orderBy: { validFrom: 'desc' }, // Show newest first
        });
    },

    /**
     * Finds the single timetable that is active for a specific date within a stream.
     * It prioritizes timetables with a closer validFrom date if multiple overlap.
     * It considers validUntil.
     */
    async findActiveByStreamAndDate(streamId: string, date: Date): Promise<(Timetable & { entries: TimetableEntry[] }) | null> {
        const normalizedTargetDate = normalizeDate(date);

        // Find potential candidates: validFrom <= date AND (validUntil >= date OR validUntil IS NULL)
        const candidates = await prisma.timetable.findMany({
            where: {
                streamId: streamId,
                validFrom: {
                    lte: normalizedTargetDate, // Timetable must have started on or before the target date
                },
                OR: [
                    { validUntil: null }, // Timetable has no end date
                    { validUntil: { gte: normalizedTargetDate } }, // Timetable ends on or after the target date
                ],
            },
            include: {
                entries: true,
            },
            orderBy: {
                validFrom: 'desc', // Prioritize the one that started most recently
            },
            take: 1, // Get only the most recent valid one
        });

        return candidates.length > 0 ? candidates[0] : null;
    },

    async findById(timetableId: string): Promise<(Timetable & { entries: TimetableEntry[] }) | null> {
        return prisma.timetable.findUnique({
            where: { id: timetableId },
            include: { entries: true },
        });
    },

    async update(
        timetableId: string,
        data: {
            name: string;
            validFrom: Date;
            validUntil: Date | null;
            // Expect flat entries array here, service layer will transform
            entriesData: TimetableEntryCreateInput[];
        }
    ): Promise<Timetable & { entries: TimetableEntry[] }> {
        // Use a transaction to ensure atomicity: delete old entries, update timetable, create new entries
        return prisma.$transaction(async (tx) => {
            // 1. Delete existing entries for this timetable
            await tx.timetableEntry.deleteMany({
                where: { timetableId: timetableId },
            });

            // 2. Update the timetable metadata (name, dates)
            const updatedTimetable = await tx.timetable.update({
                where: { id: timetableId },
                data: {
                    name: data.name,
                    validFrom: normalizeDate(data.validFrom),
                    validUntil: data.validUntil ? normalizeDate(data.validUntil) : null,
                    // Don't update entries directly here
                },
            });

            // 3. Create the new entries
            if (data.entriesData.length > 0) {
                await tx.timetableEntry.createMany({
                    data: data.entriesData.map(entry => ({
                        ...entry,
                        timetableId: timetableId, // Link to the updated timetable
                    })),
                });
            }

            // 4. Fetch the updated timetable with its new entries
            // We need to query again outside the update to get included relations reliably after createMany
            const result = await tx.timetable.findUniqueOrThrow({
                 where: { id: timetableId },
                 include: { entries: true }
            });

            return result;
        });
    },

    async deleteById(timetableId: string): Promise<Timetable> {
        // Prisma cascading delete should handle entries if set up in schema.prisma
        // onDelete: Cascade on the TimetableEntry relation to Timetable
        // If not using cascade, delete entries manually first in a transaction.
        return prisma.timetable.delete({
            where: { id: timetableId },
        });
    },

    // Helper to get streamId for permission checks
    async getStreamIdForTimetable(timetableId: string): Promise<string | null> {
        const timetable = await prisma.timetable.findUnique({
            where: { id: timetableId },
            select: { streamId: true }
        });
        return timetable?.streamId ?? null;
    }

    // Add update/delete methods as needed
};