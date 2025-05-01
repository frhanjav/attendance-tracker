import { Router, Request, Response } from 'express'; // Import Request, Response
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
import { CreateUserSchema, LoginUserSchema } from '../domains/user/user.dto';
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
    GetAttendanceRecordsSchema,
} from '../domains/attendance/attendance.dto';
import { AttendanceCalculatorInputSchema } from '../domains/analytics/analytics.dto'; // Add GetAnalyticsSchema if using validation middleware

const router = Router();

// --- Public Routes ---
router.get('/health', (req: Request, res: Response): void => {
    res.status(200).json({ status: 'ok' });
});

// --- Auth Routes ---
// router.post('/auth/signup', validateRequest(CreateUserSchema), userController.signup);
// router.post('/auth/login', validateRequest(LoginUserSchema), userController.login);

// --- Google OAuth Routes ---

// Route to initiate Google authentication
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
    '/auth/google/callback',
    passport.authenticate('google', {
        failureRedirect: `${config.frontendUrl}/login?error=google-auth-failed`, // Redirect on failure
        session: false, // We are handling the session via JWT cookie manually
    }),
    // --- Custom Callback after successful Google Auth ---
    (req: Request, res: Response) => {
        console.log('[Auth Callback] Google Auth Successful. User from passport:', req.user);
        if (!req.user) {
            console.error('[Auth Callback] req.user missing after successful Google auth!');
            return res.redirect(`${config.frontendUrl}/login?error=auth-callback-failed`);
        }

        try {
            const user = req.user as User; // Cast to Prisma User type
            // --- Generate JWT ---
            const payload = { id: user.id };
            // Use expiry from config (ensure it's seconds)
            const token = jwt.sign(payload, config.jwtSecret, {
                expiresIn: config.jwtExpiresInSeconds,
            });

            // --- Set HttpOnly Cookie ---
            console.log('[Auth Callback] Setting authToken cookie and redirecting');
            res.cookie('authToken', token, {
                httpOnly: true,
                secure: config.nodeEnv === 'production',
                maxAge: config.jwtExpiresInSeconds * 1000, // maxAge is in milliseconds
                sameSite: config.nodeEnv === 'production' ? 'lax' : undefined, // Lax is usually a good default
                path: '/', // Cookie accessible for all paths
            });

            // --- Redirect to Frontend Dashboard ---
            console.log('[Auth Callback] Redirecting to frontend dashboard...');
            res.redirect(`${config.frontendUrl}/dashboard`);
        } catch (error) {
            console.error('[Auth Callback] Error generating JWT or setting cookie:', error);
            res.redirect(`${config.frontendUrl}/login?error=auth-processing-failed`);
        }
    },
);

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
); // Added param validation

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
    timetableController.handleGetTimetableListForImport, // Add this controller method
);
// NEW: Get Weekly Schedule View
router.get(
    '/timetables/weekly/:streamId', // Example route
    validateRequest(
        z.object({
            params: TimetableStreamParamsSchema,
            // Add query param validation for startDate, endDate
            query: z.object({
                startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
                endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            }),
        }),
    ),
    timetableController.handleGetWeeklySchedule, // Add this controller method
);

// router.get(
//     '/streams/:streamId/timetables/active',
//     validateRequest(
//         z.object({
//             // Combine validation for params and query
//             params: TimetableStreamParamsSchema,
//             query: TimetableActiveQuerySchema,
//         }),
//     ),
//     timetableController.handleGetActiveTimetable, // Ensure this controller exists and works
// );

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
