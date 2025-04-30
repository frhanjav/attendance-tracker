import { getDay, parseISO, startOfDay, endOfDay, eachDayOfInterval, isWithinInterval, format, Interval } from 'date-fns';

/**
 * Converts a date string (like 'YYYY-MM-DD') or Date object to the start of that day in UTC.
 */
export function normalizeDate(date: string | Date): Date {
    const parsedDate = typeof date === 'string' ? parseISO(date) : date;
    return startOfDay(parsedDate); // Keeps the date part, sets time to 00:00:00 in local timezone, Prisma handles UTC conversion
}

/**
 * Gets the ISO day of the week (1 for Monday, 7 for Sunday).
 */
export function getISODayOfWeek(date: Date): number {
    // date-fns getDay returns 0 for Sunday, 6 for Saturday. Adjust to ISO 8601.
    const day = getDay(date);
    return day === 0 ? 7 : day;
}

/**
 * Generates an array of Dates for each day within a given interval.
 */
export function getDaysInInterval(start: Date, end: Date): Date[] {
    return eachDayOfInterval({ start: normalizeDate(start), end: normalizeDate(end) });
}

/**
 * Checks if a date falls within a timetable's validity range.
 */
export function isDateInTimetableRange(date: Date, validFrom: Date, validUntil: Date | null): boolean {
    const normalizedDate = normalizeDate(date);
    const interval: Interval = {
        start: normalizeDate(validFrom),
        end: validUntil ? endOfDay(normalizeDate(validUntil)) : new Date(8640000000000000), // Far future date if no end
    };
    return isWithinInterval(normalizedDate, interval);
}

/**
 * Formats a date for display or logging.
 */
export function formatDate(date: Date, formatString = 'yyyy-MM-dd'): string {
    return format(date, formatString);
}