export class AppError extends Error {
    constructor(
        public readonly statusCode: number,
        public readonly code: string,
        message: string,
        public readonly details?: Record<string, string>,
    ) {
        super(message);
        this.name = new.target.name;
    }
}

export class ValidationError extends AppError {
    constructor(message: string, details?: Record<string, string>) {
        super(400, "VALIDATION_ERROR", message, details);
    }
}

export class NotFoundError extends AppError {
    constructor(code: string, message: string) {
        super(404, code, message);
    }
}

export class ConflictError extends AppError {
    constructor(code: string, message: string) {
        super(409, code, message);
    }
}
