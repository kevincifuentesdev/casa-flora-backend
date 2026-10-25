import { AppError, ConflictError, NotFoundError } from "./app.error.js";

export class UnauthorizedError extends AppError {
    constructor(message = "No has iniciado sesión o tu sesión ha expirado.") {
        super(401, "UNAUTHORIZED", message);
    }
}

export class ForbiddenError extends AppError {
    constructor(message = "No tienes permisos para realizar esta acción.") {
        super(403, "FORBIDDEN", message);
    }
}

export class UserNotFoundError extends NotFoundError {
    constructor() {
        super("USER_NOT_FOUND", "Usuario no encontrado.");
    }
}

export class DuplicateUsernameError extends ConflictError {
    constructor() {
        super("USERNAME_TAKEN", "Ese nombre de usuario ya está en uso.");
    }
}

