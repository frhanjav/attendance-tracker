import { Router, Request, Response, NextFunction } from 'express'; // Import NextFunction
import passport from '../config/passport'; // Import configured passport
import jwt from 'jsonwebtoken'; // To generate JWT after successful OAuth
import { config } from '../config'; // For JWT secret/expiry
import { User } from '@prisma/client'; // Import User type
import { userController } from '../domains/user/user.controller';
import { streamController } from '../domains/stream/stream.controller'; // Assuming these exist
import { timetableController } from '../domains/timetable/timetable.controller'; // Assuming these exist
import { attendanceController } from '../domains/attendance/attendance.controller'; // Assuming these exist
import { analyticsController } from '../domains/analytics/analytics.controller'; // Assuming these exist
import { validateRequest } from '../middleware/validation.middleware';
import { protect } from '../middleware/auth.middleware';
import { z } from 'zod'; // Import Zod for schema validation

// Import DTOs/Schemas for validation
import { CreateStreamSchema, JoinStreamSchema } from '../domains/stream/stream.dto';
import {
    TimetableBodySchema,
    TimetableStreamParamsSchema,
    TimetableIdParamsSchema,
    TimetableActiveQuerySchema,
    GetActiveTimetableSchema,
} from '../domains/timetable/timetable.dto';
import {
    MarkAttendanceSchema,
    BulkAttendanceSchema,
    CancelClassSchema,
    ReplaceClassSchema,
} from '../domains/attendance/attendance.dto';
import { AttendanceCalculatorInputSchema } from '../domains/analytics/analytics.dto'; // Add GetAnalyticsSchema if using validation middleware

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
        failureRedirect: `${config.frontendUrl}/landing?error=google-auth-failed`, // Use landing page
        session: false,
    })(req, res, (err?: any) => {
        // Handle potential passport errors explicitly
        console.log(
            '[Auth Callback] passport.authenticate finished. Error:',
            err,
            'User:',
            req.user,
        );
        if (err) {
            return next(err);
        } // Pass passport errors to global handler
        if (!req.user) {
            console.error('[Auth Callback] req.user missing after successful Google auth!');
            return res.redirect(`${config.frontendUrl}/landing?error=auth-callback-user-missing`);
        }
        // --- Custom Callback Logic ---
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

// --- NEW: Logout Route ---
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
// --- End Logout Route ---

// --- Protected Routes (Require Authentication) ---
router.use(protect); // Apply auth middleware to all subsequent routes

// --- User Routes ---
router.get('/users/me', userController.getMe);

// --- Stream Routes ---
router.post('/streams', validateRequest(CreateStreamSchema), streamController.handleCreateStream);
router.get('/streams', streamController.handleGetMyStreams); // Get streams the user is a member of
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
    // Create
    '/streams/:streamId/timetables',
    validateRequest(z.object({ params: TimetableStreamParamsSchema, body: TimetableBodySchema })),
    timetableController.handleCreateTimetable,
);

// Get List (only needs params validation if you add it)
router.get(
    // Get List for a Stream (used on TimetablePage)
    '/streams/:streamId/timetables',
    validateRequest(z.object({ params: TimetableStreamParamsSchema })), // Validate param
    timetableController.handleGetTimetables,
);

// NEW: Get List for Import Dropdown
router.get(
    '/timetables/list/:streamId', // New route distinct from the main list maybe?
    validateRequest(z.object({ params: TimetableStreamParamsSchema })),
    timetableController.handleGetTimetableListForImport,
);
// NEW: Get Weekly Schedule View
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
            // Combine validation for params and query
            params: TimetableStreamParamsSchema,
            query: TimetableActiveQuerySchema,
        }),
    ),
    timetableController.handleGetActiveTimetable, // Ensure this controller exists and works
);

// Get Details
router.get(
    '/timetables/:timetableId',
    validateRequest(z.object({ params: TimetableIdParamsSchema })), // Validate timetableId in params
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
// NEW: Cancel Class (Admin)
router.post(
    '/attendance/cancel',
    validateRequest(CancelClassSchema),
    attendanceController.handleCancelClassGlobally,
); // Added validation

// NEW: Replace Class Route (Admin)
router.post('/attendance/replace', validateRequest(ReplaceClassSchema), attendanceController.handleReplaceClassGlobally);

// NEW: Get Weekly Attendance View (Student)
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

// router.get(
//     '/attendance/records',
//     validateRequest(GetAttendanceRecordsSchema),
//     attendanceController.handleGetAttendanceRecords,
// ); // Get attendance records (defaults to self, admins might query others)

// --- Analytics Routes ---
router.get(
    // Get Stream Stats
    '/analytics/streams/:streamId',
    validateRequest(z.object({ params: TimetableStreamParamsSchema })), // Validate param
    analyticsController.handleGetStreamAnalytics,
);

// router.get('/analytics/streams/:streamId/subjects', validateRequest(GetAnalyticsSchema), analyticsController.handleGetSubjectAnalytics); // Get subject stats (defaults to self)

router.post(
    // Calculator
    '/analytics/calculator',
    validateRequest(AttendanceCalculatorInputSchema),
    analyticsController.handleCalculateProjection,
);

// --- Catch-all for undefined API routes ---
// Placed after all defined API routes within the /api/v1 prefix
// Note: The global catch-all in server.ts handles non-API routes
// router.all('*', (req, res, next) => {
//   next(new NotFoundError(`API route not found: ${req.method} ${req.originalUrl}`));
// });

export default router;
