export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export interface ServiceDefinition {
  name: string;
  duration: number;
}

export interface RepairDefinition extends ServiceDefinition {
  dependency?: string;
}

export interface WorkingHours {
  open: string;
  close: string;
}

export interface Bay {
  id: string;
  services: Record<string, DayOfWeek[]>[];
  repairs: Record<string, DayOfWeek[]>[];
}

export interface Workshop {
  id: string;
  name: string;
  bays: Bay[];
  workingHours: Record<DayOfWeek, WorkingHours | null>;
}

export interface ScheduleItem {
    jobName: string;
    jobType: 'service' | 'repair';
    bayId: string;
    date: string;
    startHour: number;
    endHour: number;
    duration: number;
}

export interface AvailableSlot {
    checkIn: string;
    checkOut: string;
    totalWorkHours: number;
    totalDays: number;
    schedule: ScheduleItem[];
}