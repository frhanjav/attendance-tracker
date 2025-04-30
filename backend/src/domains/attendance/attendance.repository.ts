import prisma from '../../infrastructure/prisma';
import { Prisma, AttendanceRecord, AttendanceStatus, BulkAttendanceEntry } from '@prisma/client';
import { normalizeDate, formatDate } from '../../core/utils';

export const attendanceRepository = {
    /**
     * Creates or updates an attendance record for a specific user, stream, subject, and date.
     */
    async upsertRecord(data: {
        userId: string; streamId: string; subjectName: string; courseCode?: string | null;
        classDate: Date; status: AttendanceStatus; markedByUserId?: string; // markedByUserId is optional now
    }): Promise<AttendanceRecord> {
        const normalizedClassDate = normalizeDate(data.classDate);
        return prisma.attendanceRecord.upsert({
            where: {
                userId_streamId_subjectName_classDate: {
                    userId: data.userId, streamId: data.streamId,
                    subjectName: data.subjectName, classDate: normalizedClassDate,
                },
            },
            update: { status: data.status /*, markedByUserId: data.markedByUserId */ }, // Don't update markedByUserId if column removed
            create: {
                userId: data.userId, streamId: data.streamId, subjectName: data.subjectName,
                courseCode: data.courseCode, classDate: normalizedClassDate,
                status: data.status, // Default MISSED will apply if not provided, but we always provide
                // markedByUserId: data.markedByUserId, // Don't create if column removed
            },
        });
    },

    /**
     * Finds attendance records for a user within a specific stream and date range.
     * Can optionally filter by subject.
     */
    async findRecordsByUserAndDateRange(
        userId: string, streamId: string, startDate: Date, endDate: Date, subjectName?: string
    ): Promise<AttendanceRecord[]> {
        const whereClause: Prisma.AttendanceRecordWhereInput = {
            userId, streamId, classDate: { gte: startDate, lte: endDate },
        };
        if (subjectName) { whereClause.subjectName = subjectName; }
        return prisma.attendanceRecord.findMany({ where: whereClause, orderBy: { classDate: 'asc' } });
    },

    /**
     * Creates a record of a bulk attendance calculation.
     */
    async createBulkEntry(data: Omit<BulkAttendanceEntry, 'id' | 'calculationDate'>): Promise<BulkAttendanceEntry> {
        // Ensure the data passed matches the current schema (with totalHeldClasses?)
        return prisma.bulkAttendanceEntry.create({
            data: {
                userId: data.userId,
                streamId: data.streamId,
                subjectName: data.subjectName,
                courseCode: data.courseCode,
                attendedClasses: data.attendedClasses,
                totalHeldClasses: data.totalHeldClasses, // Use the correct field name
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
    },

    // --- NEW: Update status for multiple users ---
    async updateStatusForAllUsers(
        streamId: string,
        userIds: string[],
        classDate: Date,
        subjectName: string,
        newStatus: AttendanceStatus
        // adminUserId?: string // Optional: if tracking who cancelled
    ): Promise<number> {
        // Using loop and upsert for simplicity and compatibility
        let updatedCount = 0;
        const normalizedClassDate = normalizeDate(classDate);
        console.log(`[Repo] Updating status to ${newStatus} for ${userIds.length} users on ${formatDate(normalizedClassDate)} for ${subjectName}`);

        for (const userId of userIds) {
            try {
                await prisma.attendanceRecord.upsert({
                    where: {
                        userId_streamId_subjectName_classDate: { userId, streamId, subjectName, classDate: normalizedClassDate }
                    },
                    // Set status, update markedAt automatically
                    update: { status: newStatus /*, markedByUserId: adminUserId */ },
                    // Create with status if record doesn't exist
                    create: { userId, streamId, subjectName, classDate: normalizedClassDate, status: newStatus /*, markedByUserId: adminUserId */ }
                });
                updatedCount++;
            } catch (error) {
                 console.error(`[Repo] Failed to upsert status for user ${userId}:`, error);
                 // Decide if one failure should stop the whole process or just be logged
            }
        }
        console.log(`[Repo] Successfully updated status for ${updatedCount} users.`);
        return updatedCount;
    },

     // --- NEW: Count distinct cancelled class instances ---
     async countCancelledClasses(streamId: string, startDate: Date, endDate: Date): Promise<Record<string, number>> {
        // Find records marked as CANCELLED within the date range for the stream
        // We group by date and subjectName to count distinct cancelled *class instances*
        const cancelledGroups = await prisma.attendanceRecord.groupBy({
            by: ['classDate', 'subjectName'], // Group by the unique class instance identifier
            where: {
                streamId: streamId,
                status: AttendanceStatus.CANCELLED,
                classDate: { gte: startDate, lte: endDate },
            },
            _count: { // We just need to know each group exists
                _all: true,
            }
        });

        // Now count how many distinct cancelled instances occurred for each subject
        const counts: Record<string, number> = {};
        for (const group of cancelledGroups) {
            counts[group.subjectName] = (counts[group.subjectName] || 0) + 1;
        }
        return counts;
    }
};