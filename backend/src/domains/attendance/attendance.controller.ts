import { Request, Response, NextFunction } from 'express';
import { attendanceService } from './attendance.service';
import { MarkAttendanceInput, BulkAttendanceInput, CancelClassInput, ReplaceClassInput } from './attendance.dto';
import { ParsedQs } from 'qs';
import { AuthenticatedUser } from '@/middleware/auth.middleware';

export const attendanceController = {
    async handleMarkAttendance(req: Request<{}, {}, MarkAttendanceInput>, res: Response, next: NextFunction) {
        try {
            const user = req.user as AuthenticatedUser;
            if (!user?.id) throw new Error("Authentication error");
            const userId = user.id;
            const record = await attendanceService.markDailyAttendance(req.body, userId);
            res.status(200).json({ status: 'success', data: { record } });
        } catch (error) {
            next(error);
        }
    },

    async handleRecordBulkAttendance(req: Request<{}, {}, BulkAttendanceInput>, res: Response, next: NextFunction) {
        try {
            const user = req.user as AuthenticatedUser;
            if (!user?.id) throw new Error("Authentication error");
            const userId = user.id;
            const result = await attendanceService.recordBulkAttendance(req.body, userId);
            res.status(201).json({ status: 'success', data: result });
        } catch (error) {
            next(error);
        }
    },

     async handleGetAttendanceRecords(req: Request<{}, {}, {}, { streamId?: string, userId?: string, startDate?: string, endDate?: string, subjectName?: string } & ParsedQs>, res: Response, next: NextFunction) : Promise<void> {
        try {
            const requestingUser = req.user as AuthenticatedUser;
            if (!requestingUser?.id) throw new Error("Authentication error");
            const requestingUserId = requestingUser.id;
            const { streamId, userId: targetUserId, startDate, endDate, subjectName } = req.query;

            if (!streamId || typeof streamId !== 'string'){
                res.status(400).json({ status: 'fail', message: 'Missing streamId query parameter' });
                return;
            } 

            const userIdToFetch = (typeof targetUserId === 'string' && targetUserId) ? targetUserId : requestingUserId;

            const records = await attendanceService.getAttendanceRecords(
                streamId,
                userIdToFetch,
                requestingUserId,
                startDate,
                endDate,
                subjectName
            );
            res.status(200).json({ status: 'success', results: records.length, data: { records } });
        } catch (error) {
            next(error);
        }
    },

    async handleCancelClassGlobally(req: Request<{}, {}, CancelClassInput>, res: Response, next: NextFunction) {
        try {
            const adminUser = req.user as AuthenticatedUser;
            if (!adminUser?.id) throw new Error("Authentication error");
            const adminUserId = adminUser.id;
            const result = await attendanceService.cancelClassGlobally(req.body, adminUserId);
            res.status(200).json({ status: 'success', data: result });
        } catch (error) {
            next(error);
        }
    },

    async handleReplaceClassGlobally(req: Request<{}, {}, ReplaceClassInput>, res: Response, next: NextFunction) {
        try {
            const adminUserId = (req.user as AuthenticatedUser).id;
            if (!adminUserId) throw new Error("Authentication error");
            const result = await attendanceService.replaceClassGlobally(req.body, adminUserId);
            res.status(200).json({ status: 'success', data: result });
        } catch (error) {
            next(error);
        }
    },

    async handleGetWeeklyAttendanceView(
        req: Request<{ streamId: string }, {}, {}, { startDate?: string, endDate?: string } & ParsedQs>,
        res: Response,
        next: NextFunction
    ) {
        try {
            const user = req.user as AuthenticatedUser;
            if (!user?.id) throw new Error("Authentication error");
            const userId = user.id;
            const streamId = req.params.streamId;
            const { startDate, endDate } = req.query as { startDate: string, endDate: string };

            const weeklyView = await attendanceService.getWeeklyAttendanceView(streamId, startDate, endDate, userId);
            res.status(200).json({ status: 'success', data: { attendanceView: weeklyView } });
        } catch (error) {
            next(error);
        }
    },
};