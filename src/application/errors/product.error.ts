import { ConflictError, NotFoundError } from "./app.error.js";

export class ProductNotFoundError extends NotFoundError {
    constructor(id: string) {
        super("PRODUCT_NOT_FOUND", `El plato '${id}' no existe.`);
    }
}

export class DuplicateProductError extends ConflictError {
    constructor(id: string) {
        super("PRODUCT_ALREADY_EXISTS", `Ya existe un plato con el identificador '${id}'.`);
    }
}

