import type { Order, OrderStatus } from "../models/order.js";

export interface CreateOrderItemRecordInput {
    productId: string;
    productName: string;
    productDescription: string;
    productImageUrl: string;
    unitPrice: number;
    quantity: number;
}

export interface CreateOrderRecordInput {
    userId: string;
    addressLabel: string;
    paymentSummary: string;
    totalAmount: number;
    pointsEarned: number;
    items: CreateOrderItemRecordInput[];
}

export interface AdminOrderFilters {
    status?: OrderStatus;
    search?: string;
}

export interface IOrderRepository {
    createAndAwardPoints(input: CreateOrderRecordInput): Promise<Order>;
    createPendingOrder(input: CreateOrderRecordInput): Promise<Order>;
    findById(orderId: string): Promise<Order | null>;
    findByUserId(userId: string): Promise<Order[]>;
    findAllForAdmin(filters?: AdminOrderFilters): Promise<Order[]>;
    updateOrderStatus(
        orderId: string,
        status: OrderStatus,
        paymentSummary?: string,
    ): Promise<Order | null>;
    confirmPaymentAndAwardPoints(
        orderId: string,
        paymentSummary: string,
    ): Promise<Order | null>;
    markPaymentCancelled(
        orderId: string,
        paymentSummary: string,
    ): Promise<Order | null>;
}

