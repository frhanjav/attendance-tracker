import prisma from '../../infrastructure/prisma';
import { Prisma, AttendanceRecord, AttendanceStatus, BulkAttendanceEntry, ClassOverride, OverrideType } from '@prisma/client';
import { normalizeDate, formatDate } from '../../core/utils';

export const attendanceRepository = {
    async upsertRecord(data: {
        userId: string; streamId: string; subjectName: string; courseCode?: string | null;
        classDate: Date; status: AttendanceStatus; isReplacement?: boolean | null; // markedByUserId removed
    }): Promise<AttendanceRecord> {
        const normalizedClassDate = normalizeDate(data.classDate);
        const isReplacementValue = data.isReplacement ?? false;
        return prisma.attendanceRecord.upsert({
            where: {
                userId_streamId_subjectName_classDate_isReplacement: {
                    userId: data.userId, streamId: data.streamId,
                    subjectName: data.subjectName, classDate: normalizedClassDate,
                    isReplacement: isReplacementValue,
                },
            },
            update: { status: data.status },
            create: {
                userId: data.userId, streamId: data.streamId, subjectName: data.subjectName,
                courseCode: data.courseCode, classDate: normalizedClassDate,
                status: data.status,
                isReplacement: isReplacementValue,
            },
        });
    },

    async findRecordsByUserAndDateRange(
        userId: string, streamId: string, startDate: Date, endDate: Date, subjectName?: string
    ): Promise<AttendanceRecord[]> {
        const whereClause: Prisma.AttendanceRecordWhereInput = {
            userId, streamId, classDate: { gte: startDate, lte: endDate },
        };
        if (subjectName) { whereClause.subjectName = subjectName; }
        // Select new fields needed by service layer
        return prisma.attendanceRecord.findMany({
            where: whereClause,
            select: {
                id: true, userId: true, streamId: true, subjectName: true, courseCode: true,
                classDate: true, status: true, markedAt: true,
                isReplacement: true, originalSubjectName: true, originalCourseCode: true,
                originalStartTime: true, originalEndTime: true
            },
            orderBy: { classDate: 'asc' }
        });
    },

    async createBulkEntry(data: { // Use specific fields matching schema
        userId: string; streamId: string; subjectName: string; courseCode: string | null;
        attendedClasses: number; totalHeldClasses: number | null; // Use correct name, allow null
        startDate: Date; endDate: Date;
    }): Promise<BulkAttendanceEntry> {
        return prisma.bulkAttendanceEntry.create({
            data: {
                userId: data.userId,
                streamId: data.streamId,
                subjectName: data.subjectName,
                courseCode: data.courseCode,
                attendedClasses: data.attendedClasses,
                totalHeldClasses: data.totalHeldClasses, // Use correct field name
                startDate: normalizeDate(data.startDate),
                endDate: normalizeDate(data.endDate),
            }
        });
    },

    async findBulkEntriesByUser(userId: string, streamId: string): Promise<BulkAttendanceEntry[]> {
        return prisma.bulkAttendanceEntry.findMany({
            where: { userId, streamId },
            orderBy: { calculationDate: 'desc' },
        });
     },

    // --- NEW: Create or update a class override ---
    async createOrUpdateClassOverride(data: Omit<ClassOverride, 'id' | 'createdAt' | 'stream' | 'adminUser'>): Promise<ClassOverride> {
        const classDateNorm = normalizeDate(data.classDate);
        // Assuming startTime is NOT part of unique key based on schema change
        return prisma.classOverride.upsert({
            where: {
                streamId_classDate_originalSubjectName: { // Adjusted unique constraint name
                    streamId: data.streamId,
                    classDate: classDateNorm,
                    originalSubjectName: data.originalSubjectName,
                }
            },
            update: {
                overrideType: data.overrideType,
                replacementSubjectName: data.replacementSubjectName,
                replacementCourseCode: data.replacementCourseCode,
                replacementStartTime: data.replacementStartTime,
                replacementEndTime: data.replacementEndTime,
                adminUserId: data.adminUserId,
                originalStartTime: data.originalStartTime, // Update original time if needed
            },
            create: {
                streamId: data.streamId,
                classDate: classDateNorm,
                originalSubjectName: data.originalSubjectName,
                originalStartTime: data.originalStartTime, // Store original time
                overrideType: data.overrideType,
                replacementSubjectName: data.replacementSubjectName,
                replacementCourseCode: data.replacementCourseCode,
                replacementStartTime: data.replacementStartTime,
                replacementEndTime: data.replacementEndTime,
                adminUserId: data.adminUserId,
            }
        });
    },

    // --- NEW: Find all overrides for a stream within a date range ---
    async findOverridesForWeek(streamId: string, startDate: Date, endDate: Date): Promise<ClassOverride[]> {
        return prisma.classOverride.findMany({
            where: {
                streamId: streamId,
                classDate: { gte: startDate, lte: endDate }
            }
        });
    },

    // --- NEW: Get Set of Globally Cancelled Class Keys for a Week ---
    async getCancelledClassKeys(streamId: string, startDate: Date, endDate: Date): Promise<Set<string>> {
        const cancelledRecords = await prisma.attendanceRecord.findMany({
            where: {
                streamId: streamId,
                status: AttendanceStatus.CANCELLED,
                classDate: { gte: startDate, lte: endDate },
            },
            distinct: ['classDate', 'subjectName'], // Add startTime if needed for uniqueness
            select: {
                classDate: true,
                subjectName: true,
            }
        });

        // Create a Set of unique keys (e.g., "YYYY-MM-DD_SubjectName_HH:MM")
        const cancelledKeys = new Set<string>();
        cancelledRecords.forEach(rec => {
            const dateStr = formatDate(rec.classDate); // Use consistent format
            const key = `${dateStr}_${rec.subjectName}`;
            cancelledKeys.add(key);
        });
        return cancelledKeys;
    },

    // --- REMOVED countRecordsByStatus ---
    // --- REMOVED updateStatusForAllUsers ---
    // --- REMOVED countCancelledClasses (logic moved to service/analytics) ---
    // --- REMOVED findReplacementClasses (logic moved to service/analytics) ---
};