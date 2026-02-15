import { AvailabilityEngine } from './domain/engine.js';
import express from 'express';
import { AvailabilityController } from './api/availability.controller.js';
import { logger } from './utils/logger.js';
import 'dotenv/config'; // Loads variables from .env

const port = process.env.PORT || 3000;
const engine = new AvailabilityEngine();
const app = express();
app.use(express.json());

const controller = new AvailabilityController();

app.post('/api/availability', controller.handleGetAvailability);

// Global Error Handler Middleware
app.use((err: any, req: any, res: any, next: any) => {
    logger.error('Unhandled Exception', err);

    res.status(err.status || 500).json({
        success: false,
        error: {
            message: err.message || 'Internal Server Error',
            type: err.name || 'ServerError'
        }
    });
});

// 1. Basic Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Workshop Availability Service is running' });
});

// 2. GET method for easy browser testing (Example: MOT + Brakes)
app.get('/api/test-availability', (req, res) => {
    // We simulate the example request provided in the case study [cite: 47-50]
    const services = ["MOT"];
    const repairs = ["Brakes"];

    try {
        const results = engine.findSlots(services, repairs);
        res.json({
            success: true,
            scenario: "Testing MOT + Brakes",
            results
        });
    } catch (error: any) {
        res.status(400).json({ success: false, error: error.message });
    }
});

const server = app.listen(port, () => console.log(`🚀 Workshop Availability Service running at http://localhost:${port}`));

// Graceful Shutdown Logic [cite: 21, 101]
const shutdown = () => {
    logger.info('Received shutdown signal. Closing server...');
    server.close(() => {
        logger.info('Server closed. Process exiting.');
        process.exit(0);
    });

    // Force exit if server takes too long to close
    setTimeout(() => {
        logger.error('Forced shutdown: Could not close connections in time.');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);