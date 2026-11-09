import type { Request, RequestHandler, Response } from "express";
import {
    Counter,
    Gauge,
    Histogram,
    Registry,
    collectDefaultMetrics,
} from "prom-client";

export const metricsRegistry = new Registry();

collectDefaultMetrics({
    prefix: "casa_flora_",
    register: metricsRegistry,
});

const httpRequestsTotal = new Counter({
    name: "casa_flora_http_requests_total",
    help: "Total number of HTTP requests handled by Casa Flora.",
    labelNames: ["method", "route", "status_code"] as const,
    registers: [metricsRegistry],
});

const httpRequestDurationSeconds = new Histogram({
    name: "casa_flora_http_request_duration_seconds",
    help: "HTTP request duration in seconds.",
    labelNames: ["method", "route", "status_code"] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [metricsRegistry],
});

const httpRequestsInFlight = new Gauge({
    name: "casa_flora_http_requests_in_flight",
    help: "Number of HTTP requests currently being handled.",
    registers: [metricsRegistry],
});

export const metricsMiddleware: RequestHandler = (req, res, next) => {
    const startedAt = process.hrtime.bigint();
    httpRequestsInFlight.inc();

    res.once("finish", () => {
        const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
        const routePath = req.route?.path?.toString();
        const route = routePath ? `${req.baseUrl}${routePath}` : req.path;
        const labels = {
            method: req.method,
            route,
            status_code: String(res.statusCode),
        };

        httpRequestsTotal.inc(labels);
        httpRequestDurationSeconds.observe(labels, durationSeconds);
        httpRequestsInFlight.dec();
    });

    next();
};

export async function metricsHandler(_req: Request, res: Response): Promise<void> {
    res.type(metricsRegistry.contentType);
    res.send(await metricsRegistry.metrics());
}
