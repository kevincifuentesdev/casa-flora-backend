import type { RequestHandler } from "express";
import type { ZodType } from "zod";

import { ValidationError } from "../../application/errors/app.error.js";

function toValidationError(
    issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
    fallbackMessage: string,
): ValidationError {
    const details: Record<string, string> = {};
    for (const issue of issues) {
        const key = issue.path.map(String).join(".") || "root";
        if (!details[key]) {
            details[key] = issue.message;
        }
    }
    const firstMessage = issues[0]?.message ?? fallbackMessage;
    return new ValidationError(firstMessage, details);
}

export function validateBody<T>(schema: ZodType<T>): RequestHandler {
    return (req, res, next) => {
        const parsed = schema.safeParse(req.body ?? {});
        if (!parsed.success) {
            next(toValidationError(parsed.error.issues, "El cuerpo de la solicitud es inválido."));
            return;
        }
        req.body = parsed.data;
        res.locals.validatedBody = parsed.data;
        next();
    };
}

export function validateQuery<T>(schema: ZodType<T>): RequestHandler {
    return (req, res, next) => {
        const parsed = schema.safeParse(req.query);
        if (!parsed.success) {
            next(toValidationError(parsed.error.issues, "Los parámetros de consulta son inválidos."));
            return;
        }
        res.locals.validatedQuery = parsed.data;
        next();
    };
}

export function validateParams<T>(schema: ZodType<T>): RequestHandler {
    return (req, res, next) => {
        const parsed = schema.safeParse(req.params);
        if (!parsed.success) {
            next(toValidationError(parsed.error.issues, "Los parámetros de ruta son inválidos."));
            return;
        }
        res.locals.validatedParams = parsed.data;
        next();
    };
}
