import { Router } from 'express';
import { userController } from '../domains/user/user.controller';
import { streamController } from '../domains/stream/stream.controller'; // Assuming these exist
import { timetableController } from '../domains/timetable/timetable.controller'; // Assuming these exist
import { attendanceController } from '../domains/attendance/attendance.controller'; // Assuming these exist
import { analyticsController } from '../domains/analytics/analytics.controller'; // Assuming these exist
import { validateRequest } from '../middleware/validation.middleware';
import { CreateUserSchema, LoginUserSchema } from '../domains/user/user.dto';
// Import other DTO schemas for validation...
import { protect } from '../middleware/auth.middleware';
import { z } from 'zod'; // Import Zod for schema validation

// Import Zod Schemas for Validation
import { CreateStreamSchema, JoinStreamSchema } from '../domains/stream/stream.dto';
import {
  TimetableBodySchema,
  TimetableStreamParamsSchema,
  TimetableIdParamsSchema, TimetableActiveQuerySchema, GetActiveTimetableSchema
} from '../domains/timetable/timetable.dto'; // Add GetActiveTimetableSchema if using validation middleware for it
import { MarkAttendanceSchema, BulkAttendanceSchema, GetCalendarDataSchema, GetAttendanceRecordsSchema } from '../domains/attendance/attendance.dto';
import { AttendanceCalculatorSchema, GetAnalyticsSchema } from '../domains/analytics/analytics.dto'; // Add GetAnalyticsSchema if using validation middleware

const router = Router();

// --- Public Routes ---
router.get('/health', (req, res): void => {
  res.status(200).json({ status: 'ok' })
}); // Health check


// --- Auth Routes ---
router.post('/auth/signup', validateRequest(CreateUserSchema), userController.signup);
router.post('/auth/login', validateRequest(LoginUserSchema), userController.login);

// --- Protected Routes (Require Authentication) ---
router.use(protect); // Apply auth middleware to all subsequent routes

// --- User Routes ---
router.get('/users/me', userController.getMe);

// --- Stream Routes ---
router.post('/streams', validateRequest(CreateStreamSchema), streamController.handleCreateStream);
router.get('/streams', streamController.handleGetMyStreams); // Get streams the user is a member of
router.post('/streams/join', validateRequest(JoinStreamSchema), streamController.handleJoinStream);
router.get('/streams/:streamId', streamController.handleGetStreamDetails); // Get details of a specific stream (checks membership)
// TODO: Add routes for updating stream, managing members (admin only)

// --- Timetable Routes (Nested under Streams) ---

// Create Timetable
router.post(
  '/streams/:streamId/timetables',
  // Validate params and body separately using a combined schema for validateRequest
  validateRequest(z.object({
    params: TimetableStreamParamsSchema, // Validate streamId in params
    body: TimetableBodySchema          // Validate nested body
  })),
  timetableController.handleCreateTimetable
);

// Get List (only needs params validation if you add it)
router.get('/streams/:streamId/timetables', /* Optional: validateRequest(z.object({ params: TimetableStreamParamsSchema })) ,*/ timetableController.handleGetTimetables);

router.get(
  '/streams/:streamId/timetables/active',
  validateRequest(z.object({ // Combine validation for params and query
      params: TimetableStreamParamsSchema,
      query: TimetableActiveQuerySchema
  })),
  timetableController.handleGetActiveTimetable // Ensure this controller exists and works
);

// Get Details
router.get(
  '/timetables/:timetableId',
  validateRequest(z.object({ params: TimetableIdParamsSchema })), // Validate timetableId in params
  timetableController.handleGetTimetableDetails
);

// Update Timetable
router.put(
  '/timetables/:timetableId',
  validateRequest(z.object({
      params: TimetableIdParamsSchema, // Validate timetableId in params
      body: TimetableBodySchema       // Validate nested body
  })),
  timetableController.handleUpdateTimetable
);

// Delete Timetable
router.delete(
  '/timetables/:timetableId',
  validateRequest(z.object({ params: TimetableIdParamsSchema })), // Validate timetableId in params
  timetableController.handleDeleteTimetable
);

// --- Attendance Routes ---
router.post('/attendance/mark', validateRequest(MarkAttendanceSchema), attendanceController.handleMarkAttendance); // Mark own attendance
router.post('/attendance/bulk', validateRequest(BulkAttendanceSchema), attendanceController.handleRecordBulkAttendance); // Record own bulk attendance
// Use validation middleware for query params
router.get('/attendance/calendar', validateRequest(GetCalendarDataSchema), attendanceController.handleGetCalendar); // Get own calendar view
router.get('/attendance/records', validateRequest(GetAttendanceRecordsSchema), attendanceController.handleGetAttendanceRecords); // Get attendance records (defaults to self, admins might query others)

// --- Analytics Routes ---
// Use validation middleware for query params/body
router.get('/analytics/streams/:streamId', validateRequest(GetAnalyticsSchema), analyticsController.handleGetStreamAnalytics); // Get stats (defaults to self)
router.get('/analytics/streams/:streamId/subjects', validateRequest(GetAnalyticsSchema), analyticsController.handleGetSubjectAnalytics); // Get subject stats (defaults to self)
router.post('/analytics/calculator', validateRequest(AttendanceCalculatorSchema), analyticsController.handleCalculateProjection); // Calculate projection for self


// --- Catch-all for undefined API routes ---
// Placed after all defined API routes within the /api/v1 prefix
// Note: The global catch-all in server.ts handles non-API routes
// router.all('*', (req, res, next) => {
//   next(new NotFoundError(`API route not found: ${req.method} ${req.originalUrl}`));
// });

export default router;