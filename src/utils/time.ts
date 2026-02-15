import type { Workshop, DayOfWeek } from '../domain/types.js';

/** Converts the time to hours */
export const timeToNumber = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours ?? 0) + (minutes ?? 0) / 60;
};

/** Converts back the hours to construct time */
export const numberToTimeString = (num: number): string => {
    const hours = Math.floor(num);
    const minutes = Math.round((num - hours) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

/** Returns the number of days between 2 dates */
export const calculateDaysBetween = (start: Date, end: Date): number => {
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/** Converts a Date object to the day name (e.g., Monday, Tuesday) */
export const getDayName = (date: Date): DayOfWeek => {
    return date.toLocaleDateString('en-US', { weekday: 'long' }) as DayOfWeek;
};

/** Returns the start of the next day where the workshop is open */
export const nextDayStart = (workshop: Workshop, date: Date): Date => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return nextOpening(workshop, d);
};

/** Returns the next opening time for the workshop on or after the given date */
export const nextOpening = (workshop: Workshop, date: Date): Date => {
    let t = new Date(date);
    while (true) {
        const day = getDayName(t);
        const hours = workshop.workingHours[day];

        if (hours) {
            const open = timeToNumber(hours.open);
            t.setHours(Math.floor(open), (open % 1) * 60, 0, 0);
            return t;
        }
        t.setDate(t.getDate() + 1);
        t.setHours(0, 0, 0, 0);
    }
};
