import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { analyticsService, StreamAnalyticsData, AttendanceProjection, AttendanceCalculatorInput } from '../services/analytics.service'; // Import service and types
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"; // Use shadcn Table
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import toast from 'react-hot-toast';
import { addDays, format, parseISO } from 'date-fns';
import { Check, Calendar, TrendingUp, Calculator, Info } from 'lucide-react'; // Icons

// --- Zod Schema for Calculator Form ---
const calculatorSchema = z.object({
    targetPercentage: z.coerce.number() // Coerce input string to number
        .min(0, "Target must be at least 0%")
        .max(100, "Target cannot exceed 100%"),
    targetDate: z.string().min(1, "Target date is required"), // Validate format if needed
    subjectName: z.string().optional(), // Optional subject filter
});
type CalculatorFormInputs = z.infer<typeof calculatorSchema>;
// --- End Schema ---


const AnalyticsPage: React.FC = () => {
    const { streamId } = useParams<{ streamId: string }>();
    const [projectionResult, setProjectionResult] = useState<AttendanceProjection | null>(null);

    // --- Fetch Analytics Data ---
    // Query key should be specific enough, e.g., include filters if used
    const { data: analyticsData, isLoading, error, status } = useQuery<StreamAnalyticsData, Error>({
        queryKey: ['streamAnalytics_v2', streamId], // Added _v2
        queryFn: () => analyticsService.getStreamAnalytics(streamId!),
        enabled: !!streamId,
        staleTime: 1000 * 60 * 5, // Cache for 5 mins
    });

    console.log(`[AnalyticsPage] Query Status: ${status}, IsLoading: ${isLoading}, Error: ${error}, Data:`, analyticsData);
    console.log(`[AnalyticsPage] streamId value: ${streamId}`); // <-- ADD THIS LOG


    // --- Calculator Form Setup ---
    const { register, handleSubmit, control, formState: { errors: calcErrors } } = useForm<CalculatorFormInputs>({
        resolver: zodResolver(calculatorSchema),
        defaultValues: {
            targetPercentage: 75,
            targetDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
            subjectName: "__OVERALL__", // <-- Use placeholder value as default
        },
        mode: 'onSubmit',
    });

    // Get unique subjects from fetched stats for the dropdown
    const availableSubjects = useMemo(() => {
        if (!analyticsData?.subjectStats) return [];
        // Get unique subject names
        return [...new Set(analyticsData.subjectStats.map(s => s.subjectName))].sort();
    }, [analyticsData]);

    // --- Calculator Mutation ---
    const calculateMutation = useMutation<AttendanceProjection, Error, AttendanceCalculatorInput>({
        mutationFn: analyticsService.calculateProjection,
        onSuccess: (data) => {
            setProjectionResult(data); // Store result in state
            toast.success("Projection calculated!");
        },
        onError: (error) => {
            setProjectionResult(null); // Clear previous result on error
            toast.error(`Calculation failed: ${error.message}`);
        },
    });

    // --- Calculator Submit Handler ---
    const onCalculateSubmit = (formData: CalculatorFormInputs) => {
        if (!streamId) return;
        setProjectionResult(null); // Clear previous result

        calculateMutation.mutate({
            streamId: streamId,
            targetPercentage: formData.targetPercentage,
            targetDate: formData.targetDate,
            // If subjectName is the placeholder, send undefined to the backend
            subjectName: formData.subjectName === "__OVERALL__" ? undefined : formData.subjectName,
        });
    };

    // --- Render Loading/Error States ---
    if (isLoading) return <div className="text-center p-10">Loading analytics...</div>;
    if (error) return <div className="text-center p-10 text-red-500">Error loading analytics: {error.message}</div>;
    if (!analyticsData) return <div className="text-center p-10">No analytics data found for this stream.</div>;

    // --- Main Render ---
    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-800">Attendance Analytics</h1>
            <p className="text-sm text-gray-500 -mt-6">
                Stats calculated from {format(parseISO(analyticsData.startDate), 'MMM dd, yyyy')} to {format(parseISO(analyticsData.endDate), 'MMM dd, yyyy')}
            </p>

            {/* Overall Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">Overall Attendance</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-600">
                            {analyticsData.overallAttendancePercentage !== null ? `${analyticsData.overallAttendancePercentage.toFixed(1)}%` : 'N/A'}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            ({analyticsData.totalAttendedClasses} / {analyticsData.totalOccurredClasses} classes attended)
                        </p>
                    </CardContent>
                </Card>
                 <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">Total Attended</CardTitle>
                        <Check className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">
                            {analyticsData.totalAttendedClasses}
                        </div>
                         <p className="text-xs text-muted-foreground">Classes marked as 'Occurred'</p>
                    </CardContent>
                </Card>
                 <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">Total Held</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">
                             {analyticsData.totalOccurredClasses}
                        </div>
                         <p className="text-xs text-muted-foreground">Classes marked as 'Occurred'</p>
                    </CardContent>
                </Card>
                {/* Add more cards if needed (e.g., total scheduled) */}
            </div>

            {/* Subject Stats Table */}
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>Subject Statistics</CardTitle>
                    <CardDescription>Detailed attendance breakdown by subject.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Subject</TableHead>
                                <TableHead className="text-center">Attended</TableHead>
                                <TableHead className="text-center">Held (Occurred)</TableHead>
                                <TableHead className="text-center">Scheduled</TableHead>
                                <TableHead className="text-right">Percentage</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {analyticsData.subjectStats.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-gray-500">
                                        No subject data available.
                                    </TableCell>
                                </TableRow>
                            )}
                            {analyticsData.subjectStats.map((subject) => (
                                <TableRow key={subject.subjectName}>
                                    <TableCell className="font-medium">
                                        {subject.subjectName}
                                        {subject.courseCode && <span className="block text-xs text-muted-foreground">{subject.courseCode}</span>}
                                    </TableCell>
                                    <TableCell className="text-center">{subject.attended}</TableCell>
                                    <TableCell className="text-center">{subject.totalOccurred}</TableCell>
                                    <TableCell className="text-center">{subject.totalScheduled}</TableCell>
                                    <TableCell className="text-right font-medium">
                                        {subject.attendancePercentage !== null ? `${subject.attendancePercentage.toFixed(1)}%` : 'N/A'}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Attendance Calculator */}
            <Card className="shadow-sm">
                 <CardHeader>
                    <CardTitle>Attendance Calculator</CardTitle>
                    <CardDescription>Calculate how many classes you need to attend/can skip to reach a target percentage by a specific date.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onCalculateSubmit)} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <Label htmlFor="targetPercentage">Target Percentage (%) <span className="text-red-500">*</span></Label>
                                <Input
                                    id="targetPercentage"
                                    type="number"
                                    min="0" max="100" step="0.1"
                                    {...register('targetPercentage')}
                                    className={calcErrors.targetPercentage ? 'border-red-500' : ''}
                                />
                                {calcErrors.targetPercentage && <p className="text-red-500 text-xs mt-1">{calcErrors.targetPercentage.message}</p>}
                            </div>
                            <div>
                                <Label htmlFor="targetDate">Target Date <span className="text-red-500">*</span></Label>
                                <Input
                                    id="targetDate"
                                    type="date"
                                    {...register('targetDate')}
                                    className={calcErrors.targetDate ? 'border-red-500' : ''}
                                    min={format(new Date(), 'yyyy-MM-dd')} // Prevent selecting past dates
                                />
                                 {calcErrors.targetDate && <p className="text-red-500 text-xs mt-1">{calcErrors.targetDate.message}</p>}
                            </div>
                            <div>
                                <Label htmlFor="subjectName">Subject (Optional)</Label>
                                <Controller
                                    control={control}
                                    name="subjectName"
                                    defaultValue="__OVERALL__" // Set default value for Controller
                                    render={({ field }) => (
                                        // Use field.value in defaultValue for Select if needed,
                                        // but Select's own defaultValue might suffice
                                        <Select
                                            onValueChange={(value) => field.onChange(value === "__OVERALL__" ? "" : value)} // Store empty string or subject name
                                            defaultValue={field.value || "__OVERALL__"} // Use placeholder value
                                        >
                                            <SelectTrigger id="subjectName">
                                                <SelectValue placeholder="Overall Attendance" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {/* Use the non-empty placeholder value */}
                                                <SelectItem value="__OVERALL__">Overall Attendance</SelectItem>
                                                {availableSubjects.map(subject => (
                                                    <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <Button type="submit" disabled={calculateMutation.isPending}>
                                {calculateMutation.isPending ? 'Calculating...' : 'Calculate Projection'}
                                <Calculator size={16} className="ml-2"/>
                            </Button>
                        </div>
                    </form>

                    {/* Calculator Result */}
                    {calculateMutation.isSuccess && projectionResult && (
                         <div className="mt-6 p-4 bg-blue-50 rounded border border-blue-200 text-blue-800 space-y-2">
                             <h4 className="font-semibold text-lg flex items-center"><Info size={18} className="mr-2"/>Projection Result:</h4>
                             <p className="text-sm">{projectionResult.message}</p>
                             <div className="text-xs grid grid-cols-2 gap-x-4 gap-y-1 pt-2">
                                 <span>Current Attended: {projectionResult.currentAttended}</span>
                                 <span>Future Scheduled: {projectionResult.futureScheduled}</span>
                                 <span>Current Held: {projectionResult.currentOccurred}</span>
                                 <span>Classes Needed: {projectionResult.neededToAttend}</span>
                                 <span>Current %: {projectionResult.currentPercentage?.toFixed(1) ?? 'N/A'}%</span>
                                 <span>Classes Can Skip: {projectionResult.canSkip}</span>
                             </div>
                         </div>
                    )}
                     {calculateMutation.isError && (
                         <div className="mt-6 p-4 bg-red-50 rounded border border-red-200 text-red-800">
                             <h4 className="font-semibold">Calculation Error</h4>
                             <p className="text-sm">{calculateMutation.error?.message || 'An unknown error occurred.'}</p>
                         </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default AnalyticsPage;