import { getDay, parseISO, startOfDay, endOfDay, eachDayOfInterval, isWithinInterval, format, Interval } from 'date-fns';

export function normalizeDate(date: string | Date): Date {
    const parsedDate = typeof date === 'string' ? parseISO(date) : date;
    return startOfDay(parsedDate); 
}

export function getISODayOfWeek(date: Date): number {
    const day = getDay(date);
    return day === 0 ? 7 : day;
}

export function getDaysInInterval(start: Date, end: Date): Date[] {
    return eachDayOfInterval({ start: normalizeDate(start), end: normalizeDate(end) });
}

export function isDateInTimetableRange(date: Date, validFrom: Date, validUntil: Date | null): boolean {
    const normalizedDate = normalizeDate(date);
    const interval: Interval = {
        start: normalizeDate(validFrom),
        end: validUntil ? endOfDay(normalizeDate(validUntil)) : new Date(8640000000000000),
    };
    return isWithinInterval(normalizedDate, interval);
}

export function formatDate(date: Date, formatString = 'yyyy-MM-dd'): string {
    return format(date, formatString);
}