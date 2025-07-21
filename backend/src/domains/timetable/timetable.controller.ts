import { Request, Response, NextFunction } from 'express';
import { timetableService } from './timetable.service';
import { CreateTimetableFrontendInput } from './timetable.dto';
import { ParsedQs } from 'qs';
import { z } from 'zod';
import { AuthenticatedUser } from '@/middleware/auth.middleware';
import { SetEndDateInput } from './timetable.dto';

// Define schema for weekly schedule query params if not using validateRequest middleware
const weeklyScheduleQuerySchema = z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const timetableController = {
    // --- Create Timetable ---
    async handleCreateTimetable(req: Request<{ streamId: string }, {}, CreateTimetableFrontendInput>, res: Response, next: NextFunction) {
        try {
            const user = req.user as AuthenticatedUser;
            if (!user?.id) throw new Error("Authentication error");
            const userId = user.id;
            const streamId = req.params.streamId;
            // Service now expects the nested structure directly from req.body
            const timetable = await timetableService.createTimetable(streamId, req.body, userId);
            res.status(201).json({ status: 'success', data: { timetable } });
        } catch (error) {
            next(error);
        }
    },

    async handleGetTimetables(req: Request<{ streamId: string }>, res: Response, next: NextFunction) {
        try {
            const user = req.user as AuthenticatedUser;
            if (!user?.id) throw new Error("Authentication error");
            const userId = user.id;
            const streamId = req.params.streamId;
            const timetables = await timetableService.getTimetablesForStream(streamId, userId);
            res.status(200).json({ status: 'success', results: timetables.length, data: { timetables } });
        } catch (error) {
            next(error);
        }
    },

    // Example: Get the timetable active on a specific date
    async handleGetActiveTimetable(req: Request<{ streamId: string }, {}, {}, { date?: string } & ParsedQs>, res: Response, next: NextFunction): Promise<void> {
        try {
            const user = req.user as AuthenticatedUser;
            if (!user?.id) throw new Error("Authentication error");
            const userId = user.id;
            const streamId = req.params.streamId;
            const dateString = req.query.date;

            if (!dateString || typeof dateString !== 'string') {
                 res.status(400).json({ status: 'fail', message: 'Missing or invalid date query parameter (YYYY-MM-DD)' });
                 return;
            }
             // Basic regex validation, Zod validation middleware is better
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
                 res.status(400).json({ status: 'fail', message: 'Invalid date format (YYYY-MM-DD)' });
                 return;
            }


            const timetable = await timetableService.getActiveTimetableForDate(streamId, dateString, userId);

            if (!timetable) {
                res.status(404).json({ status: 'fail', message: `No active timetable found for stream ${streamId} on ${dateString}` });
                return;
            }

            res.status(200).json({ status: 'success', data: { timetable } });
        } catch (error) {
            next(error);
        }
    },

    // --- Get Timetable Details ---
    async handleGetTimetableDetails(req: Request<{ timetableId: string }>, res: Response, next: NextFunction) {
        try {
            const user = req.user as AuthenticatedUser;
            if (!user?.id) throw new Error("Authentication error");
            const userId = user.id;
            const timetableId = req.params.timetableId;
            const timetable = await timetableService.getTimetableDetails(timetableId, userId);
            res.status(200).json({ status: 'success', data: { timetable } });
        } catch (error) {
            next(error);
        }
    },

    // --- Get Timetable List for Import ---
    async handleGetTimetableListForImport(req: Request<{ streamId: string }>, res: Response, next: NextFunction) {
        try {
            const user = req.user as AuthenticatedUser;
            if (!user?.id) throw new Error("Authentication error");
            const userId = user.id;
            const streamId = req.params.streamId;
            const timetableList = await timetableService.getTimetableListForImport(streamId, userId);
            res.status(200).json({ status: 'success', results: timetableList.length, data: { timetables: timetableList } });
        } catch (error) {
            next(error);
        }
    },

    // --- Get Weekly Schedule View ---
    async handleGetWeeklySchedule(
        req: Request<{ streamId: string }, {}, {}, { startDate?: string, endDate?: string } & ParsedQs>,
        res: Response,
        next: NextFunction
    ) {
         try {
            const user = req.user as AuthenticatedUser;
            if (!user?.id) throw new Error("Authentication error");
            const userId = user.id;
            const streamId = req.params.streamId;
            // Validation handled by middleware
            const { startDate, endDate } = req.query as { startDate: string, endDate: string };

            const weeklySchedule = await timetableService.getWeeklySchedule(streamId, startDate, endDate, userId);
            res.status(200).json({ status: 'success', data: { schedule: weeklySchedule } });
        } catch (error) {
            next(error);
        }
    },

    // --- Handler to set timetable end date ---
    async handleSetTimetableEndDate(req: Request<{ timetableId: string }, {}, SetEndDateInput>, res: Response, next: NextFunction) {
        try {
            const user = req.user as AuthenticatedUser;
            if (!user?.id) throw new Error("Authentication error");
            const updatedTimetable = await timetableService.setTimetableEndDate(req.params.timetableId, req.body, user.id);
            res.status(200).json({ status: 'success', data: { timetable: updatedTimetable } });
        } catch (error) {
            next(error);
        }
    }
};