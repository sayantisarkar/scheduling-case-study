export const timeToNumber = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours ?? 0) + (minutes ?? 0) / 60;
};

export const numberToTimeString = (num: number): string => {
    const hours = Math.floor(num);
    const minutes = Math.round((num - hours) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const calculateDaysBetween = (start: Date, end: Date): number => {
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};