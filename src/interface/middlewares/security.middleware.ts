import cors from "cors";
import type { RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";

import { AppError } from "../../application/errors/app.error.js";
import { CLIENT_IP_HEADER } from "../../infrastructure/services/auth.service.js";
import type { Env } from "../../infrastructure/services/env.service.js";

export interface SecurityMiddlewares {
    helmetMiddleware: RequestHandler;
    corsMiddleware: RequestHandler;
    clientIpMiddleware: RequestHandler;
    apiRateLimiter: RequestHandler;
    writeRateLimiter: RequestHandler;
}

const noopMiddleware: RequestHandler = (_req, _res, next) => {
    next();
};

export function createSecurityMiddlewares(env: Env): SecurityMiddlewares {
    const allowedOrigins = new Set(env.CORS_ORIGINS);

    const helmetMiddleware = helmet({
        contentSecurityPolicy: {
            useDefaults: false,
            directives: {
                "default-src": ["'none'"],
                "frame-ancestors": ["'none'"],
                "base-uri": ["'none'"],
                "form-action": ["'none'"],
            },
        },
        crossOriginResourcePolicy: { policy: "same-site" },
        referrerPolicy: { policy: "no-referrer" },
        hsts:
            env.NODE_ENV === "production"
                ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
                : false,
    });

    const corsMiddleware = cors({
        origin(requestOrigin, callback) {
            if (!requestOrigin) {
                callback(null, true);
                return;
            }

            try {
                const normalized = new URL(requestOrigin).origin;
                if (allowedOrigins.has(normalized)) {
                    callback(null, true);
                    return;
                }
            } catch {
                callback(new AppError(403, "CORS_ORIGIN_FORBIDDEN", "Origen no permitido."));
                return;
            }

            callback(new AppError(403, "CORS_ORIGIN_FORBIDDEN", "Origen no permitido."));
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
        exposedHeaders: ["RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset"],
        maxAge: 86_400,
    });

    const clientIpMiddleware: RequestHandler = (req, _res, next) => {
        req.headers[CLIENT_IP_HEADER] = req.ip || req.socket.remoteAddress || "127.0.0.1";
        next();
    };

    const apiRateLimiter: RequestHandler =
        env.NODE_ENV === "test"
            ? noopMiddleware
            : rateLimit({
                  windowMs: 15 * 60 * 1000,
                  limit: 200,
                  standardHeaders: "draft-7",
                  legacyHeaders: false,
                  message: {
                      error: {
                          code: "RATE_LIMIT_EXCEEDED",
                          message: "Demasiadas solicitudes. Intenta nuevamente en unos minutos.",
                      },
                  },
              });

    const writeRateLimiter: RequestHandler =
        env.NODE_ENV === "test"
            ? noopMiddleware
            : rateLimit({
                  windowMs: 15 * 60 * 1000,
                  limit: 40,
                  standardHeaders: "draft-7",
                  legacyHeaders: false,
                  message: {
                      error: {
                          code: "RATE_LIMIT_EXCEEDED",
                          message: "Has superado el límite de operaciones. Intenta más tarde.",
                      },
                  },
              });

    return {
        helmetMiddleware,
        corsMiddleware,
        clientIpMiddleware,
        apiRateLimiter,
        writeRateLimiter,
    };
}

