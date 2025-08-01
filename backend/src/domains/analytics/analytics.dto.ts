import { z } from 'zod';

// Output for subject-wise attendance statistics
export const SubjectStatsOutputSchema = z.object({
    subjectName: z.string(),
    courseCode: z.string().nullable(),
    totalScheduled: z.number().int().min(0),
    totalMarked: z.number().int().min(0),
    totalHeldClasses: z.number().int().min(0),
    attended: z.number().int().min(0),
    attendancePercentage: z.number().min(0).max(100).nullable(),
});
export type SubjectStatsOutput = z.infer<typeof SubjectStatsOutputSchema>;

// Output for overall stream attendance statistics
export const StreamAnalyticsOutputSchema = z.object({
    streamId: z.string().cuid(),
    userId: z.string().cuid(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    overallAttendancePercentage: z.number().min(0).max(100).nullable(),
    totalAttendedClasses: z.number().int().min(0),
    totalHeldClasses: z.number().int().min(0),
    subjectStats: z.array(SubjectStatsOutputSchema),
});
export type StreamAnalyticsOutput = z.infer<typeof StreamAnalyticsOutputSchema>;

// Input for the attendance calculator
export const AttendanceCalculatorInputSchema = z.object({
    body: z.object({
        streamId: z.string().cuid(),
        targetPercentage: z.number().min(0).max(100),
        targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid target date format (YYYY-MM-DD)" }),
        subjectName: z.string().optional(),
        currentAttendedInput: z.number().int().min(0).optional(),
        currentHeldInput: z.number().int().min(0).optional(),
    }),
});
export type AttendanceCalculatorInput = z.infer<typeof AttendanceCalculatorInputSchema>['body'];

// Output for the attendance calculator
export const AttendanceProjectionOutputSchema = z.object({
    currentAttended: z.number().int(),
    currentHeld: z.number().int(),
    currentPercentage: z.number().nullable(),
    futureHeld: z.number().int(),
    targetPercentage: z.number(),
    neededToAttend: z.number().int(),
    canSkip: z.number().int(),
    message: z.string(),
});
export type AttendanceProjectionOutput = z.infer<typeof AttendanceProjectionOutputSchema>;