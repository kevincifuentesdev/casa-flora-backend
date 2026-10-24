import type { ErrorRequestHandler, RequestHandler } from "express";

import { AppError } from "../../application/errors/app.error.js";
import type { LoggerService } from "../../infrastructure/services/logger.service.js";

export const notFoundMiddleware: RequestHandler = (req, res) => {
    res.status(404).json({
        error: {
            code: "ROUTE_NOT_FOUND",
            message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
        },
    });
};

export function createErrorMiddleware(logger: LoggerService): ErrorRequestHandler {
    return (error: unknown, req, res, _next) => {
        if (error instanceof AppError) {
            res.status(error.statusCode).json({
                error: {
                    code: error.code,
                    message: error.message,
                    ...(error.details ? { details: error.details } : {}),
                },
            });
            return;
        }

        if (
            error instanceof SyntaxError &&
            "status" in error &&
            (error as { status?: number }).status === 400
        ) {
            res.status(400).json({
                error: {
                    code: "INVALID_JSON",
                    message: "El cuerpo de la solicitud no es un JSON válido.",
                },
            });
            return;
        }

        logger.error("Unhandled request error", {
            method: req.method,
            path: req.originalUrl,
            error: error instanceof Error ? { name: error.name, message: error.message } : String(error),
        });

        res.status(500).json({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Ocurrió un error interno en el servidor.",
            },
        });
    };
}
