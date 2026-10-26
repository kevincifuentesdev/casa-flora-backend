import { z } from "zod";

import type { Order, OrderItem, OrderStatus } from "../../domain/models/order.js";
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

export const createOrderDtoSchema = z.object({
    items: z
        .array(createOrderItemDtoSchema)
        .min(1, "El pedido debe incluir al menos un plato.")
        .max(20),
    addressId: z.string().trim().min(1).max(64).optional(),
    paymentMethodId: z.string().trim().min(1).max(64).optional(),
});

export type CreateOrderDto = z.infer<typeof createOrderDtoSchema>;

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

