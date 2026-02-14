import type { Workshop, DayOfWeek, AvailableSlot, ScheduleItem, WorkingHours } from './types.js';
import { WorkshopRepository } from '../config/repository.js';
import { timeToNumber, numberToTimeString, calculateDaysBetween } from '../utils/time.js';

export class AvailabilityEngine {
    private repo = WorkshopRepository.getInstance();

    // public findSlots(requestedServices: string[], requestedRepairs: string[]) {
    //     const startDate = new Date().toISOString().split('T')[0];
    //     const endDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    //     // 1. Validate Dependencies first 
    //     const depCheck = this.validateDependencies(requestedServices, requestedRepairs);
    //     if (!depCheck.valid) {
    //         return { success: false, error: `Missing dependency: ${depCheck.missing}` };
    //     }

    //     const results = [];
    //     for (const workshop of this.repo.getWorkshops()) {
    //         // 2. Check if workshop supports all requested jobs 
    //         const { supported, missing } = this.checkWorkshopSupport(workshop, requestedServices, requestedRepairs);

    //         const availableSlots = supported ?
    //             this.search60DayWindow(workshop, requestedServices, requestedRepairs, new Date()) : [];

    //         results.push({
    //             workshopId: workshop.id,
    //             workshopName: workshop.name,
    //             canFulfillRequest: supported && availableSlots.length > 0,
    //             missingJobs: missing, // Required by 
    //             availableSlots
    //         });
    //     }

    //     return { results, startDate, endDate };
    // }

    public findSlots(requestedServices: string[], requestedRepairs: string[]) {
        // Check global dependencies first
        const depCheck = this.validateDependencies(requestedServices, requestedRepairs);

        // If dependencies are missing, we still return a successful API call 
        // but with 'canFulfillRequest: false' across the board or a specific message.
        const results = this.repo.getWorkshops().map(workshop => {
            // 1. Check if workshop even has the skills (Capability)
            const capability = this.checkWorkshopSupport(workshop, requestedServices, requestedRepairs);

            // 2. Identify if dependency failure applies
            const dependencyMet = depCheck.valid;

            // 3. Only search if both capability and dependencies are met
            // Combine services and repairs into a single array for the engine to process
            const allJobs = [...requestedServices, ...requestedRepairs];
            const availableSlots = (capability.supported && dependencyMet)
                ? this.search60DayWindow(workshop, allJobs, new Date())
                : [];

            return {
                workshopId: workshop.id,
                workshopName: workshop.name,
                canFulfillRequest: capability.supported && dependencyMet && availableSlots.length > 0,
                // Requirement: If cannot fulfill, show what's missing 
                missingJobs: !dependencyMet ? [depCheck.missing] : capability.missing,
                availableSlots
            };
        });

        return results;
    }

    // private search60DayWindow(workshop: Workshop, services: string[], repairs: string[], start: Date) {
    //     const slots: AvailableSlot[] = [];
    //     // Sequential order: Services first, then repairs (to handle dependencies naturally)
    //     const jobQueue = [...services, ...repairs];

    //     for (let i = 0; i < 60; i++) {
    //         const currentDate = new Date(start);
    //         currentDate.setDate(start.getDate() + i);
    //         const dayName = this.getDayName(currentDate);
            
    //         const hours = workshop.workingHours[dayName];
    //         if (!hours) continue; // Closed [cite: 14]

    //         // Logic to try and fit jobQueue into the bays sequentially [cite: 14]
    //         const dailySchedule = this.tryFitJobsInDay(workshop, jobQueue, currentDate, hours, dayName);
    //         if (dailySchedule) {
    //             slots.push(dailySchedule);
    //         }
    //     }
    //     return slots;
    // }

    private search60DayWindow(workshop: Workshop, jobs: string[], start: Date): AvailableSlot[] {
        const slots: AvailableSlot[] = [];

        // We iterate through the 60 days
        for (let i = 0; i < 60; i++) {
            const currentDate = new Date(start);
            currentDate.setDate(start.getDate() + i);

            // Attempt to start the sequence on 'currentDate'
            const result = this.attemptSequentialSchedule(workshop, jobs, currentDate);

            if (result) {
                slots.push(result);
                if (slots.length >= 3) break; // Usability: Return top 3 options
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

    private attemptSequentialSchedule(
    workshop: Workshop, 
    jobs: string[], 
    startDate: Date
): AvailableSlot | null {
    const schedule: ScheduleItem[] = [];
    let currentCursorDate = new Date(startDate);
    let isFirstJob = true;
    let checkInTime = "";

    for (const jobName of jobs) {
        const duration = this.repo.getJobDuration(jobName);
        let jobScheduled = false;

        // Search window: Look ahead up to 14 days to find slots for the NEXT job in sequence [cite: 10]
        for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
            const evaluationDate = new Date(currentCursorDate);
            if (dayOffset > 0) {
                evaluationDate.setDate(evaluationDate.getDate() + 1);
                // Reset time to workshop opening for any new day [cite: 14]
                evaluationDate.setHours(0, 0, 0, 0); 
            }
            
            const dayName = evaluationDate.toLocaleDateString('en-US', { weekday: 'long' }) as DayOfWeek;
            const hours = workshop.workingHours[dayName];

            // Rule: Skip if closed or Thursday/Sunday (based on config)
            if (!hours) continue; 

            const openTime = timeToNumber(hours.open);
            const closeTime = timeToNumber(hours.close);
            const dateStr = evaluationDate.toISOString().split('T')[0] ?? '';

            // Calculate when we can actually start this job today
            // It's either the workshop opening OR whenever the previous job ended
            const cursorTimeOnDay = evaluationDate.getHours() + (evaluationDate.getMinutes() / 60);
            let startTime = Math.max(openTime, cursorTimeOnDay);

            // Find a bay for this job [cite: 7]
            const bay = workshop.bays.find(b => {
                const capabilities = [...b.services, ...b.repairs];
                return capabilities.some(cap => (cap as any)[jobName]?.includes(dayName));
            });

            // Rule: Must fit within today's working hours [cite: 14]
            if (bay && (startTime + duration) <= closeTime) {
                if (isFirstJob) {
                    checkInTime = `${dateStr}T${hours.open}`;
                    isFirstJob = false;
                }

                schedule.push({
                    jobName,
                    jobType: this.repo.getServices().some(s => s.name === jobName) ? 'service' : 'repair',
                    bayId: bay.id,
                    date: dateStr,
                    startHour: startTime,
                    endHour: startTime + duration,
                    duration
                });

                // Update cursor to exactly when this job ends
                currentCursorDate = new Date(evaluationDate);
                const endH = Math.floor(startTime + duration);
                const endM = Math.round(((startTime + duration) % 1) * 60);
                currentCursorDate.setHours(endH, endM, 0, 0);
                
                jobScheduled = true;
                break;// Job placed, move to next job in 'jobs' array [cite: 14]
            }
            
            // If we are moving to dayOffset + 1, the cursor for that day will be workshop openTime
            currentCursorDate = evaluationDate; 
        }

        if (!jobScheduled) return null; 
    }

    const firstJob = schedule[0]!;
    const lastJob = schedule[schedule.length - 1]!;
    const totalDays = calculateDaysBetween(new Date(firstJob.date), new Date(lastJob.date)) + 1;

    return {
        checkIn: checkInTime,
        checkOut: `${lastJob.date}T${numberToTimeString(lastJob.endHour)}`,
        totalWorkHours: schedule.reduce((sum, item) => sum + item.duration, 0),
        totalDays: totalDays, // Should now be 2 for your 15h test [cite: 43]
        schedule
    };
}

    // private attemptSequentialSchedule(
    //     workshop: Workshop,
    //     jobs: string[],
    //     startDate: Date
    // ): AvailableSlot | null {
    //     const schedule: ScheduleItem[] = [];
    //     let currentCursorDate = new Date(startDate);
    //     let isFirstJob = true;
    //     let checkInTime = "";

    //     for (const jobName of jobs) {
    //         const duration = this.repo.getJobDuration(jobName);
    //         let jobScheduled = false;

    //         // Look ahead up to 7 days to find the next available working day for this job
    //         for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    //             const evaluationDate = new Date(currentCursorDate);
    //             evaluationDate.setDate(currentCursorDate.getDate() + dayOffset);

    //             const dayName = evaluationDate.toLocaleDateString('en-US', { weekday: 'long' }) as DayOfWeek;
    //             const hours = workshop.workingHours[dayName];

    //             if (!hours) continue; // Workshop closed this day 

    //             const openTime = timeToNumber(hours.open);
    //             const closeTime = timeToNumber(hours.close);
    //             const dateStr = evaluationDate.toISOString().split('T')[0] ?? '';

    //             // If it's the same day we finished the last job, start at the cursor.
    //             // Otherwise, start at the workshop opening time.
    //             let startTime = (dayOffset === 0) ? Math.max(openTime, timeToNumber(numberToTimeString(currentCursorDate.getHours() + currentCursorDate.getMinutes() / 60))) : openTime;

    //             // Find a bay that supports this job on this day [cite: 7, 14]
    //             const bay = workshop.bays.find(b => {
    //                 const capabilities = [...b.services, ...b.repairs];
    //                 return capabilities.some(cap => (cap as any)[jobName]?.includes(dayName));
    //             });

    //             if (bay && (startTime + duration) <= closeTime) {
    //                 if (isFirstJob) {
    //                     checkInTime = `${dateStr}T${hours.open}`;
    //                     isFirstJob = false;
    //                 }

    //                 schedule.push({
    //                     jobName,
    //                     jobType: this.repo.getServices().some(s => s.name === jobName) ? 'service' : 'repair',
    //                     bayId: bay.id,
    //                     date: dateStr,
    //                     startHour: startTime,
    //                     endHour: startTime + duration,
    //                     duration
    //                 });

    //                 // Update cursor to the end of this job
    //                 currentCursorDate = new Date(evaluationDate);
    //                 currentCursorDate.setHours(Math.floor(startTime + duration), (startTime + duration % 1) * 60);
    //                 jobScheduled = true;
    //                 break;
    //             }

    //             // If we couldn't fit it today, the next attempt must start at the beginning of a new day
    //             startTime = openTime;
    //         }

    //         if (!jobScheduled) return null; // Could not find a slot for this job in a reasonable window
    //     }

    //     const lastJob = schedule[schedule.length - 1];
    //     const totalDays = this.calculateDaysBetween(new Date(schedule[0]!.date), new Date(lastJob!.date)) + 1;

    //     return {
    //         checkIn: checkInTime,
    //         checkOut: `${lastJob!.date}T${numberToTimeString(lastJob!.endHour)}`,
    //         totalWorkHours: schedule.reduce((sum, item) => sum + item.duration, 0),
    //         totalDays: totalDays,
    //         schedule
    //     };
    // }

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