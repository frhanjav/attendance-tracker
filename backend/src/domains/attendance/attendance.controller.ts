import { Request, Response, NextFunction } from 'express';
import { attendanceService } from './attendance.service';
import { MarkAttendanceInput, BulkAttendanceInput } from './attendance.dto';
import { ParsedQs } from 'qs';

export const attendanceController = {
    async handleMarkAttendance(req: Request<{}, {}, MarkAttendanceInput>, res: Response, next: NextFunction) {
        try {
            const userId = req.user!.id;
            const record = await attendanceService.markDailyAttendance(req.body, userId);
            res.status(200).json({ status: 'success', data: { record } }); // 200 OK for upsert
        } catch (error) {
            next(error);
        }
    },

    async handleGetCalendar(req: Request<{}, {}, {}, { streamId?: string, startDate?: string, endDate?: string } & ParsedQs>, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user!.id;
            const { streamId, startDate, endDate } = req.query;

            // Basic validation (use Zod middleware for robustness)
            if (!streamId || typeof streamId !== 'string') {
                res.status(400).json({ status: 'fail', message: 'Missing streamId query parameter' });
                return;
            }
            if (!startDate || typeof startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
                res.status(400).json({ status: 'fail', message: 'Invalid or missing startDate (YYYY-MM-DD)' });
                return;
            }
            if (!endDate || typeof endDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)){
                res.status(400).json({ status: 'fail', message: 'Invalid or missing endDate (YYYY-MM-DD)' });
                return;
            } 


            const events = await attendanceService.getCalendarData(streamId, startDate, endDate, userId);
            res.status(200).json({ status: 'success', results: events.length, data: { events } });
        } catch (error) {
            next(error);
        }
    },

    async handleRecordBulkAttendance(req: Request<{}, {}, BulkAttendanceInput>, res: Response, next: NextFunction) {
        try {
            const userId = req.user!.id;
            const result = await attendanceService.recordBulkAttendance(req.body, userId);
            res.status(201).json({ status: 'success', data: result });
        } catch (error) {
            next(error);
        }
    },

     async handleGetAttendanceRecords(req: Request<{}, {}, {}, { streamId?: string, userId?: string, startDate?: string, endDate?: string, subjectName?: string } & ParsedQs>, res: Response, next: NextFunction) : Promise<void> {
        try {
            const requestingUserId = req.user!.id; // User making the API call
            const { streamId, userId: targetUserId, startDate, endDate, subjectName } = req.query;

            if (!streamId || typeof streamId !== 'string'){
                res.status(400).json({ status: 'fail', message: 'Missing streamId query parameter' });
                return;
            } 

            // If targetUserId is not provided, default to the requesting user
            const userIdToFetch = (typeof targetUserId === 'string' && targetUserId) ? targetUserId : requestingUserId;

            // Add validation for dates and subjectName if needed

            const records = await attendanceService.getAttendanceRecords(
                streamId,
                userIdToFetch,
                requestingUserId, // Pass requesting user for permission checks
                startDate,
                endDate,
                subjectName
            );
            res.status(200).json({ status: 'success', results: records.length, data: { records } });
        } catch (error) {
            next(error);
        }
    },
};