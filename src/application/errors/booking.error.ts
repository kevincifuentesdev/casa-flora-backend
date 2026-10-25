import { ConflictError, NotFoundError } from "./app.error.js";

export class BookingNotFoundError extends NotFoundError {
    constructor() {
        super("BOOKING_NOT_FOUND", "La reserva solicitada no existe.");
    }
}

export class BookingCapacityError extends ConflictError {
    constructor(remainingDiners: number) {
        const message =
            remainingDiners <= 0
                ? "No hay cupos disponibles para el horario y ambiente seleccionados."
                : `Solo quedan ${remainingDiners} cupos disponibles para este horario y ambiente.`;
        super("BOOKING_CAPACITY_EXCEEDED", message);
    }
}

export class DuplicateBookingSlotError extends ConflictError {
    constructor() {
        super(
            "BOOKING_ALREADY_EXISTS",
            "Ya tienes una reserva activa para esa fecha y horario.",
        );
    }
}

export class BookingAlreadyCancelledError extends ConflictError {
    constructor() {
        super("BOOKING_ALREADY_CANCELLED", "Esta reserva ya fue cancelada.");
    }
}

