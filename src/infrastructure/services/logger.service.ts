import net from "node:net";

export interface LogMetadata {
    [key: string]: unknown;
}

export interface LoggerOptions {
    application?: string;
    logstashHost?: string;
    logstashPort?: number;
}

export class LoggerService {
    private readonly application: string;
    private readonly logstashHost?: string;
    private readonly logstashPort: number;

    constructor(
        private readonly silent: boolean = process.env.NODE_ENV === "test",
        options: LoggerOptions = {},
    ) {
        this.application = options.application ?? "casa-flora-backend";
        this.logstashHost = options.logstashHost;
        this.logstashPort = options.logstashPort ?? 5001;
    }

    info(message: string, meta?: LogMetadata): void {
        if (this.silent) return;
        this.write("INFO", message, meta);
    }

    warn(message: string, meta?: LogMetadata): void {
        if (this.silent) return;
        this.write("WARN", message, meta);
    }

    error(message: string, meta?: LogMetadata): void {
        if (this.silent) return;
        this.write("ERROR", message, meta);
    }

    private write(level: string, message: string, meta?: LogMetadata): void {
        const formatted = this.format(level, message, meta);
        if (level === "ERROR") {
            console.error(formatted);
        } else if (level === "WARN") {
            console.warn(formatted);
        } else {
            console.info(formatted);
        }

        if (this.logstashHost) {
            this.sendToLogstash(formatted);
        }
    }

    private format(level: string, message: string, meta?: LogMetadata): string {
        const payload = {
            "@timestamp": new Date().toISOString(),
            level,
            message,
            ...(meta ?? {}),
            application: this.application,
        };
        return JSON.stringify(payload);
    }

    private sendToLogstash(payload: string): void {
        const socket = net.createConnection(
            { host: this.logstashHost, port: this.logstashPort },
            () => socket.end(`${payload}\n`),
        );
        socket.on("error", () => socket.destroy());
    }
}
