import express from 'express';
import { AvailabilityEngine } from './domain/engine.js';
import type { Request, Response } from 'express';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const engine = new AvailabilityEngine();

app.post('/api/availability', (req: Request, res: Response) => {
    try {
        const { services = [], repairs = [] } = req.body;

        // Basic validation as requested in technical expectations
        if (!Array.isArray(services) || !Array.isArray(repairs)) {
             res.status(400).json({ success: false, error: "Invalid input format" });
             return;
        }

        const results = engine.findSlots(services, repairs);
        
        // Total requested hours calculation for the Request Summary
        // This is handled here to keep the engine focused on scheduling
        const totalRequestedHours = [...services, ...repairs].reduce((acc, job) => {
            // Accessing the repository to get durations
            return acc + engine['repo'].getJobDuration(job); 
        }, 0);

        res.json({
            success: true,
            request: {
                services,
                repairs,
                totalRequestedHours,
                startDate: new Date().toISOString().split('T')[0],
                endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            },
            results
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
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
app.listen(port, () => {
    console.log(`🚀 Workshop Availability Service running at http://localhost:${port}`);
});