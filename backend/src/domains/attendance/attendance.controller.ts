import { Request, Response, NextFunction } from 'express';
import { attendanceService } from './attendance.service';
import { MarkAttendanceInput, BulkAttendanceInput, CancelClassInput, ReplaceClassInput, ReplaceClassSchema } from './attendance.dto';
import { ParsedQs } from 'qs';
import { z } from 'zod'; // Import Zod if needed for inline validation (though schema is better)
import { AuthenticatedUser } from '@/middleware/auth.middleware';

// Define schema for weekly view query params if not using validateRequest middleware for it
const weeklyViewQuerySchema = z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const attendanceController = {
    async handleMarkAttendance(req: Request<{}, {}, MarkAttendanceInput>, res: Response, next: NextFunction) {
        try {
            const user = req.user as AuthenticatedUser; // Assert type
            if (!user?.id) throw new Error("Authentication error"); // Runtime check
            const userId = user.id; // Use the asserted user
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

    // --- NEW: Cancel Class Globally (Admin) ---
    async handleCancelClassGlobally(req: Request<{}, {}, CancelClassInput>, res: Response, next: NextFunction) {
        try {
            const adminUser = req.user as AuthenticatedUser;
            if (!adminUser?.id) throw new Error("Authentication error");
            const adminUserId = adminUser.id;
            // Input validation is handled by validateRequest(CancelClassSchema) middleware
            const result = await attendanceService.cancelClassGlobally(req.body, adminUserId);
            res.status(200).json({ status: 'success', data: result });
        } catch (error) {
            next(error);
        }
    },

    // --- NEW: Handle Replace Class Request ---
    async handleReplaceClassGlobally(req: Request<{}, {}, ReplaceClassInput>, res: Response, next: NextFunction) {
        try {
            const adminUserId = (req.user as AuthenticatedUser).id; // Assert user type
            if (!adminUserId) throw new Error("Authentication error");
            // Validation handled by middleware
            const result = await attendanceService.replaceClassGlobally(req.body, adminUserId);
            res.status(200).json({ status: 'success', data: result });
        } catch (error) {
            next(error);
        }
    },

    // --- NEW: Get Weekly Attendance View (Student/Member) ---
    async handleGetWeeklyAttendanceView(
        // Define Params and Query types based on route and expected query params
        req: Request<{ streamId: string }, {}, {}, { startDate?: string, endDate?: string } & ParsedQs>,
        res: Response,
        next: NextFunction
    ) {
        try {
            const user = req.user as AuthenticatedUser;
            if (!user?.id) throw new Error("Authentication error");
            const userId = user.id; // Logged-in user requesting their view
            const streamId = req.params.streamId;
            // Validation of query params is handled by validateRequest middleware
            const { startDate, endDate } = req.query as { startDate: string, endDate: string }; // Cast after validation

            const weeklyView = await attendanceService.getWeeklyAttendanceView(streamId, startDate, endDate, userId);
            res.status(200).json({ status: 'success', data: { attendanceView: weeklyView } });
        } catch (error) {
            next(error);
        }
    },
};