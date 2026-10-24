export interface LogMetadata {
    [key: string]: unknown;
}

export class LoggerService {
    constructor(private readonly silent: boolean = process.env.NODE_ENV === "test") {}

    info(message: string, meta?: LogMetadata): void {
        if (this.silent) return;
        console.info(this.format("INFO", message, meta));
    }

    warn(message: string, meta?: LogMetadata): void {
        if (this.silent) return;
        console.warn(this.format("WARN", message, meta));
    }

    error(message: string, meta?: LogMetadata): void {
        if (this.silent) return;
        console.error(this.format("ERROR", message, meta));
    }

    private format(level: string, message: string, meta?: LogMetadata): string {
        const payload = {
            timestamp: new Date().toISOString(),
            level,
            message,
            ...(meta ? { meta } : {}),
        };
        return JSON.stringify(payload);
    }
}
