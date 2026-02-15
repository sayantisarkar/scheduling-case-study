import { AvailabilityEngine } from '../domain/engine.js';
import { WorkshopRepository } from '../config/repository.js';

export class AvailabilityService {
    private engine = new AvailabilityEngine();
    private repo = WorkshopRepository.getInstance();

    public getProcessedAvailability(services: string[], repairs: string[]) {
        const results = this.engine.findSlots(services, repairs);

        const totalRequestedHours = [...services, ...repairs].reduce(
            (sum, name) => sum + this.repo.getJobDuration(name), 0
        );

        return {
            request: {
                services,
                repairs,
                totalRequestedHours,
                startDate: new Date().toISOString().split('T')[0],
                endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            },
            results
        };
    }
}