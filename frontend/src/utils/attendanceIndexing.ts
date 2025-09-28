import { WeeklyAttendanceViewEntry } from '../services/attendance.service';
import { assignConsistentIndices } from './entryIndexing';

export interface IndexedAttendanceEntry extends WeeklyAttendanceViewEntry {
    subjectIndex: number;
}

export interface EntryMatcher {
    date: string;
    subjectName: string;
    startTime?: string | null;
    courseCode?: string | null;
    subjectIndex: number;
}

export interface EntryPosition {
    globalIndex: number;
    localIndex: number;
    subjectIndex: number;
    reactKey: string;
}

export class AttendanceIndexManager {
    private indexedEntries: IndexedAttendanceEntry[];

    constructor(entries: WeeklyAttendanceViewEntry[]) {
        this.indexedEntries = assignConsistentIndices(entries);
    }


    getIndexedEntries(): IndexedAttendanceEntry[] {
        return this.indexedEntries;
    }

    findBySubjectIndex(criteria: { date: string; subjectName: string; subjectIndex: number }): IndexedAttendanceEntry | null {
        return this.indexedEntries.find(entry =>
            entry.date === criteria.date &&
            entry.subjectName === criteria.subjectName &&
            entry.subjectIndex === criteria.subjectIndex
        ) || null;
    }

    findByExactMatch(criteria: { date: string; subjectName: string; startTime?: string | null; courseCode?: string | null; subjectIndex: number }): IndexedAttendanceEntry | null {
        return this.indexedEntries.find(entry =>
            entry.date === criteria.date &&
            entry.subjectName === criteria.subjectName &&
            entry.startTime === criteria.startTime &&
            (entry.courseCode || null) === (criteria.courseCode || null) &&
            entry.subjectIndex === criteria.subjectIndex
        ) || null;
    }

    findEntryPosition(targetEntry: WeeklyAttendanceViewEntry, dayEntries: WeeklyAttendanceViewEntry[]): EntryPosition {
        let matchingIndexedEntry = targetEntry.recordId
            ? this.indexedEntries.find(indexed => indexed.recordId === targetEntry.recordId)
            : null;

        if (!matchingIndexedEntry) {
            const candidateMatches = this.indexedEntries.filter(indexed =>
                indexed.date === targetEntry.date &&
                indexed.subjectName === targetEntry.subjectName &&
                indexed.startTime === targetEntry.startTime &&
                (indexed.courseCode || null) === (targetEntry.courseCode || null)
            );

            const dayEntriesWithSameProps = dayEntries.filter(dayEntry =>
                dayEntry.date === targetEntry.date &&
                dayEntry.subjectName === targetEntry.subjectName &&
                dayEntry.startTime === targetEntry.startTime &&
                (dayEntry.courseCode || null) === (targetEntry.courseCode || null) &&
                dayEntry.isReplacement === targetEntry.isReplacement
            );

            const positionInGroup = dayEntriesWithSameProps.indexOf(targetEntry);
            matchingIndexedEntry = candidateMatches[positionInGroup] || candidateMatches[0];
        }

        const subjectIndex = matchingIndexedEntry?.subjectIndex || 0;

        const globalIndex = this.indexedEntries.findIndex(indexedEntry =>
            indexedEntry.date === targetEntry.date &&
            indexedEntry.subjectName === targetEntry.subjectName &&
            indexedEntry.startTime === targetEntry.startTime &&
            (indexedEntry.courseCode || null) === (targetEntry.courseCode || null) &&
            indexedEntry.subjectIndex === subjectIndex
        );

        const localIndex = dayEntries.indexOf(targetEntry);

        const reactKey = targetEntry.recordId
            ? `${targetEntry.recordId}_${localIndex}`
            : `${targetEntry.date}_${targetEntry.subjectName}_${targetEntry.startTime || 'nostart'}_${targetEntry.isReplacement}_${localIndex}`;

        return {
            globalIndex,
            localIndex,
            subjectIndex,
            reactKey
        };
    }

   findGlobalIndexForOptimisticUpdate(targetEntry: IndexedAttendanceEntry): number {
        return this.indexedEntries.findIndex(indexedEntry =>
            indexedEntry.date === targetEntry.date &&
            indexedEntry.subjectName === targetEntry.subjectName &&
            indexedEntry.startTime === targetEntry.startTime &&
            (indexedEntry.courseCode || null) === (targetEntry.courseCode || null) &&
            indexedEntry.subjectIndex === targetEntry.subjectIndex
        );
    }

    getSubjectIndexForEntry(targetEntry: WeeklyAttendanceViewEntry, dayEntries: WeeklyAttendanceViewEntry[]): number {
        return this.findEntryPosition(targetEntry, dayEntries).subjectIndex;
    }

    getNextSubjectIndex(date: string, subjectName: string): number {
        const existingEntries = this.indexedEntries.filter(entry =>
            entry.date === date &&
            entry.subjectName === subjectName
        );
        return existingEntries.length;
    }

    logEntryDetails(targetEntry: WeeklyAttendanceViewEntry, dayEntries: WeeklyAttendanceViewEntry[], _context: string) {
        const position = this.findEntryPosition(targetEntry, dayEntries);
        return position;
    }
}

export function createIndexManager(entries: WeeklyAttendanceViewEntry[]): AttendanceIndexManager {
    return new AttendanceIndexManager(entries);
}