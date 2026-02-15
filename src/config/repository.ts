import * as fs from 'fs';
import * as path from 'path';
import type { Workshop, ServiceDefinition, RepairDefinition } from '../domain/types.js';

export class WorkshopRepository {
    private static instance: WorkshopRepository;
    private data: {
        services: ServiceDefinition[];
        repairs: RepairDefinition[];
        workshops: Workshop[];
    };

    private constructor() {
        const configPath = process.env.CONFIG_PATH || './data/workshops.config.json';
        const filePath = path.resolve(process.cwd(), configPath);
        const rawData = fs.readFileSync(filePath, 'utf-8');
        this.data = JSON.parse(rawData);
    }

    public static getInstance(): WorkshopRepository {
        if (!WorkshopRepository.instance) {
            WorkshopRepository.instance = new WorkshopRepository();
        }
        return WorkshopRepository.instance;
    }

    getWorkshops() { return this.data.workshops; }
    getServices() { return this.data.services; }
    getRepairs() { return this.data.repairs; }

    getJobDuration(name: string): number {
        const job = [...this.data.services, ...this.data.repairs].find(j => j.name === name);
        return job?.duration ?? 0;
    }
}