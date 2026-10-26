import { z } from "zod";

import { PaymentGatewayError } from "../../application/errors/order.error.js";
import type { Env } from "./env.service.js";

export interface PaymentPreferenceItemInput {
    id: string;
    title: string;
    description: string;
    imageUrl: string;
    quantity: number;
    unitPrice: number;
}

export interface CreatePaymentPreferenceInput {
    externalReference: string;
    items: PaymentPreferenceItemInput[];
    payerEmail?: string;
    payerName?: string;
    deliveryMethod: "pickup" | "delivery";
    addressLabel: string;
}

export interface PaymentPreferenceResult {
    preferenceId: string;
    checkoutUrl: string;
    sandboxCheckoutUrl: string;
}

export interface IPaymentGateway {
    createCheckoutPreference(
        input: CreatePaymentPreferenceInput,
    ): Promise<PaymentPreferenceResult>;
}

const mercadoPagoPreferenceResponseSchema = z.object({
    id: z.string().min(1),
    init_point: z.url(),
    sandbox_init_point: z.url().optional(),
});

export class MercadoPagoGateway implements IPaymentGateway {
    constructor(private readonly env: Env) {}

    async createCheckoutPreference(
        input: CreatePaymentPreferenceInput,
    ): Promise<PaymentPreferenceResult> {
        const frontendOrigin = this.env.CORS_ORIGINS[0] ?? "http://localhost:3000";
        const isHttps = frontendOrigin.startsWith("https://");

        const payload: Record<string, unknown> = {
            items: input.items.map((item) => ({
                id: item.id,
                title: item.title,
                description: item.description.slice(0, 240),
                category_id: "food",
                quantity: item.quantity,
                currency_id: "COP",
                unit_price: item.unitPrice,
            })),
            back_urls: {
                success: `${frontendOrigin}/menu?payment=success&ref=${encodeURIComponent(input.externalReference)}`,
                failure: `${frontendOrigin}/menu?payment=failure&ref=${encodeURIComponent(input.externalReference)}`,
                pending: `${frontendOrigin}/menu?payment=pending&ref=${encodeURIComponent(input.externalReference)}`,
            },
            external_reference: input.externalReference,
            statement_descriptor: "CASA FLORA",
            metadata: {
                delivery_method: input.deliveryMethod,
                address_label: input.addressLabel,
            },
        };

        if (isHttps) {
            payload.auto_return = "approved";
        }

        if (input.payerEmail) {
            payload.payer = {
                email: input.payerEmail,
                ...(input.payerName ? { name: input.payerName } : {}),
            };
        }

        let response: Response;
        try {
            response = await fetch(
                "https://api.mercadopago.com/checkout/preferences",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${this.env.PAYMENT_SECRET}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                },
            );
        } catch {
            throw new PaymentGatewayError(
                "No fue posible conectar con la pasarela de Mercado Pago.",
            );
        }

        if (!response.ok) {
            throw new PaymentGatewayError(
                "Mercado Pago rechazó la creación de la preferencia de pago.",
            );
        }

        const rawData: unknown = await response.json();
        const parsed = mercadoPagoPreferenceResponseSchema.safeParse(rawData);
        if (!parsed.success) {
            throw new PaymentGatewayError(
                "Respuesta inválida de la pasarela de pagos.",
            );
        }

        return {
            preferenceId: parsed.data.id,
            checkoutUrl: parsed.data.init_point,
            sandboxCheckoutUrl:
                parsed.data.sandbox_init_point ?? parsed.data.init_point,
        };
    }
}

