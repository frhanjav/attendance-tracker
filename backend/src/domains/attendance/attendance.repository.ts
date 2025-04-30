import prisma from '../../infrastructure/prisma';
import { Prisma, AttendanceRecord, AttendanceStatus, BulkAttendanceEntry } from '@prisma/client';
import { normalizeDate } from '../../core/utils';

export const attendanceRepository = {
    /**
     * Creates or updates an attendance record for a specific user, stream, subject, and date.
     */
    async upsertRecord(data: {
        userId: string;
        streamId: string;
        subjectName: string;
        courseCode?: string | null;
        classDate: Date;
        status: AttendanceStatus;
        markedByUserId?: string; // Optional: track who marked it
    }): Promise<AttendanceRecord> {
        const normalizedClassDate = normalizeDate(data.classDate);
        return prisma.attendanceRecord.upsert({
            where: {
                // Unique constraint defined in schema.prisma
                userId_streamId_subjectName_classDate: {
                    userId: data.userId,
                    streamId: data.streamId,
                    subjectName: data.subjectName,
                    classDate: normalizedClassDate,
                },
            },
            update: {
                status: data.status,
                courseCode: data.courseCode, // Update course code if provided
                markedByUserId: data.markedByUserId,
                // markedAt is handled by @updatedAt
            },
            create: {
                userId: data.userId,
                streamId: data.streamId,
                subjectName: data.subjectName,
                courseCode: data.courseCode,
                classDate: normalizedClassDate,
                status: data.status,
                markedByUserId: data.markedByUserId,
            },
        });
    },

    /**
     * Finds attendance records for a user within a specific stream and date range.
     * Can optionally filter by subject.
     */
    async findRecordsByUserAndDateRange(
        userId: string,
        streamId: string,
        startDate: Date,
        endDate: Date,
        subjectName?: string
    ): Promise<AttendanceRecord[]> {
        const whereClause: Prisma.AttendanceRecordWhereInput = {
            userId,
            streamId,
            classDate: {
                gte: normalizeDate(startDate),
                lte: normalizeDate(endDate),
            },
        };
        if (subjectName) {
            whereClause.subjectName = subjectName;
        }

        return prisma.attendanceRecord.findMany({
            where: whereClause,
            orderBy: {
                classDate: 'asc', // Order by date
            },
        });
    },

    /**
     * Creates a record of a bulk attendance calculation.
     */
    async createBulkEntry(data: Omit<BulkAttendanceEntry, 'id' | 'calculationDate'>): Promise<BulkAttendanceEntry> {
        return prisma.bulkAttendanceEntry.create({
            data: {
                ...data,
                startDate: normalizeDate(data.startDate),
                endDate: normalizeDate(data.endDate),
            }
        });
    },

    /**
     * Finds bulk attendance entries for a user in a stream.
     */
    async findBulkEntriesByUser(userId: string, streamId: string): Promise<BulkAttendanceEntry[]> {
        return prisma.bulkAttendanceEntry.findMany({
            where: { userId, streamId },
            orderBy: { calculationDate: 'desc' }, // Show most recent first
        });
    },

     /**
     * Counts attendance records based on status for a user/stream/subject within a date range.
     */
     async countRecordsByStatus(
        userId: string,
        streamId: string,
        startDate: Date,
        endDate: Date,
        subjectName?: string
    ): Promise<{ status: AttendanceStatus; count: number }[]> {
        const whereClause: Prisma.AttendanceRecordWhereInput = {
            userId,
            streamId,
            classDate: {
                gte: normalizeDate(startDate),
                lte: normalizeDate(endDate),
            },
        };
        if (subjectName) {
            whereClause.subjectName = subjectName;
        }

        const result = await prisma.attendanceRecord.groupBy({
            by: ['status'],
            where: whereClause,
            _count: {
                status: true,
            },
        });

        // Map result to desired format
        return result.map(item => ({
            status: item.status,
            count: item._count.status,
        }));
    }
};