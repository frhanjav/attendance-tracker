import { AttendanceRecord, AttendanceStatus, BulkAttendanceEntry, ClassOverride, Prisma } from '@prisma/client';
import { formatDate, normalizeDate } from '../../core/utils';
import prisma from '../../infrastructure/prisma';

export const attendanceRepository = {
    async upsertRecord(data: {
        userId: string; streamId: string; subjectName: string; courseCode?: string | null;
        classDate: Date; status: AttendanceStatus; isReplacement?: boolean | null;
        subjectIndex: number;
    }): Promise<AttendanceRecord> {
        const normalizedClassDate = normalizeDate(data.classDate);
        const isReplacementValue = data.isReplacement ?? false;
        return prisma.attendanceRecord.upsert({
            where: {
                userId_streamId_subjectName_classDate_subjectIndex_isReplacement: {
                    userId: data.userId, streamId: data.streamId,
                    subjectName: data.subjectName, classDate: normalizedClassDate,
                    subjectIndex: data.subjectIndex, isReplacement: isReplacementValue,
                },
            },
            update: { status: data.status },
            create: {
                userId: data.userId, streamId: data.streamId, subjectName: data.subjectName,
                courseCode: data.courseCode, classDate: normalizedClassDate,
                status: data.status,
                isReplacement: isReplacementValue,
                subjectIndex: data.subjectIndex,
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
        return prisma.attendanceRecord.findMany({
            where: whereClause,
            select: {
                id: true, userId: true, streamId: true, subjectName: true, courseCode: true,
                classDate: true, status: true, markedAt: true,
                isReplacement: true, originalSubjectName: true, originalCourseCode: true,
                originalStartTime: true, originalEndTime: true, subjectIndex: true
            },
            orderBy: { classDate: 'asc' }
        });
    },

    async createBulkEntry(data: {
        userId: string; streamId: string; subjectName: string; courseCode: string | null;
        attendedClasses: number; totalHeldClasses: number | null;
        startDate: Date; endDate: Date;
    }): Promise<BulkAttendanceEntry> {
        return prisma.bulkAttendanceEntry.create({
            data: {
                userId: data.userId,
                streamId: data.streamId,
                subjectName: data.subjectName,
                courseCode: data.courseCode,
                attendedClasses: data.attendedClasses,
                totalHeldClasses: data.totalHeldClasses,
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

    async createOrUpdateClassOverride(data: Omit<ClassOverride, 'id' | 'createdAt' | 'stream' | 'adminUser'>): Promise<ClassOverride> {
        const classDateNorm = normalizeDate(data.classDate);
        return prisma.classOverride.upsert({
            where: {
                streamId_classDate_originalSubjectName_entryIndex: {
                    streamId: data.streamId,
                    classDate: classDateNorm,
                    originalSubjectName: data.originalSubjectName,
                    entryIndex: data.entryIndex,
                }
            },
            update: {
                overrideType: data.overrideType,
                replacementSubjectName: data.replacementSubjectName,
                replacementCourseCode: data.replacementCourseCode,
                replacementStartTime: data.replacementStartTime,
                replacementEndTime: data.replacementEndTime,
                adminUserId: data.adminUserId,
                originalStartTime: data.originalStartTime,
                entryIndex: data.entryIndex,
            },
            create: {
                streamId: data.streamId,
                classDate: classDateNorm,
                originalSubjectName: data.originalSubjectName,
                originalStartTime: data.originalStartTime,
                entryIndex: data.entryIndex,
                overrideType: data.overrideType,
                replacementSubjectName: data.replacementSubjectName,
                replacementCourseCode: data.replacementCourseCode,
                replacementStartTime: data.replacementStartTime,
                replacementEndTime: data.replacementEndTime,
                adminUserId: data.adminUserId,
            }
        });
    },

    async findOverridesForWeek(streamId: string, startDate: Date, endDate: Date): Promise<ClassOverride[]> {
        return prisma.classOverride.findMany({
            where: {
                streamId: streamId,
                classDate: { gte: startDate, lte: endDate }
            },
            orderBy: { classDate: 'asc' }
        });
    },

    async getWeeklyAttendanceData(
        userId: string,
        streamId: string, 
        startDate: Date, 
        endDate: Date
    ): Promise<{
        attendanceRecords: AttendanceRecord[];
        overrides: ClassOverride[];
    }> {
        const [attendanceRecords, overrides] = await Promise.all([
            this.findRecordsByUserAndDateRange(userId, streamId, startDate, endDate),
            this.findOverridesForWeek(streamId, startDate, endDate)
        ]);

        return {
            attendanceRecords,
            overrides
        };
    },

    async getCancelledClassKeys(streamId: string, startDate: Date, endDate: Date): Promise<Set<string>> {
        const cancelledRecords = await prisma.attendanceRecord.findMany({
            where: {
                streamId: streamId,
                status: AttendanceStatus.CANCELLED,
                classDate: { gte: startDate, lte: endDate },
            },
            distinct: ['classDate', 'subjectName', 'subjectIndex'],
            select: {
                classDate: true,
                subjectName: true,
                subjectIndex: true,
            }
        });

        const cancelledKeys = new Set<string>();
        cancelledRecords.forEach(rec => {
            const dateStr = formatDate(rec.classDate);
            const key = `${dateStr}_${rec.subjectName}_${rec.subjectIndex}`;
            cancelledKeys.add(key);
        });
        return cancelledKeys;
    },
};