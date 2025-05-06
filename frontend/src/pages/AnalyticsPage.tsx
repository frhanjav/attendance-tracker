import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
// Import service and types - ensure types match backend DTOs (e.g., totalHeldClasses)
import {
    analyticsService,
    StreamAnalyticsData,
    AttendanceProjection,
    AttendanceCalculatorInput,
    SubjectStats,
} from '../services/analytics.service';
import { Button } from '../components/ui/button'; // Use alias
import { Input } from '../components/ui/input'; // Use alias
import { Label } from '../components/ui/label'; // Use alias
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'; // Use alias
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../components/ui/table'; // Use alias
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../components/ui/select'; // Use alias
import { Switch } from '../components/ui/switch'; // Import Switch component
import toast from 'react-hot-toast';
import { addDays, format, parseISO } from 'date-fns';
import { Check, Calendar, TrendingUp, Calculator, Info, Loader2, Edit } from 'lucide-react';
import { ApiError } from '../lib/apiClient'; // Import ApiError if used in onError

// --- Zod Schema for Calculator Form ---
const calculatorSchema = z.object({
    targetPercentage: z.coerce.number().min(0).max(100),
    targetDate: z.string().min(1, 'Target date is required'),
    subjectName: z.string().optional(),
});
type CalculatorFormInputs = z.infer<typeof calculatorSchema>;

type ManualAttendanceInput = Record<string, string>; // { [subjectName]: attendedCountString }

const AnalyticsPage: React.FC = () => {
    const { streamId } = useParams<{ streamId: string }>();
    const [projectionResult, setProjectionResult] = useState<AttendanceProjection | null>(null);
    const [isManualMode, setIsManualMode] = useState(false);
    const [manualAttendance, setManualAttendance] = useState<ManualAttendanceInput>({});

    // --- Fetch Analytics Data ---
    // Ensure StreamAnalyticsData type includes totalHeldClasses
    const { data: analyticsData, isLoading, error, status } = useQuery<StreamAnalyticsData, Error>({
        queryKey: ['streamAnalytics', streamId],
        queryFn: () => analyticsService.getStreamAnalytics(streamId!),
        enabled: !!streamId,
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false,
    });

    console.log(`[AnalyticsPage] Query Status: ${status}, IsLoading: ${isLoading}, Error: ${error?.message}`);

    // --- Effect to initialize manual inputs ---
    useEffect(() => {
        if (analyticsData?.subjectStats) {
            const initialManualValues: ManualAttendanceInput = {};
            analyticsData.subjectStats.forEach(stat => {
                initialManualValues[stat.subjectName] = String(stat.attended ?? '');
            });
            setManualAttendance(initialManualValues);
        }
        setProjectionResult(null);
    }, [analyticsData, isManualMode]);

    // --- Recalculate Stats Based on Mode ---
    const displayStats = useMemo((): StreamAnalyticsData | null => {
        if (!analyticsData) return null;
        if (!isManualMode) return analyticsData;

        let overallAttendedManual = 0;
        let overallHeldManual = analyticsData.totalHeldClasses; // Held count doesn't change with manual input

        const manualSubjectStats: SubjectStats[] = analyticsData.subjectStats.map(stat => {
            const manualAttendedStr = manualAttendance[stat.subjectName] ?? String(stat.attended);
            const manualAttendedNum = parseInt(manualAttendedStr, 10);
            const attended = (!isNaN(manualAttendedNum) && manualAttendedNum >= 0) ? manualAttendedNum : stat.attended;
            const cappedAttended = Math.min(attended, stat.totalHeldClasses); // Cap at held
            const held = stat.totalHeldClasses;

            const percentage = held > 0 ? parseFloat(((cappedAttended / held) * 100).toFixed(2)) : null;
            overallAttendedManual += cappedAttended;

            return { ...stat, attended: cappedAttended, attendancePercentage: percentage };
        });

        const overallPercentageManual = overallHeldManual > 0 ? parseFloat(((overallAttendedManual / overallHeldManual) * 100).toFixed(2)) : null;

        return { ...analyticsData, totalAttendedClasses: overallAttendedManual, overallAttendancePercentage: overallPercentageManual, subjectStats: manualSubjectStats };

    }, [analyticsData, isManualMode, manualAttendance]);

    // --- Calculator Form Setup ---
    const {
        register,
        handleSubmit,
        control,
        formState: { errors: calcErrors },
    } = useForm<CalculatorFormInputs>({
        resolver: zodResolver(calculatorSchema),
        defaultValues: {
            targetPercentage: 75,
            targetDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
            subjectName: '__OVERALL__', // Use placeholder value
        },
        mode: 'onSubmit',
    });

    // Get unique subjects from fetched stats
    const availableSubjects = useMemo(() => {
        if (!analyticsData?.subjectStats) return [];
        return [...new Set(analyticsData.subjectStats.map((s) => s.subjectName))].sort();
    }, [analyticsData]);

    // --- Calculator Mutation ---
    const calculateMutation = useMutation<AttendanceProjection, Error, AttendanceCalculatorInput>({
        mutationFn: analyticsService.calculateProjection,
        onSuccess: (data) => {
            setProjectionResult(data);
            toast.success('Projection calculated!');
        },
        onError: (error) => {
            setProjectionResult(null);
            toast.error(`Calculation failed: ${error.message}`);
        },
    });

    // --- Calculator Submit Handler ---
    const onCalculateSubmit = (formData: CalculatorFormInputs) => {
        if (!streamId || !displayStats) {
            // Need displayStats to get current values in manual mode
            toast.error('Cannot calculate projection: data not available.');
            return;
        }
        setProjectionResult(null);

        let currentAttendedInput: number | undefined = undefined;
        let currentHeldInput: number | undefined = undefined;

        // If in manual mode, get the current values from the recalculated displayStats
        if (isManualMode) {
            if (formData.subjectName && formData.subjectName !== '__OVERALL__') {
                const manualSubjectStat = displayStats.subjectStats.find(
                    (s) => s.subjectName === formData.subjectName,
                );
                currentAttendedInput = manualSubjectStat?.attended;
                currentHeldInput = manualSubjectStat?.totalHeldClasses;
            } else {
                currentAttendedInput = displayStats.totalAttendedClasses;
                currentHeldInput = displayStats.totalHeldClasses;
            }
            // Basic validation for manually derived counts
            if (currentAttendedInput === undefined || currentHeldInput === undefined) {
                toast.error('Cannot calculate projection: manual attendance data is incomplete.');
                return;
            }
            if (currentAttendedInput > currentHeldInput) {
                toast.error(
                    `Manual attended count (${currentAttendedInput}) cannot exceed held count (${currentHeldInput}) for calculation.`,
                );
                return;
            }
        }

        // Construct payload for the mutation
        const mutationInput: AttendanceCalculatorInput = {
            streamId: streamId,
            targetPercentage: formData.targetPercentage,
            targetDate: formData.targetDate,
            subjectName: formData.subjectName === '__OVERALL__' ? undefined : formData.subjectName,
            // Conditionally include manual counts
            currentAttendedInput: isManualMode ? currentAttendedInput : undefined,
            currentHeldInput: isManualMode ? currentHeldInput : undefined,
        };

        console.log('Calculator Payload:', mutationInput); // Log payload
        calculateMutation.mutate(mutationInput);
    };

    // --- Manual Input Handler ---
    const handleManualInputChange = (subjectName: string, value: string, maxAllowed: number) => {
        // Allow empty string or non-negative integers
        if (value === '' || /^\d+$/.test(value)) {
            const numValue = parseInt(value, 10);
            // Check if the number exceeds maxAllowed (only if value is not empty)
            if (!isNaN(numValue) && numValue > maxAllowed) {
                // Optionally provide feedback or just cap the value
                toast.error(
                    `Attended count cannot exceed held count (${maxAllowed}) for ${subjectName}.`,
                );
                // Cap the value in state (optional)
                setManualAttendance((prev) => ({ ...prev, [subjectName]: String(maxAllowed) }));
            } else {
                // Update state with valid input (number string or empty string)
                setManualAttendance((prev) => ({ ...prev, [subjectName]: value }));
            }
        }
        // Ignore invalid characters (non-digits)
    };

    // --- Render Loading/Error States ---
    if (isLoading)
        return (
            <div className="text-center p-10 flex justify-center items-center">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading analytics...
            </div>
        );
    if (error)
        return (
            <div className="text-center p-10 text-red-500">
                Error loading analytics: {error.message}
            </div>
        );
    // Add check specifically for analyticsData after loading/error handled
    if (!displayStats)
        return <div className="text-center p-10">No analytics data found for this stream.</div>;

    // --- Main Render ---
    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <h1 className="text-3xl font-bold text-gray-800">Attendance Analytics</h1>
                {/* Manual Mode Toggle */}
                <div className="flex items-center space-x-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                    <Switch
                        id="manual-mode-switch"
                        checked={isManualMode}
                        onCheckedChange={setIsManualMode}
                    />
                    <Label
                        htmlFor="manual-mode-switch"
                        className="text-sm font-medium text-yellow-800 flex items-center gap-1"
                    >
                        <Edit size={14} /> Manual Override Mode
                    </Label>
                </div>
            </div>
            {displayStats.startDate && displayStats.endDate && (
                <p className="text-sm text-gray-500 -mt-6">
                    Stats calculated from {format(parseISO(displayStats.startDate), 'MMM dd, yyyy')}{' '}
                    to {format(parseISO(displayStats.endDate), 'MMM dd, yyyy')}
                    {isManualMode && (
                        <span className="font-semibold text-yellow-700 ml-2">
                            (Using Manually Entered Attendance)
                        </span>
                    )}
                </p>
            )}

            {/* Overall Stats Cards (Use displayStats) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <Card className="shadow-sm">
                    <CardHeader>
                        {' '}
                        <CardTitle>Overall Attendance</CardTitle> <TrendingUp />{' '}
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-600">
                            {displayStats.overallAttendancePercentage !== null
                                ? `${displayStats.overallAttendancePercentage.toFixed(1)}%`
                                : 'N/A'}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            ({displayStats.totalAttendedClasses} / {displayStats.totalHeldClasses}{' '}
                            classes attended)
                        </p>
                    </CardContent>
                </Card>
                <Card className="shadow-sm">
                    <CardHeader>
                        {' '}
                        <CardTitle>Total Attended</CardTitle> <Check />{' '}
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">
                            {displayStats.totalAttendedClasses}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {isManualMode ? 'Manually Entered' : "Classes marked as 'Occurred'"}
                        </p>
                    </CardContent>
                </Card>
                <Card className="shadow-sm">
                    <CardHeader>
                        {' '}
                        <CardTitle>Total Held</CardTitle> <Calendar />{' '}
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{displayStats.totalHeldClasses}</div>
                        <p className="text-xs text-muted-foreground">Scheduled minus Cancelled</p>
                    </CardContent>
                </Card>
            </div>

            {/* Subject Stats Table (Use displayStats, conditional input) */}
            <Card className="shadow-sm">
                <CardHeader>
                    {' '}
                    <CardTitle>Subject Statistics</CardTitle>{' '}
                    <CardDescription>
                        Detailed attendance breakdown by subject.
                    </CardDescription>{' '}
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Subject</TableHead>
                                <TableHead className="text-center w-28">
                                    {isManualMode ? 'Attended (Edit)' : 'Attended'}
                                </TableHead>{' '}
                                {/* Adjust width */}
                                <TableHead className="text-center">Held</TableHead>
                                <TableHead className="text-center">Scheduled</TableHead>
                                <TableHead className="text-right">Percentage</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {displayStats.subjectStats.length === 0 && (
                                <TableRow>
                                    <TableCell
                                        colSpan={5}
                                        className="h-24 text-center text-gray-500"
                                    >
                                        No subject data available.
                                    </TableCell>
                                </TableRow>
                            )}
                            {displayStats.subjectStats.map((subject) => {
                                const maxAttended = subject.totalHeldClasses;
                                return (
                                    <TableRow key={subject.subjectName}>
                                        <TableCell className="font-medium">
                                            {subject.subjectName}
                                            {subject.courseCode && (
                                                <span className="block text-xs text-muted-foreground">
                                                    {subject.courseCode}
                                                </span>
                                            )}
                                        </TableCell>
                                        {/* Attended Cell: Input or Text */}
                                        <TableCell className="text-center">
                                            {isManualMode ? (
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    max={maxAttended}
                                                    value={
                                                        manualAttendance[subject.subjectName] ?? ''
                                                    }
                                                    onChange={(e) =>
                                                        handleManualInputChange(
                                                            subject.subjectName,
                                                            e.target.value,
                                                            maxAttended,
                                                        )
                                                    }
                                                    className={`h-8 text-center max-w-[60px] mx-auto ${
                                                        // Optional: Add error style if value > max
                                                        parseInt(
                                                            manualAttendance[subject.subjectName] ||
                                                                '0',
                                                        ) > maxAttended
                                                            ? 'border-red-500'
                                                            : ''
                                                    }`}
                                                />
                                            ) : (
                                                subject.attended
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {subject.totalHeldClasses}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {subject.totalScheduled}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {subject.attendancePercentage !== null
                                                ? `${subject.attendancePercentage.toFixed(1)}%`
                                                : 'N/A'}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                    {isManualMode && (
                        <p className="text-xs text-muted-foreground mt-3 italic">
                            Note: Statistics are recalculated based on manually entered 'Attended'
                            values. 'Held' and 'Scheduled' counts are based on fetched data.
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Attendance Calculator */}
            <Card className="shadow-sm">
                <CardHeader>
                    {' '}
                    <CardTitle>Attendance Calculator</CardTitle>{' '}
                    <CardDescription>
                        Calculate needed attendance to reach a target percentage.
                    </CardDescription>{' '}
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onCalculateSubmit)} className="space-y-4">
                        {/* ... Form Inputs (Target %, Target Date, Subject Select) ... */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <Label htmlFor="targetPercentage">
                                    Target Percentage (%) <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="targetPercentage"
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    {...register('targetPercentage')}
                                    className={calcErrors.targetPercentage ? 'border-red-500' : ''}
                                />
                                {calcErrors.targetPercentage && (
                                    <p className="text-red-500 text-xs mt-1">
                                        {calcErrors.targetPercentage.message}
                                    </p>
                                )}
                            </div>
                            <div>
                                <Label htmlFor="targetDate">
                                    Target Date <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="targetDate"
                                    type="date"
                                    {...register('targetDate')}
                                    className={calcErrors.targetDate ? 'border-red-500' : ''}
                                    min={format(new Date(), 'yyyy-MM-dd')}
                                />
                                {calcErrors.targetDate && (
                                    <p className="text-red-500 text-xs mt-1">
                                        {calcErrors.targetDate.message}
                                    </p>
                                )}
                            </div>
                            <div>
                                <Label htmlFor="subjectNameCalc">Subject (Optional)</Label>{' '}
                                {/* Changed ID slightly */}
                                <Controller
                                    control={control}
                                    name="subjectName"
                                    defaultValue="__OVERALL__"
                                    render={({ field }) => (
                                        <Select
                                            onValueChange={(value) =>
                                                field.onChange(value === '__OVERALL__' ? '' : value)
                                            }
                                            value={field.value || '__OVERALL__'}
                                        >
                                            <SelectTrigger id="subjectNameCalc">
                                                {' '}
                                                <SelectValue placeholder="Overall Attendance" />{' '}
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__OVERALL__">
                                                    Overall Attendance
                                                </SelectItem>
                                                {availableSubjects.map((subject) => (
                                                    <SelectItem key={subject} value={subject}>
                                                        {subject}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <Button type="submit" disabled={calculateMutation.isPending}>
                                {calculateMutation.isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Calculating...
                                    </>
                                ) : (
                                    'Calculate Projection'
                                )}
                                <Calculator size={16} className="ml-2" />
                            </Button>
                        </div>
                    </form>

                    {/* Calculator Result Display */}
                    {calculateMutation.isSuccess && projectionResult && (
                        <div className="mt-6 p-4 bg-blue-50 rounded border border-blue-200 text-blue-800 space-y-2">
                            <h4 className="font-semibold text-lg flex items-center">
                                <Info size={18} className="mr-2" />
                                Projection Result:
                            </h4>
                            <p className="text-sm">{projectionResult.message}</p>
                            <div className="text-xs grid grid-cols-2 gap-x-4 gap-y-1 pt-2">
                                <span>Current Attended: {projectionResult.currentAttended}</span>
                                <span>Future Held: {projectionResult.futureHeld}</span>{' '}
                                {/* Use futureHeld */}
                                <span>Current Held: {projectionResult.currentHeld}</span>{' '}
                                {/* Use currentHeld */}
                                <span>Classes Needed: {projectionResult.neededToAttend}</span>
                                <span>
                                    Current %:{' '}
                                    {projectionResult.currentPercentage?.toFixed(1) ?? 'N/A'}%
                                </span>
                                <span>Classes Can Skip: {projectionResult.canSkip}</span>
                            </div>
                        </div>
                    )}
                    {calculateMutation.isError && (
                        <div className="mt-6 p-4 bg-red-50 rounded border border-red-200 text-red-800">
                            <h4 className="font-semibold mb-1">Calculation Error</h4>
                            {/* Display the error message from the mutation's error object */}
                            <p className="text-sm">
                                {calculateMutation.error?.message ||
                                    'An unknown error occurred during calculation.'}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default AnalyticsPage;
