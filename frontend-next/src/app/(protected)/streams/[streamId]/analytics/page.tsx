'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    analyticsService,
    AttendanceCalculatorInput,
    AttendanceProjection,
    StreamAnalyticsData,
    SubjectStats,
} from '@/services/analytics.service';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { addDays, format, parseISO } from 'date-fns';
import { Calculator, Calendar, Check, Edit, Info, Loader2, TrendingUp } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const calculatorSchema = z.object({
    targetPercentage: z.coerce.number().min(0).max(100),
    targetDate: z.string().min(1, 'Target date is required'),
    subjectName: z.string().optional(),
});
type CalculatorFormInputs = z.infer<typeof calculatorSchema>;

type ManualAttendanceInput = Record<string, string>;

export default function Analytics() {
    const params = useParams();
    const streamId = params?.streamId as string;
    const [projectionResult, setProjectionResult] = useState<AttendanceProjection | null>(null);
    const [isManualMode, setIsManualMode] = useState(false);
    const [manualAttendance, setManualAttendance] = useState<ManualAttendanceInput>({});

    const {
        data: analyticsData,
        isLoading,
        error,
        status,
    } = useQuery<StreamAnalyticsData, Error>({
        queryKey: ['streamAnalytics', streamId],
        queryFn: () => analyticsService.getStreamAnalytics(streamId!),
        enabled: !!streamId,
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false,
    });

    console.log(
        `[AnalyticsPage] Query Status: ${status}, IsLoading: ${isLoading}, Error: ${error?.message}`,
    );

    useEffect(() => {
        if (analyticsData?.subjectStats) {
            const initialManualValues: ManualAttendanceInput = {};
            analyticsData.subjectStats.forEach((stat) => {
                initialManualValues[stat.subjectName] = String(stat.attended ?? '');
            });
            setManualAttendance(initialManualValues);
        }
        setProjectionResult(null);
    }, [analyticsData, isManualMode]);

    const displayStats = useMemo((): StreamAnalyticsData | null => {
        if (!analyticsData) return null;
        if (!isManualMode) return analyticsData;

        let overallAttendedManual = 0;
        let overallHeldManual = analyticsData.totalHeldClasses;

        const manualSubjectStats: SubjectStats[] = analyticsData.subjectStats.map((stat) => {
            const manualAttendedStr = manualAttendance[stat.subjectName] ?? String(stat.attended);
            const manualAttendedNum = parseInt(manualAttendedStr, 10);
            const attended =
                !isNaN(manualAttendedNum) && manualAttendedNum >= 0
                    ? manualAttendedNum
                    : stat.attended;
            const cappedAttended = Math.min(attended, stat.totalHeldClasses);
            const held = stat.totalHeldClasses;

            const percentage =
                held > 0 ? parseFloat(((cappedAttended / held) * 100).toFixed(2)) : null;
            overallAttendedManual += cappedAttended;

            return { ...stat, attended: cappedAttended, attendancePercentage: percentage };
        });

        const overallPercentageManual =
            overallHeldManual > 0
                ? parseFloat(((overallAttendedManual / overallHeldManual) * 100).toFixed(2))
                : null;

        return {
            ...analyticsData,
            totalAttendedClasses: overallAttendedManual,
            overallAttendancePercentage: overallPercentageManual,
            subjectStats: manualSubjectStats,
        };
    }, [analyticsData, isManualMode, manualAttendance]);

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
            subjectName: '__OVERALL__',
        },
        mode: 'onSubmit',
    });

    const availableSubjects = useMemo(() => {
        if (!analyticsData?.subjectStats) return [];
        return [...new Set(analyticsData.subjectStats.map((s) => s.subjectName))].sort();
    }, [analyticsData]);

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

    const handleManualInputChange = (subjectName: string, value: string, maxAllowed: number) => {
        if (value === '' || /^\d+$/.test(value)) {
            const numValue = parseInt(value, 10);
            if (!isNaN(numValue) && numValue > maxAllowed) {
                toast.error(
                    `Attended count cannot exceed held count (${maxAllowed}) for ${subjectName}.`,
                );
                setManualAttendance((prev) => ({ ...prev, [subjectName]: String(maxAllowed) }));
            } else {
                setManualAttendance((prev) => ({ ...prev, [subjectName]: value }));
            }
        }
    };

    const onCalculateSubmit = (formData: CalculatorFormInputs) => {
        if (!streamId) {
            toast.error('Stream ID missing.');
            return;
        }
        if (!analyticsData && !isManualMode) {
            toast.error('Analytics data not loaded yet for historical calculation.');
            return;
        }
        if (isManualMode && !analyticsData?.subjectStats) {
            toast.error('Subject statistics not available for manual calculation.');
            return;
        }

        setProjectionResult(null);

        let effectiveCurrentAttended: number | undefined = undefined;
        let effectiveCurrentHeld: number | undefined = undefined;
        const subjectFilter =
            formData.subjectName === '__OVERALL__' ? undefined : formData.subjectName;

        if (isManualMode) {
            console.log(
                '[onSubmit] Manual Mode. Current manualAttendance state:',
                JSON.parse(JSON.stringify(manualAttendance)),
            );
            let attendedSum = 0;
            let heldSum = 0;
            let subjectProcessed = !subjectFilter;

            if (analyticsData?.subjectStats) {
                analyticsData.subjectStats.forEach((stat) => {
                    const isTargetSubject = !subjectFilter || stat.subjectName === subjectFilter;
                    if (isTargetSubject) {
                        subjectProcessed = true;
                        const manualAttendedStr = manualAttendance[stat.subjectName];
                        let subjectAttended = stat.attended;

                        if (manualAttendedStr !== undefined && manualAttendedStr !== '') {
                            const manualAttendedNum = parseInt(manualAttendedStr, 10);
                            if (!isNaN(manualAttendedNum) && manualAttendedNum >= 0) {
                                subjectAttended = Math.min(
                                    manualAttendedNum,
                                    stat.totalHeldClasses,
                                );
                            } else {
                                subjectAttended = stat.attended ?? 0;
                                console.warn(
                                    `Invalid manual input for ${stat.subjectName}, using fetched/default: ${subjectAttended}`,
                                );
                            }
                        } else if (manualAttendedStr === '') {
                            subjectAttended = 0;
                        }

                        attendedSum += subjectAttended;
                        heldSum += stat.totalHeldClasses;
                    }
                });
            }

            if (!subjectProcessed && subjectFilter) {
                toast.error(
                    `Subject "${subjectFilter}" not found in stats for manual calculation.`,
                );
                return;
            }

            effectiveCurrentAttended = attendedSum;
            effectiveCurrentHeld = heldSum;

            if (effectiveCurrentAttended > effectiveCurrentHeld) {
                toast.error(
                    `Manual attended count (${effectiveCurrentAttended}) cannot exceed total held (${effectiveCurrentHeld}).`,
                );
                return;
            }
            console.log('[onSubmit] Manual Mode - Calculated for payload:', {
                effectiveCurrentAttended,
                effectiveCurrentHeld,
            });
        }

        const mutationInput: AttendanceCalculatorInput = {
            streamId: streamId,
            targetPercentage: formData.targetPercentage,
            targetDate: formData.targetDate,
            subjectName: subjectFilter,
            currentAttendedInput: effectiveCurrentAttended,
            currentHeldInput: effectiveCurrentHeld,
        };

        console.log('Calculator Payload to be sent:', mutationInput);
        calculateMutation.mutate(mutationInput);
    };

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
    if (!displayStats)
        return <div className="text-center p-10">No analytics data found for this stream.</div>;

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

            {/* Overall Stats Cards */}
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

            {/* Subject Stats Table */}
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
                    {/* Calculator Result Display (uses projectionResult state) */}
                    {calculateMutation.isSuccess && projectionResult && (
                        <div className="mt-6 p-4 bg-blue-50 rounded border border-blue-200 text-blue-800 space-y-2">
                            <h4 className="font-semibold text-lg flex items-center">
                                <Info size={18} className="mr-2" />
                                Projection Result:
                            </h4>
                            <p className="text-sm">{projectionResult.message}</p>
                            <div className="text-xs grid grid-cols-2 gap-x-4 gap-y-1 pt-2">
                                <span>Current Attended: {projectionResult.currentAttended}</span>
                                <span>Future Held: {projectionResult.futureHeld}</span>
                                <span>Current Held: {projectionResult.currentHeld}</span>
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
}
