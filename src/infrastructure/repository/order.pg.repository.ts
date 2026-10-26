import {
    ORDER_STATUSES,
    type Order,
    type OrderItem,
    type OrderStatus,
} from "../../domain/models/order.js";
import type {
    CreateOrderRecordInput,
    IOrderRepository,
} from "../../domain/repository/IOrder.repository.js";
import type { PrismaClient } from "./client.js";
import type {
    Order as PrismaOrder,
    OrderItem as PrismaOrderItem,
} from "./generated/client.js";

type PrismaOrderWithItems = PrismaOrder & {
    items: PrismaOrderItem[];
};

function toOrderStatus(value: string): OrderStatus {
    return (ORDER_STATUSES as readonly string[]).includes(value)
        ? (value as OrderStatus)
        : "delivered";
}

function toOrderItemDomain(row: PrismaOrderItem): OrderItem {
    return {
        id: row.id,
        orderId: row.orderId,
        productId: row.productId,
        productName: row.productName,
        productDescription: row.productDescription,
        productImageUrl: row.productImageUrl,
        unitPrice: row.unitPrice,
        quantity: row.quantity,
    };
}

function toOrderDomain(row: PrismaOrderWithItems): Order {
    return {
        id: row.id,
        orderNumber: row.orderNumber,
        userId: row.userId,
        addressLabel: row.addressLabel,
        paymentSummary: row.paymentSummary,
        totalAmount: row.totalAmount,
        pointsEarned: row.pointsEarned,
        status: toOrderStatus(row.status),
        items: row.items.map(toOrderItemDomain),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

export class OrderPgRepository implements IOrderRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async createAndAwardPoints(input: CreateOrderRecordInput): Promise<Order> {
        return this.prisma.$transaction(async (tx) => {
            const created = await tx.order.create({
                data: {
                    userId: input.userId,
                    addressLabel: input.addressLabel,
                    paymentSummary: input.paymentSummary,
                    totalAmount: input.totalAmount,
                    pointsEarned: input.pointsEarned,
                    status: "delivered",
                    items: {
                        create: input.items.map((item) => ({
                            productId: item.productId,
                            productName: item.productName,
                            productDescription: item.productDescription,
                            productImageUrl: item.productImageUrl,
                            unitPrice: item.unitPrice,
                            quantity: item.quantity,
                        })),
                    },
                },
                include: { items: true },
            });

            await tx.user.update({
                where: { id: input.userId },
                data: {
                    points: {
                        increment: input.pointsEarned,
                    },
                },
            });

            return toOrderDomain(created);
        });
    }

    async findByUserId(userId: string): Promise<Order[]> {
        const rows = await this.prisma.order.findMany({
            where: { userId },
            include: { items: true },
            orderBy: { createdAt: "desc" },
        });
        return rows.map(toOrderDomain);
    }
}

