export const logger = {
    info: (message: string, meta?: any) => {
        console.log(JSON.stringify({ level: 'INFO', message, timestamp: new Date().toISOString(), ...meta }));
    },
    error: (message: string, error?: any) => {
        console.error(JSON.stringify({ 
            level: 'ERROR', 
            message, 
            timestamp: new Date().toISOString(), 
            stack: error instanceof Error ? error.stack : undefined,
            details: error 
        }));
    },
    warn: (message: string, meta?: any) => {
        console.warn(JSON.stringify({ level: 'WARN', message, timestamp: new Date().toISOString(), ...meta }));
    }
};