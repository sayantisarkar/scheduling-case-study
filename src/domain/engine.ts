import type { Workshop, DayOfWeek, AvailableSlot, ScheduleItem, WorkingHours } from './types.js';
import { WorkshopRepository } from '../config/repository.js';
import { timeToNumber } from '../utils/time.js';

export class AvailabilityEngine {
    private repo = WorkshopRepository.getInstance();

    public findSlots(requestedServices: string[], requestedRepairs: string[]) {
        const startDate = new Date().toISOString().split('T')[0];
        const endDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // 1. Validate Dependencies first 
        const depCheck = this.validateDependencies(requestedServices, requestedRepairs);
        if (!depCheck.valid) {
            return { success: false, error: `Missing dependency: ${depCheck.missing}` };
        }

        const results = [];
        for (const workshop of this.repo.getWorkshops()) {
            // 2. Check if workshop supports all requested jobs 
            const { supported, missing } = this.checkWorkshopSupport(workshop, requestedServices, requestedRepairs);

            const availableSlots = supported ?
                this.search60DayWindow(workshop, requestedServices, requestedRepairs, new Date()) : [];

            results.push({
                workshopId: workshop.id,
                workshopName: workshop.name,
                canFulfillRequest: supported && availableSlots.length > 0,
                missingJobs: missing, // Required by 
                availableSlots
            });
        }

        return { results, startDate, endDate };
    }

    private search60DayWindow(workshop: Workshop, services: string[], repairs: string[], start: Date) {
        const slots: AvailableSlot[] = [];
        // Sequential order: Services first, then repairs (to handle dependencies naturally)
        const jobQueue = [...services, ...repairs];

        for (let i = 0; i < 60; i++) {
            const currentDate = new Date(start);
            currentDate.setDate(start.getDate() + i);
            const dayName = this.getDayName(currentDate);
            
            const hours = workshop.workingHours[dayName];
            if (!hours) continue; // Closed [cite: 14]

            // Logic to try and fit jobQueue into the bays sequentially [cite: 14]
            const dailySchedule = this.tryFitJobsInDay(workshop, jobQueue, currentDate, hours, dayName);
            if (dailySchedule) {
                slots.push(dailySchedule);
            }
        }
        return slots;
    }

    private getDayName(date: Date): DayOfWeek {
        return date.toLocaleDateString('en-US', { weekday: 'long' }) as DayOfWeek;
    }

    // private checkWorkshopSupport(workshop: Workshop, services: string[], repairs: string[]) {
    //     // Logic to verify if any bay in this workshop supports these jobs at all 
    //     return { possible: true, missing: [] }; 
    // }
    private checkWorkshopSupport(workshop: Workshop, services: string[], repairs: string[]) {
        const allRequestedJobs = [...services, ...repairs];
        const supportedJobsInWorkshop = new Set<string>();

        // Collect every job name supported by every bay in this workshop [cite: 7]
        workshop.bays.forEach(bay => {
            bay.services.forEach(s => Object.keys(s).forEach(k => supportedJobsInWorkshop.add(k)));
            bay.repairs.forEach(r => Object.keys(r).forEach(k => supportedJobsInWorkshop.add(k)));
        });

        const missing = allRequestedJobs.filter(job => !supportedJobsInWorkshop.has(job));

        return {
            supported: missing.length === 0,
            missing: missing
        };
    }

    // private tryFitJobsInDay(workshop: Workshop, jobs: string[], date: Date, hours: any) {
    //     // This is where the live-coding usually asks for deeper implementation
    //     // Check bay availability, sequential start/end times [cite: 12, 14]
    //     return null; // Placeholder for logic
    // }


    private tryFitJobsInDay(
        workshop: Workshop,
        jobs: string[],
        date: Date,
        hours: WorkingHours,
        dayName: DayOfWeek
    ): AvailableSlot | null {
        //const dateStr = date.toISOString().split('T')[0];
        const dateStr = date.toISOString().split('T')[0] ?? '';
        const openTime = timeToNumber(hours.open);
        const closeTime = timeToNumber(hours.close);

        let currentCursor = openTime;
        const schedule: ScheduleItem[] = [];

        // The car must move through jobs sequentially 
        for (const jobName of jobs) {
            const duration = this.repo.getJobDuration(jobName);

            // Find a bay that supports this job specifically on this day of the week [cite: 7, 14]
            const bay = workshop.bays.find(b => {
                const capabilities = [...b.services, ...b.repairs];
                return capabilities.some(cap => (cap as any)[jobName]?.includes(dayName));
            });

            // Rule: Job must end before workshop closes and bay must support it 
            if (!bay || (currentCursor + duration) > closeTime) {
                return null;
            }

            schedule.push({
                jobName: jobName,
                jobType: this.repo.getServices().some(s => s.name === jobName) ? 'service' : 'repair',
                bayId: bay.id,
                date: dateStr,
                startHour: currentCursor,
                endHour: currentCursor + duration,
                duration: duration
            });

            // Sequential update: next job starts exactly when this one ends 
            currentCursor += duration;
        }

        return {
            checkIn: `${dateStr}T${hours.open}`,
            checkOut: `${dateStr}T${hours.close}`, // Workshop checkout is usually end of day
            totalWorkHours: currentCursor - openTime,
            totalDays: 1,
            schedule
        };
    }
    private validateDependencies(services: string[], repairs: string[]): { valid: boolean; missing?: string } {
    for (const repairName of repairs) {
        const repairDef = this.repo.getRepairs().find(r => r.name === repairName);
        if (repairDef?.dependency && !services.includes(repairDef.dependency)) {
            return { valid: false, missing: repairDef.dependency };
        }
    }
    return { valid: true };
}
// private validateDependencies(services: string[], repairs: string[]): { valid: boolean; missing?: string } {
//     const repairDefinitions = this.repo.getRepairs();
    
//     for (const repairName of repairs) {
//         const repairDef = repairDefinitions.find(r => r.name === repairName);
        
//         // If the repair has a dependency and it's not in the requested services list
//         if (repairDef?.dependency && repairDef.dependency !== "" && !services.includes(repairDef.dependency)) {
//             return { valid: false, missing: repairDef.dependency };
//         }
//     }
//     return { valid: true };
// }
}