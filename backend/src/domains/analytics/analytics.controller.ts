import { Request, Response, NextFunction } from 'express';
import { analyticsService } from './analytics.service';
import { AttendanceCalculatorInput } from './analytics.dto';
import { ParsedQs } from 'qs';
import { AuthenticatedUser } from '@/middleware/auth.middleware';

export const analyticsController = {
    async handleGetStreamAnalytics(
        req: Request<
            { streamId: string },
            {},
            {},
            { userId?: string; startDate?: string; endDate?: string } & ParsedQs
        >,
        res: Response,
        next: NextFunction,
    ) {
        try {
            const requestingUser = req.user as AuthenticatedUser; // Assert it has at least an id
            if (!requestingUser?.id) {
                // Optional: Add runtime check for safety
                return next(new Error('Authentication error: User ID not found on request.'));
            }
            const requestingUserId = requestingUser.id;

            const streamId = req.params.streamId;
            const { userId: targetUserIdParam, startDate, endDate } = req.query;

            // Default to the requesting user if target user ID is not provided
            const targetUserId =
                typeof targetUserIdParam === 'string' && targetUserIdParam
                    ? targetUserIdParam
                    : requestingUserId;

            // Add validation for dates if needed

            const stats = await analyticsService.getStreamAttendanceStats(
                streamId,
                targetUserId,
                requestingUserId,
                startDate,
                endDate,
            );
            res.status(200).json({ status: 'success', data: { stats } });
        } catch (error) {
            next(error);
        }
    },

    // Example: Get stats for a specific subject (could be combined with above)
    async handleGetSubjectAnalytics(
        req: Request<
            { streamId: string },
            {},
            {},
            {
                userId?: string;
                startDate?: string;
                endDate?: string;
                subjectName?: string;
            } & ParsedQs
        >,
        res: Response,
        next: NextFunction,
    ): Promise<void> {
        try {
            const requestingUser = req.user as AuthenticatedUser; // Assert type
            if (!requestingUser?.id) {
                // Optional: Add runtime check for safety
                return next(new Error('Authentication error: User ID not found on request.'));
            }
            const requestingUserId = requestingUser.id;

            const streamId = req.params.streamId;
            const { userId: targetUserIdParam, startDate, endDate, subjectName } = req.query;

            if (!subjectName || typeof subjectName !== 'string') {
                res.status(400).json({
                    status: 'fail',
                    message: 'Missing subjectName query parameter',
                });
                return;
            }

            const targetUserId =
                typeof targetUserIdParam === 'string' && targetUserIdParam
                    ? targetUserIdParam
                    : requestingUserId;

            // Fetch overall stats and filter for the subject
            const stats = await analyticsService.getStreamAttendanceStats(
                streamId,
                targetUserId,
                requestingUserId,
                startDate,
                endDate,
            );

            const subjectStat = stats.subjectStats.find((s) => s.subjectName === subjectName);

            if (!subjectStat) {
                res.status(404).json({
                    status: 'fail',
                    message: `Stats not found for subject '${subjectName}'`,
                });
                return;
            }

            res.status(200).json({ status: 'success', data: { stats: subjectStat } });
        } catch (error) {
            next(error);
        }
    },

    async handleCalculateProjection(
        req: Request<{}, {}, AttendanceCalculatorInput>,
        res: Response,
        next: NextFunction,
    ) {
        try {
            const requestingUser = req.user as AuthenticatedUser; // Assert type
            if (!requestingUser?.id) {
                // Optional: Add runtime check for safety
                return next(new Error('Authentication error: User ID not found on request.'));
            }
            const userId = requestingUser.id;
            const projection = await analyticsService.calculateAttendanceProjection(
                req.body,
                userId,
            );
            res.status(200).json({ status: 'success', data: { projection } });
        } catch (error) {
            next(error);
        }
    },
};
