import { z } from "zod";

import { PaymentGatewayError } from "../../application/errors/order.error.js";
import type { PaymentVerificationStatus } from "../../domain/models/order.js";
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

export interface VerifyPaymentInput {
    externalReference: string;
    paymentId?: string;
}

export interface PaymentVerificationResult {
    status: PaymentVerificationStatus;
    paymentId: string | null;
    paymentSummary: string;
}

export interface IPaymentGateway {
    createCheckoutPreference(
        input: CreatePaymentPreferenceInput,
    ): Promise<PaymentPreferenceResult>;
    verifyPayment(input: VerifyPaymentInput): Promise<PaymentVerificationResult>;
}

const mercadoPagoPreferenceResponseSchema = z.object({
    id: z.string().min(1),
    init_point: z.url(),
    sandbox_init_point: z.url().optional(),
});

const mercadoPagoPaymentItemSchema = z.object({
    id: z.union([z.number(), z.string()]),
    status: z.string(),
    external_reference: z.string().nullable().optional(),
    payment_method_id: z.string().nullable().optional(),
    card: z
        .object({
            last_four_digits: z.string().nullable().optional(),
        })
        .nullable()
        .optional(),
});

const mercadoPagoPaymentSearchResponseSchema = z.object({
    results: z.array(mercadoPagoPaymentItemSchema).default([]),
});

function formatApprovedPaymentSummary(
    payment: z.infer<typeof mercadoPagoPaymentItemSchema>,
): string {
    const rawMethod = payment.payment_method_id?.trim() ?? "";
    const methodLabel =
        rawMethod.toLowerCase() === "visa" || rawMethod.toLowerCase() === "debvisa"
            ? "Visa"
            : rawMethod.toLowerCase() === "master" ||
                rawMethod.toLowerCase() === "debmaster"
              ? "Mastercard"
              : rawMethod.toLowerCase() === "pse"
                ? "PSE"
                : rawMethod
                  ? rawMethod.toUpperCase()
                  : "";
    const lastFour = payment.card?.last_four_digits?.trim() ?? "";

    if (methodLabel && lastFour) {
        return `Mercado Pago (${methodLabel} **** ${lastFour} • Aprobado)`.slice(
            0,
            80,
        );
    }
    if (methodLabel) {
        return `Mercado Pago (${methodLabel} • Aprobado)`.slice(0, 80);
    }
    return `Mercado Pago (Aprobado #${String(payment.id)})`.slice(0, 80);
}

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

        const shouldAttachPayerEmail =
            Boolean(input.payerEmail) &&
            (this.env.NODE_ENV === "production" ||
                input.payerEmail?.toLowerCase().endsWith("@testuser.com"));

        if (shouldAttachPayerEmail && input.payerEmail) {
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

    async verifyPayment(
        input: VerifyPaymentInput,
    ): Promise<PaymentVerificationResult> {
        const candidates: Array<z.infer<typeof mercadoPagoPaymentItemSchema>> = [];

        if (input.paymentId && /^\d+$/.test(input.paymentId.trim())) {
            try {
                const directResponse = await fetch(
                    `https://api.mercadopago.com/v1/payments/${encodeURIComponent(input.paymentId.trim())}`,
                    {
                        method: "GET",
                        headers: {
                            Authorization: `Bearer ${this.env.PAYMENT_SECRET}`,
                        },
                    },
                );
                if (directResponse.ok) {
                    const rawDirect: unknown = await directResponse.json();
                    const parsedDirect =
                        mercadoPagoPaymentItemSchema.safeParse(rawDirect);
                    if (
                        parsedDirect.success &&
                        (!parsedDirect.data.external_reference ||
                            parsedDirect.data.external_reference ===
                                input.externalReference)
                    ) {
                        candidates.push(parsedDirect.data);
                    }
                }
            } catch {
                void 0;
            }
        }

        if (candidates.length === 0) {
            let searchResponse: Response;
            try {
                const searchUrl = `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(input.externalReference)}&sort=date_created&criteria=desc&limit=5`;
                searchResponse = await fetch(searchUrl, {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${this.env.PAYMENT_SECRET}`,
                    },
                });
            } catch {
                throw new PaymentGatewayError(
                    "No fue posible verificar el estado del pago con Mercado Pago.",
                );
            }

            if (!searchResponse.ok) {
                throw new PaymentGatewayError(
                    "Mercado Pago no pudo consultar el estado del pago.",
                );
            }

            const rawSearch: unknown = await searchResponse.json();
            const parsedSearch =
                mercadoPagoPaymentSearchResponseSchema.safeParse(rawSearch);
            if (parsedSearch.success) {
                candidates.push(...parsedSearch.data.results);
            }
        }

        const approved = candidates.find(
            (item) => item.status.toLowerCase() === "approved",
        );
        if (approved) {
            return {
                status: "approved",
                paymentId: String(approved.id),
                paymentSummary: formatApprovedPaymentSummary(approved),
            };
        }

        const rejected = candidates.find((item) => {
            const st = item.status.toLowerCase();
            return (
                st === "rejected" ||
                st === "cancelled" ||
                st === "refunded" ||
                st === "charged_back"
            );
        });
        if (rejected) {
            return {
                status: "rejected",
                paymentId: String(rejected.id),
                paymentSummary: "Mercado Pago (Pago rechazado)",
            };
        }

        const latest = candidates[0] ?? null;
        return {
            status: "pending",
            paymentId: latest ? String(latest.id) : null,
            paymentSummary: "Mercado Pago (Pendiente de pago)",
        };
    }
}

