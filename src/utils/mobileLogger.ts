// Mobile Debug Logger - Helps diagnose blank pages on mobile
class MobileDebugLogger {
    private logs: Array<{ timestamp: string; level: string; message: string; data?: any }> = [];
    private maxLogs = 100;

    constructor() {
        // Capture console errors
        this.interceptConsole();
        // Capture unhandled errors
        this.captureGlobalErrors();
    }

    private interceptConsole() {
        const originalConsoleError = console.error;
        const originalConsoleWarn = console.warn;
        const originalConsoleLog = console.log;

        console.error = (...args: any[]) => {
            this.log('ERROR', args.join(' '), args);
            originalConsoleError.apply(console, args);
        };

        console.warn = (...args: any[]) => {
            this.log('WARN', args.join(' '), args);
            originalConsoleWarn.apply(console, args);
        };

        console.log = (...args: any[]) => {
            this.log('LOG', args.join(' '), args);
            originalConsoleLog.apply(console, args);
        };
    }

    private captureGlobalErrors() {
        window.addEventListener('error', (event) => {
            this.log('UNCAUGHT_ERROR', event.message, {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error?.stack
            });
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.log('UNHANDLED_REJECTION', 'Promise rejection', {
                reason: event.reason
            });
        });
    }

    private log(level: string, message: string, data?: any) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message: message.substring(0, 200), // Truncate long messages
            data: data ? JSON.stringify(data).substring(0, 200) : undefined
        };

        this.logs.push(logEntry);

        // Keep only last maxLogs
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        // Persist to localStorage (with error handling)
        try {
            localStorage.setItem('mobile_debug_logs', JSON.stringify(this.logs.slice(-50)));
        } catch (e) {
            // Ignore quota errors
        }
    }

    public getLogs() {
        return this.logs;
    }

    public getLogsAsText() {
        return this.logs
            .map(log => `[${log.timestamp}] ${log.level}: ${log.message}`)
            .join('\n');
    }

    public clearLogs() {
        this.logs = [];
        try {
            localStorage.removeItem('mobile_debug_logs');
        } catch (e) {
            // Ignore
        }
    }
}

// Create global instance
const mobileLogger = new MobileDebugLogger();

// Expose globally for debugging
if (typeof window !== 'undefined') {
    (window as any).mobileLogger = mobileLogger;
}

export default mobileLogger;
