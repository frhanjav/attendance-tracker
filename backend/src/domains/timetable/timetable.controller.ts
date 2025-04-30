import { Request, Response, NextFunction } from 'express';
import { timetableService } from './timetable.service';
import { CreateTimetableFrontendInput } from './timetable.dto';
import { ParsedQs } from 'qs'; // For typed query params

export const timetableController = {
    // --- Create Timetable (Uses new schema/service input) ---
    async handleCreateTimetable(req: Request<{ streamId: string }, {}, CreateTimetableFrontendInput>, res: Response, next: NextFunction) {
        try {
            const userId = req.user!.id;
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
            const userId = req.user!.id;
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
            const userId = req.user!.id;
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

    // --- NEW: Get Timetable Details ---
    async handleGetTimetableDetails(req: Request<{ timetableId: string }>, res: Response, next: NextFunction) {
        try {
            const userId = req.user!.id;
            const timetableId = req.params.timetableId;
            const timetable = await timetableService.getTimetableDetails(timetableId, userId);
            res.status(200).json({ status: 'success', data: { timetable } });
        } catch (error) {
            next(error);
        }
    },

    // --- NEW: Update Timetable ---
    async handleUpdateTimetable(req: Request<{ timetableId: string }, {}, CreateTimetableFrontendInput>, res: Response, next: NextFunction) {
         try {
            const userId = req.user!.id;
            const timetableId = req.params.timetableId;
            // Service expects nested structure from req.body
            const timetable = await timetableService.updateTimetable(timetableId, req.body, userId);
            res.status(200).json({ status: 'success', data: { timetable } });
        } catch (error) {
            next(error);
        }
    },

    // --- NEW: Delete Timetable ---
    async handleDeleteTimetable(req: Request<{ timetableId: string }>, res: Response, next: NextFunction) {
        try {
            const userId = req.user!.id;
            const timetableId = req.params.timetableId;
            const result = await timetableService.deleteTimetable(timetableId, userId);
            res.status(200).json({ status: 'success', data: result }); // Or status 204 No Content
        } catch (error) {
            next(error);
        }
    },
};