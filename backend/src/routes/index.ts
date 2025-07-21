import { Router, Request, Response, NextFunction } from 'express';
import passport from '../config/passport';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { User } from '@prisma/client';
import { userController } from '../domains/user/user.controller';
import { streamController } from '../domains/stream/stream.controller';
import { timetableController } from '../domains/timetable/timetable.controller';
import { attendanceController } from '../domains/attendance/attendance.controller';
import { analyticsController } from '../domains/analytics/analytics.controller';
import { validateRequest } from '../middleware/validation.middleware';
import { protect } from '../middleware/auth.middleware';
import { z } from 'zod';
import { SetEndDateSchema } from '../domains/timetable/timetable.dto';
import { CreateStreamSchema, JoinStreamSchema } from '../domains/stream/stream.dto';
import {
    TimetableBodySchema,
    TimetableStreamParamsSchema,
    TimetableIdParamsSchema,
    TimetableActiveQuerySchema,
} from '../domains/timetable/timetable.dto';
import {
    MarkAttendanceSchema,
    BulkAttendanceSchema,
    CancelClassSchema,
    ReplaceClassSchema,
} from '../domains/attendance/attendance.dto';
import { AttendanceCalculatorInputSchema } from '../domains/analytics/analytics.dto';

const router = Router();

// --- Public Routes ---
router.get('/health', (req: Request, res: Response): void => {
    console.log('Backend: Handling GET /health');
    res.status(200).json({ status: 'ok' });
});

// --- Google OAuth Routes ---
// Route to initiate Google authentication
router.get('/auth/google', (req, res, next) => {
    // Add logging
    console.log('Backend: Handling GET /auth/google');
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get('/auth/google/callback', (req, res, next) => {
    // Add logging
    console.log('Backend: Handling GET /auth/google/callback - invoking passport.authenticate');
    passport.authenticate('google', {
        failureRedirect: `${config.frontendUrl}/landing?error=google-auth-failed`,
        session: false,
    })(req, res, (err?: any) => {
        console.log(
            '[Auth Callback] passport.authenticate finished. Error:',
            err,
            'User:',
            req.user,
        );
        if (err) {
            return next(err);
        }
        if (!req.user) {
            console.error('[Auth Callback] req.user missing after successful Google auth!');
            return res.redirect(`${config.frontendUrl}/landing?error=auth-callback-user-missing`);
        }
        try {
            const user = req.user as User;
            const payload = { id: user.id };
            const token = jwt.sign(payload, config.jwtSecret, {
                expiresIn: config.jwtExpiresInSeconds,
            });
            console.log('[Auth Callback] Setting authToken cookie...');
            res.cookie('authToken', token, {
                httpOnly: true,
                secure: config.nodeEnv === 'production',
                maxAge: config.jwtExpiresInSeconds * 1000,
                sameSite: config.nodeEnv === 'production' ? 'lax' : undefined,
                path: '/',
            });
            console.log('[Auth Callback] Redirecting to frontend dashboard...');
            res.redirect(`${config.frontendUrl}/dashboard`);
        } catch (error) {
            console.error('[Auth Callback] Error generating JWT or setting cookie:', error);
            next(error); // Pass error to global handler
        }
    });
});

// --- Logout Route ---
router.post('/auth/logout', (req: Request, res: Response, next: NextFunction) => {
    console.log('[Auth Logout] Received logout request');
    try {
        // Clear the HttpOnly cookie by setting it with an expired date
        res.cookie('authToken', '', {
            // Set value to empty string
            httpOnly: true,
            expires: new Date(0), // Set expiry date to the past
            secure: config.nodeEnv === 'production',
            sameSite: config.nodeEnv === 'production' ? 'lax' : undefined,
            path: '/',
        });
        res.status(200).json({ status: 'success', message: 'Logged out successfully' });
    } catch (error) {
        // Pass any unexpected errors to the global handler
        next(error);
    }
});

// --- Protected Routes (Require Authentication) ---
router.use(protect); // Apply auth middleware to all subsequent routes

// --- User Routes ---
router.get('/users/me', userController.getMe);

// --- Stream Routes ---
router.post('/streams', validateRequest(CreateStreamSchema), streamController.handleCreateStream);
router.get('/streams', streamController.handleGetMyStreams);
router.post('/streams/join', validateRequest(JoinStreamSchema), streamController.handleJoinStream);
router.get(
    '/streams/:streamId',
    validateRequest(z.object({ params: TimetableStreamParamsSchema })),
    streamController.handleGetStreamDetails,
);
router.post('/streams/:streamId/leave', validateRequest(z.object({ params: TimetableStreamParamsSchema })), streamController.handleLeaveStream);
router.post('/streams/:streamId/archive', validateRequest(z.object({ params: TimetableStreamParamsSchema })), streamController.handleArchiveStream);
router.post('/streams/:streamId/unarchive', validateRequest(z.object({ params: TimetableStreamParamsSchema })), streamController.handleUnarchiveStream);

// --- Timetable Routes ---

// Create Timetable
router.post(
    '/streams/:streamId/timetables',
    validateRequest(z.object({ params: TimetableStreamParamsSchema, body: TimetableBodySchema })),
    timetableController.handleCreateTimetable,
);

// Get List
router.get(
    '/streams/:streamId/timetables',
    validateRequest(z.object({ params: TimetableStreamParamsSchema })),
    timetableController.handleGetTimetables,
);

// Get List for Import Dropdown
router.get(
    '/timetables/list/:streamId',
    validateRequest(z.object({ params: TimetableStreamParamsSchema })),
    timetableController.handleGetTimetableListForImport,
);
// Get Weekly Schedule View
router.get(
    '/timetables/weekly/:streamId',
    validateRequest(
        z.object({
            params: TimetableStreamParamsSchema,
            query: z.object({
                startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
                endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            }),
        }),
    ),
    timetableController.handleGetWeeklySchedule,
);

router.get(
    '/streams/:streamId/timetables/active',
    validateRequest(
        z.object({
            params: TimetableStreamParamsSchema,
            query: TimetableActiveQuerySchema,
        }),
    ),
    timetableController.handleGetActiveTimetable,
);

// Get Details
router.get(
    '/timetables/:timetableId',
    validateRequest(z.object({ params: TimetableIdParamsSchema })),
    timetableController.handleGetTimetableDetails,
);

// --- Attendance Routes ---
router.post(
    // Mark Status (Student)
    '/attendance/mark',
    validateRequest(MarkAttendanceSchema),
    attendanceController.handleMarkAttendance,
);
router.post(
    // Bulk Entry (Student)
    '/attendance/bulk',
    validateRequest(BulkAttendanceSchema),
    attendanceController.handleRecordBulkAttendance,
);
// Cancel Class (Admin)
router.post(
    '/attendance/cancel',
    validateRequest(CancelClassSchema),
    attendanceController.handleCancelClassGlobally,
); // Added validation

// Replace Class Route (Admin)
router.post('/attendance/replace', validateRequest(ReplaceClassSchema), attendanceController.handleReplaceClassGlobally);

// Get Weekly Attendance View (Student)
router.get(
    '/attendance/weekly/:streamId',
    validateRequest(
        z.object({
            params: TimetableStreamParamsSchema,
            query: z.object({
                startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
                endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            }),
        }),
    ),
    attendanceController.handleGetWeeklyAttendanceView,
);

// --- Analytics Routes ---
router.get(
    // Get Stream Stats
    '/analytics/streams/:streamId',
    validateRequest(z.object({ params: TimetableStreamParamsSchema })),
    analyticsController.handleGetStreamAnalytics,
);

router.post(
    // Calculator
    '/analytics/calculator',
    validateRequest(AttendanceCalculatorInputSchema),
    analyticsController.handleCalculateProjection,
);

router.patch(
    '/timetables/:timetableId/set-end-date',
    validateRequest(z.object({ params: TimetableIdParamsSchema, body: SetEndDateSchema.shape.body })),
    timetableController.handleSetTimetableEndDate
);

export default router;
