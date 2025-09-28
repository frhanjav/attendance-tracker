import { QueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AttendanceStatus, WeeklyAttendanceViewEntry } from '../services/attendance.service';

interface OptimisticUpdateConfig {
    queryClient: QueryClient;
    queryKey: (string | number)[];
}

interface AttendanceUpdateOptions {
    date: string;
    subjectName: string;
    courseCode?: string;
    subjectIndex: number;
    newStatus: AttendanceStatus;
}

interface CancelClassOptions {
    date: string;
    subjectName: string;
    entryIndex: number;
}

interface ReplaceClassOptions {
    date: string;
    originalSubjectName: string;
    replacementSubjectName: string;
    replacementCourseCode?: string | null;
    entryIndex: number;
    startTime?: string | null;
    endTime?: string | null;
    dayOfWeek: number;
    replacementSubjectIndex?: number;
}

interface AddSubjectOptions {
    date: string;
    subjectName: string;
    courseCode?: string | null;
    dayOfWeek: number;
    startTime?: string | null;
    endTime?: string | null;
    entryIndex: number;
}

export const useOptimisticAttendanceUpdates = ({ queryClient, queryKey }: OptimisticUpdateConfig) => {
    
    const optimisticallyUpdateAttendance = async (options: AttendanceUpdateOptions): Promise<WeeklyAttendanceViewEntry[] | null> => {

        await queryClient.cancelQueries({ queryKey });
        const previousData = queryClient.getQueryData<WeeklyAttendanceViewEntry[]>(queryKey);

        if (!previousData) {
            console.warn(' No previous data found for optimistic update');
            return null;
        }

        const targetIndex = previousData.findIndex(entry =>
            entry.date === options.date &&
            entry.subjectName === options.subjectName &&
            entry.subjectIndex === options.subjectIndex
        );

        if (targetIndex === -1) {
            console.warn(' No matching entry found for attendance update:', options);
            return previousData;
        }

        const optimisticData = [...previousData];
        optimisticData[targetIndex] = {
            ...optimisticData[targetIndex],
            status: options.newStatus
        };

        queryClient.setQueryData(queryKey, optimisticData);

        return previousData;
    };

    const optimisticallyCancelClass = async (options: CancelClassOptions): Promise<WeeklyAttendanceViewEntry[] | null> => {

        await queryClient.cancelQueries({ queryKey });
        const previousData = queryClient.getQueryData<WeeklyAttendanceViewEntry[]>(queryKey);

        if (!previousData) {
            return null;
        }

        const targetIndex = previousData.findIndex(entry =>
            entry.date === options.date &&
            entry.subjectName === options.subjectName &&
            entry.subjectIndex === options.entryIndex
        );

        if (targetIndex === -1) {
            console.warn(' No matching entry found for cancel class:', options);
            return previousData;
        }

        const optimisticData = [...previousData];
        optimisticData[targetIndex] = {
            ...optimisticData[targetIndex],
            status: AttendanceStatus.CANCELLED,
            isGloballyCancelled: true
        };

        queryClient.setQueryData(queryKey, optimisticData);

        return previousData;
    };

    const optimisticallyReplaceClass = async (options: ReplaceClassOptions): Promise<WeeklyAttendanceViewEntry[] | null> => {

        await queryClient.cancelQueries({ queryKey });
        const previousData = queryClient.getQueryData<WeeklyAttendanceViewEntry[]>(queryKey);

        if (!previousData) {
            return null;
        }

        const targetIndex = previousData.findIndex(entry =>
            entry.date === options.date &&
            entry.subjectName === options.originalSubjectName &&
            entry.subjectIndex === options.entryIndex
        );

        if (targetIndex === -1) {
            console.warn(' No matching entry found for replace class:', options);
            return previousData;
        }

        const optimisticData = [...previousData];

        optimisticData[targetIndex] = {
            ...optimisticData[targetIndex],
            status: AttendanceStatus.CANCELLED,
            isGloballyCancelled: true
        };

        const replacementEntry: WeeklyAttendanceViewEntry = {
            date: options.date,
            dayOfWeek: options.dayOfWeek,
            subjectName: options.replacementSubjectName,
            courseCode: options.replacementCourseCode || null,
            startTime: options.startTime || optimisticData[targetIndex].startTime,
            endTime: options.endTime || optimisticData[targetIndex].endTime,
            status: AttendanceStatus.MISSED,
            isReplacement: true,
            originalSubjectName: options.originalSubjectName,
            subjectIndex: options.replacementSubjectIndex ?? options.entryIndex,
            isAdded: false,
            isGloballyCancelled: false
        };

        optimisticData.push(replacementEntry);

        queryClient.setQueryData(queryKey, optimisticData);
        console.log(' Replace class optimistic update applied - Original cancelled, Replacement added');

        return previousData;
    };

    const optimisticallyAddSubject = async (options: AddSubjectOptions): Promise<WeeklyAttendanceViewEntry[] | null> => {
        
        await queryClient.cancelQueries({ queryKey });
        const previousData = queryClient.getQueryData<WeeklyAttendanceViewEntry[]>(queryKey);
        
        if (!previousData) {
            return null;
        }

        const newEntry: WeeklyAttendanceViewEntry = {
            date: options.date,
            dayOfWeek: options.dayOfWeek,
            subjectName: options.subjectName,
            courseCode: options.courseCode || null,
            startTime: options.startTime,
            endTime: options.endTime,
            status: AttendanceStatus.MISSED,
            isReplacement: false,
            originalSubjectName: null,
            subjectIndex: options.entryIndex,
            isAdded: true,
            isGloballyCancelled: false
        };

        const optimisticData = [...previousData, newEntry];
        queryClient.setQueryData(queryKey, optimisticData);
        
        return previousData;
    };

    const rollbackOptimisticUpdate = (previousData: WeeklyAttendanceViewEntry[] | null) => {
        if (previousData) {
            queryClient.setQueryData(queryKey, previousData);
        }
    };

    const handleOptimisticSuccess = (message: string, shouldInvalidate: boolean = false) => {
        toast.success(message);
        if (shouldInvalidate) {
            queryClient.invalidateQueries({ queryKey });
        }
    };

    const handleOptimisticError = (error: Error, previousData: WeeklyAttendanceViewEntry[] | null) => {
        rollbackOptimisticUpdate(previousData);
        toast.error(`Update failed: ${error.message}`);
    };

    return {
        optimisticallyUpdateAttendance,
        optimisticallyCancelClass,
        optimisticallyReplaceClass,
        optimisticallyAddSubject,
        rollbackOptimisticUpdate,
        handleOptimisticSuccess,
        handleOptimisticError
    };
};