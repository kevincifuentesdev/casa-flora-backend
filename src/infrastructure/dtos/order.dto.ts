import { z } from "zod";

import {
    DELIVERY_METHODS,
    type DeliveryMethod,
    type Order,
    type OrderItem,
    type OrderStatus,
} from "../../domain/models/order.js";
import { PRODUCT_ID_PATTERN } from "../../domain/models/product.js";

export const createOrderItemDtoSchema = z.object({
    productId: z
        .string()
        .trim()
        .min(1)
        .max(64)
        .regex(PRODUCT_ID_PATTERN, "Identificador de plato inválido."),
    quantity: z.number().int().min(1).max(20).default(1),
});

export const checkoutDeliveryAddressDtoSchema = z.object({
    label: z
        .string()
        .trim()
        .min(2, "La etiqueta debe tener al menos 2 caracteres.")
        .max(40)
        .default("Domicilio"),
    addressLine: z
        .string()
        .trim()
        .min(5, "Ingresa una dirección válida (mínimo 5 caracteres).")
        .max(140),
    neighborhood: z
        .string()
        .trim()
        .min(2, "Ingresa el barrio de entrega.")
        .max(80),
    city: z
        .string()
        .trim()
        .min(2)
        .max(80)
        .default("Medellín, Antioquia"),
    details: z.string().trim().max(160).nullable().optional(),
    saveToProfile: z.boolean().optional(),
});

export const createOrderDtoSchema = z.object({
    items: z
        .array(createOrderItemDtoSchema)
        .min(1, "El pedido debe incluir al menos un plato.")
        .max(20),
    addressId: z.string().trim().min(1).max(64).optional(),
    paymentMethodId: z.string().trim().min(1).max(64).optional(),
});

export const createCheckoutDtoSchema = z
    .object({
        items: z
            .array(createOrderItemDtoSchema)
            .min(1, "La bolsa debe incluir al menos un plato.")
            .max(20),
        deliveryMethod: z.enum(DELIVERY_METHODS).default("pickup"),
        addressId: z.string().trim().min(1).max(64).optional(),
        deliveryAddress: checkoutDeliveryAddressDtoSchema.optional(),
    })
    .superRefine((data, ctx) => {
        if (
            data.deliveryMethod === "delivery" &&
            !data.addressId &&
            !data.deliveryAddress
        ) {
            ctx.addIssue({
                code: "custom",
                path: ["deliveryAddress"],
                message:
                    "Debes seleccionar o ingresar una dirección para recibir tu pedido a domicilio.",
            });
        }
    });

export type CreateOrderDto = z.infer<typeof createOrderDtoSchema>;
export type CreateCheckoutDto = z.infer<typeof createCheckoutDtoSchema>;

export interface OrderItemResponseDto {
    id: string;
    productId: string;
    productName: string;
    productDescription: string;
    productImageUrl: string;
    unitPrice: number;
    quantity: number;
}

export interface OrderResponseDto {
    id: string;
    orderNumber: number;
    userId: string;
    addressLabel: string;
    paymentSummary: string;
    totalAmount: number;
    pointsEarned: number;
    status: OrderStatus;
    items: OrderItemResponseDto[];
    createdAt: string;
    updatedAt: string;
}

export interface CheckoutSessionResponseDto {
    preferenceId: string;
    checkoutUrl: string;
    sandboxCheckoutUrl: string;
    deliveryMethod: DeliveryMethod;
    addressLabel: string;
    totalAmount: number;
    pointsEarned: number;
    order: OrderResponseDto | null;
}

function toOrderItemResponseDto(item: OrderItem): OrderItemResponseDto {
    return {
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        productDescription: item.productDescription,
        productImageUrl: item.productImageUrl,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
    };
}

export function toOrderResponseDto(order: Order): OrderResponseDto {
    return {
        id: order.id,
        orderNumber: order.orderNumber,
        userId: order.userId,
        addressLabel: order.addressLabel,
        paymentSummary: order.paymentSummary,
        totalAmount: order.totalAmount,
        pointsEarned: order.pointsEarned,
        status: order.status,
        items: order.items.map(toOrderItemResponseDto),
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
    };
}
