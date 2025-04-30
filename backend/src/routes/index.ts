import { Router } from 'express';
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
router.get('/health', (req, res): void => {
  res.status(200).json({ status: 'ok' });
}); // Health check

// --- Auth Routes ---
router.post('/auth/signup', validateRequest(CreateUserSchema), userController.signup);
router.post('/auth/login', validateRequest(LoginUserSchema), userController.login);

// --- Google OAuth Routes ---

// Route to initiate Google authentication
// GET /api/v1/auth/google
router.get('/auth/google',
  passport.authenticate('google', {
      scope: ['profile', 'email'], // Request profile and email scope
      // session: false // Optional: If you *only* use JWT and don't need Passport session after OAuth
  })
);

// Route Google redirects to after user authenticates with Google
// GET /api/v1/auth/google/callback
router.get('/auth/google/callback',
  passport.authenticate('google', {
      // session: false, // Match session setting above
      failureRedirect: `${config.frontendUrl}/login?error=google-auth-failed`, // Redirect on failure
      // failureMessage: true // Optional: include failure messages
  }),
  (req, res) => {
      // --- Successful authentication ---
      // 'req.user' is populated by Passport's verify callback via serializeUser/deserializeUser
      // or directly from the verify callback if session: false is used consistently.
      console.log('[Auth Callback] Google Auth Successful. User:', req.user);

      if (!req.user) {
          // Should not happen if passport.authenticate succeeded without error/redirect
          console.error('[Auth Callback] req.user not found after successful Google auth!');
          return res.redirect(`${config.frontendUrl}/login?error=auth-failed`);
      }

      // --- Generate YOUR application's JWT ---
      const user = req.user as User; // Cast req.user to your User type
      const payload = { id: user.id };
      const token = jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresInSeconds }); // Use seconds

      // --- Redirect user back to frontend with token ---
      // Option 1: Query Parameter (Simpler, less secure - token visible in URL/history)
      // res.redirect(`${config.frontendUrl}/auth/callback?token=${token}`);

      // Option 2: Cookie (More secure - HttpOnly)
      // Requires cookie-parser middleware: npm install cookie-parser @types/cookie-parser
      // app.use(cookieParser()); // Add in server.ts
      res.cookie('authToken', token, {
           httpOnly: true, // Cannot be accessed by client-side JS
           secure: config.nodeEnv === 'production', // Only send over HTTPS in production
           maxAge: 1000 * 60 * 60 * 24 * 7, // Example: 7 days (match JWT expiry?)
           // sameSite: 'lax' // Or 'strict' or 'none' (if needed for cross-site)
      });
      res.redirect(`${config.frontendUrl}/dashboard`); // Redirect to dashboard after setting cookie

      // Option 3: Post message (for SPAs if popup window used - more complex)
  }
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
  // Use POST or maybe PATCH/PUT? POST is simple.
  '/attendance/cancel',
  // Add validation schema for cancel input DTO
  // validateRequest(CancelClassSchema),
  attendanceController.handleCancelClassGlobally, // Add this controller method
);
// NEW: Get Weekly Attendance View (Student)
router.get(
  '/attendance/weekly/:streamId', // Example route
  validateRequest(
    z.object({
      params: TimetableStreamParamsSchema, // Reuse streamId param schema
      query: z.object({
        // Validate query params
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    }),
  ),
  attendanceController.handleGetWeeklyAttendanceView, // Add this controller method
);

router.get(
  '/attendance/records',
  validateRequest(GetAttendanceRecordsSchema),
  attendanceController.handleGetAttendanceRecords,
); // Get attendance records (defaults to self, admins might query others)

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
