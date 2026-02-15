import type { Workshop, DayOfWeek, AvailableSlot, ScheduleItem } from './types.js';
import { WorkshopRepository } from '../config/repository.js';
import { timeToNumber, numberToTimeString, calculateDaysBetween, getDayName, nextDayStart, nextOpening } from '../utils/time.js';

export class AvailabilityEngine {
    private repo = WorkshopRepository.getInstance();

    //Main method to trigger- finding slots
    public findSlots(requestedServices: string[], requestedRepairs: string[]) {
        const executionPlan = this.buildExecutionPlan(requestedServices, requestedRepairs);
        const results = this.repo.getWorkshops().map(workshop => {
            const plan = this.scheduleWorkshop(workshop, requestedServices, requestedRepairs);
            if (plan) {
                return {
                    workshopId: workshop.id,
                    workshopName: workshop.name,
                    canFulfillRequest: true,
                    missingJobs: [],
                    availableSlots: [plan]
                };
            }
            // If scheduling failed → determine
            const missing = this.findUnsupportedJobs(workshop, executionPlan);
            return {
                workshopId: workshop.id,
                workshopName: workshop.name,
                canFulfillRequest: false,
                missingJobs: missing,
                availableSlots: []
            };
        });
        return results;
    }

    private findUnsupportedJobs(workshop: Workshop, jobs: string[]): string[] {
        const supported = new Set<string>();
        for (const bay of workshop.bays) {
            for (const s of bay.services)
                Object.keys(s).forEach(j => supported.add(j));
            for (const r of bay.repairs)
                Object.keys(r).forEach(j => supported.add(j));
        }
        return jobs.filter(j => !supported.has(j));
    }

    //Step 1: Build Execution Plan(dependency expansion)
    private buildExecutionPlan(services: string[], repairs: string[]): string[] {
        const result: string[] = [];
        const added = new Set<string>();

        const add = (job: string) => {
            if (!added.has(job)) {
                added.add(job);
                result.push(job);
            }
        };

        for (const repair of repairs) {
            const def = this.repo.getRepairs().find(r => r.name === repair);
            if (def?.dependency) add(def.dependency);
        }

        services.forEach(add);
        repairs.forEach(add);

        return result;
    }

    //Step 2: Main logic Schedule One workshop instead of search60DayWindow
    public scheduleWorkshop(workshop: Workshop, services: string[], repairs: string[]): AvailableSlot | null {
        const jobs = this.buildExecutionPlan(services, repairs);
        let cursor = nextOpening(workshop, new Date());

        const schedule: ScheduleItem[] = [];

        for (const job of jobs) {
            const slot = this.findEarliestSlot(workshop, job, cursor);
            if (!slot) return null;

            schedule.push(slot);
            cursor = new Date(`${slot.date}T${numberToTimeString(slot.endHour)}`);
        }

        return this.buildResult(schedule as [ScheduleItem, ...ScheduleItem[]]);
    }

    //Step 3: Find the Earliest slot
    private findEarliestSlot(workshop: Workshop, job: string, after: Date): ScheduleItem | null {
        const duration = this.repo.getJobDuration(job);
        const horizon = new Date(after);
        horizon.setDate(horizon.getDate() + 60);

        let t = new Date(after);

        while (t <= horizon) {

            const dayName = getDayName(t);
            const hours = workshop.workingHours[dayName];

            // closed → jump to next day
            if (!hours) {
                t = nextDayStart(workshop, t);
                continue;
            }

            const open = timeToNumber(hours.open);
            const close = timeToNumber(hours.close);

            const currentHour = t.getHours() + t.getMinutes() / 60;
            const start = Math.max(open, currentHour);
            const end = start + duration;

            // check all bays
            for (const bay of workshop.bays) {

                const supports = [...bay.services, ...bay.repairs]
                    .some(cap => (cap as any)[job]?.includes(dayName));

                if (!supports) continue;
                if (end > close) continue;

                return {
                    jobName: job,
                    jobType: this.repo.getServices().some(s => s.name === job) ? 'service' : 'repair',
                    bayId: bay.id,
                    date: t.toISOString().split('T')[0]!,
                    startHour: start,
                    endHour: end,
                    duration
                };
            }

            // no bay worked → move to next working day
            t = nextDayStart(workshop, t);
        }

        return null;
    }

    //Step 4: Build API result
    private buildResult(schedule: [ScheduleItem, ...ScheduleItem[]]): AvailableSlot {
        //const first = schedule[0];
        const [first, ...rest] = schedule;
        const last = schedule.at(-1)!; // safe: tuple guarantees at least one element

        const totalHours = schedule.reduce((s, j) => s + j.duration, 0);
        const totalDays = calculateDaysBetween(new Date(first.date), new Date(last.date)) + 1;

        return {
            checkIn: `${first.date}T${numberToTimeString(first.startHour)}`,
            checkOut: `${last.date}T${numberToTimeString(last.endHour)}`,
            totalWorkHours: totalHours,
            totalDays,
            schedule
        };
    }

}