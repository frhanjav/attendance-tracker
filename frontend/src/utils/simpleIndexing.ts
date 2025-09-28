import { WeeklyAttendanceViewEntry } from '../services/attendance.service';

export function generateEntryKey(entry: WeeklyAttendanceViewEntry, localIndex: number): string {
    const baseKey = `${entry.date}_${entry.subjectName}`;

    const indexPart = entry.subjectIndex !== undefined ? `_idx${entry.subjectIndex}` : `_local${localIndex}`;

    const startTimePart = entry.startTime ? `_${entry.startTime.replace(':', '')}` : '_notime';
    const statusPart = `_${entry.status}`;
    const typePart = entry.isAdded ? '_added' : entry.isReplacement ? '_replacement' : '_regular';

    const uniquePart = entry.recordId ? `_${entry.recordId}` : `_${entry.courseCode || 'nocourse'}`;

    return `${baseKey}${indexPart}${startTimePart}${statusPart}${typePart}${uniquePart}`;
}

export function getSubjectIndex(entry: WeeklyAttendanceViewEntry): number {
    if (entry.subjectIndex === undefined) {
        console.error(' Missing subjectIndex for entry:', entry);
    }
    return entry.subjectIndex ?? 0;
}

export function generateMutationKey(entry: WeeklyAttendanceViewEntry): string {
    const subjectIndex = getSubjectIndex(entry);
    return `${entry.date}_${entry.subjectName}_${subjectIndex}`;
}