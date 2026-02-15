import type { Request, Response } from 'express';
import { AvailabilityService } from '../services/availability.service.js';
import { logger } from '../utils/logger.js';

export class AvailabilityController {
    private availabilityService = new AvailabilityService();

    public handleGetAvailability = (req: Request, res: Response): void => {

        const { services, repairs } = req.body;

        // Validation Layer: Ensuring input strictly follows requirements
        if (!Array.isArray(services) || !Array.isArray(repairs)) {
            logger.warn('Invalid request format received', { body: req.body });
            res.status(400).json({
                success: false,
                error: 'Invalid request: "services" and "repairs" must be arrays.'
            });
            return;
        }

        try {
            const response = this.availabilityService.getProcessedAvailability(services, repairs);
            res.json({ success: true, ...response });
        } catch (error: any) {
            logger.error('Error processing availability', error);
            res.status(400).json({ success: false, error: error.message });
        }
    };
}