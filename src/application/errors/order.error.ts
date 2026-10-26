import { AppError, NotFoundError } from "./app.error.js";

export class AddressNotFoundError extends NotFoundError {
    constructor() {
        super("ADDRESS_NOT_FOUND", "No se encontró la dirección seleccionada.");
    }
}

export class PaymentMethodNotFoundError extends NotFoundError {
    constructor() {
        super("PAYMENT_METHOD_NOT_FOUND", "No se encontró el método de pago seleccionado.");
    }
}

export class EmptyOrderItemsError extends AppError {
    constructor() {
        super(400, "EMPTY_ORDER_ITEMS", "El pedido debe incluir al menos un producto.");
    }
}

export class DeliveryAddressRequiredError extends AppError {
    constructor() {
        super(
            400,
            "DELIVERY_ADDRESS_REQUIRED",
            "Debes seleccionar o ingresar una dirección de entrega para el envío a domicilio.",
        );
    }
}

export class PaymentGatewayError extends AppError {
    constructor(message: string) {
        super(502, "PAYMENT_GATEWAY_ERROR", message);
    }
}
