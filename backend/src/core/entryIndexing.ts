export interface IndexedEntry {
    date: string;
    subjectName: string;
    courseCode?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    subjectIndex: number;
}

export function assignConsistentIndices<T extends {
    date: string;
    subjectName: string;
    courseCode?: string | null;
    startTime?: string | null;
    endTime?: string | null;
}>(entries: T[]): (T & { subjectIndex: number })[] {
    
    const sortedEntries = [...entries].sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        
        const subjectCompare = a.subjectName.localeCompare(b.subjectName);
        if (subjectCompare !== 0) return subjectCompare;
        
        const aTime = a.startTime || 'zzz';
        const bTime = b.startTime || 'zzz';
        return aTime.localeCompare(bTime);
    });
    
    const subjectDayIndexMap = new Map<string, number>();
    
    const result = sortedEntries.map(entry => {
        const subjectDayKey = `${entry.date}_${entry.subjectName}`;
        const currentIndex = subjectDayIndexMap.get(subjectDayKey) || 0;
        subjectDayIndexMap.set(subjectDayKey, currentIndex + 1);
        
        console.log(`BE: Assigning index ${currentIndex} to ${entry.subjectName} on ${entry.date}`);
        
        return {
            ...entry,
            subjectIndex: currentIndex
        };
    });
    
    return result;
}

export function findEntryBySubjectIndex<T extends {
    date: string;
    subjectName: string;
    courseCode?: string | null;
    subjectIndex: number;
}>(entries: T[], criteria: {
    date: string;
    subjectName: string;
    subjectIndex: number;
}): T | null {
    
    const match = entries.find(entry => 
        entry.date === criteria.date &&
        entry.subjectName === criteria.subjectName &&
        entry.subjectIndex === criteria.subjectIndex
    );
    
    return match || null;
}