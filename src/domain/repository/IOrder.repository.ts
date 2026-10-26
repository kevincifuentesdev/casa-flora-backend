import type { Order } from "../models/order.js";

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

export interface IOrderRepository {
    createAndAwardPoints(input: CreateOrderRecordInput): Promise<Order>;
    findByUserId(userId: string): Promise<Order[]>;
}

