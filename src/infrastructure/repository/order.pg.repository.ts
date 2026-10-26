import {
    ORDER_STATUSES,
    type Order,
    type OrderCustomerSummary,
    type OrderItem,
    type OrderStatus,
} from "../../domain/models/order.js";
import type {
    AdminOrderFilters,
    CreateOrderRecordInput,
    IOrderRepository,
} from "../../domain/repository/IOrder.repository.js";
import type { PrismaClient } from "./client.js";
import type {
    Order as PrismaOrder,
    OrderItem as PrismaOrderItem,
} from "./generated/client.js";

type PrismaOrderUserSummary = {
    id: string;
    name: string;
    email: string;
    username: string | null;
    points: number;
};

type PrismaOrderWithItems = PrismaOrder & {
    items: PrismaOrderItem[];
    user?: PrismaOrderUserSummary | null;
};

const orderIncludeWithUser = {
    items: true,
    user: {
        select: {
            id: true,
            name: true,
            email: true,
            username: true,
            points: true,
        },
    },
} as const;

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

function toOrderCustomerDomain(
    row: PrismaOrderUserSummary,
): OrderCustomerSummary {
    return {
        id: row.id,
        name: row.name,
        email: row.email,
        username: row.username,
        points: row.points,
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
        ...(row.user ? { customer: toOrderCustomerDomain(row.user) } : {}),
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
                include: orderIncludeWithUser,
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

    async createPendingOrder(input: CreateOrderRecordInput): Promise<Order> {
        const created = await this.prisma.order.create({
            data: {
                userId: input.userId,
                addressLabel: input.addressLabel,
                paymentSummary: input.paymentSummary.slice(0, 80),
                totalAmount: input.totalAmount,
                pointsEarned: input.pointsEarned,
                status: "pending",
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
            include: orderIncludeWithUser,
        });

        return toOrderDomain(created);
    }

    async findById(orderId: string): Promise<Order | null> {
        const row = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: orderIncludeWithUser,
        });
        return row ? toOrderDomain(row) : null;
    }

    async findByUserId(userId: string): Promise<Order[]> {
        const rows = await this.prisma.order.findMany({
            where: { userId },
            include: orderIncludeWithUser,
            orderBy: { createdAt: "desc" },
        });
        return rows.map(toOrderDomain);
    }

    async findAllForAdmin(filters: AdminOrderFilters = {}): Promise<Order[]> {
        const rows = await this.prisma.order.findMany({
            where: {
                ...(filters.status ? { status: filters.status } : {}),
            },
            include: orderIncludeWithUser,
            orderBy: [{ createdAt: "desc" }, { orderNumber: "desc" }],
        });

        const mapped = rows.map(toOrderDomain);
        const query = filters.search?.trim().toLowerCase();
        if (!query) {
            return mapped;
        }

        return mapped.filter((order) => {
            const numberMatch =
                String(order.orderNumber).includes(query) ||
                `#${order.orderNumber}`.includes(query);
            const customerMatch =
                order.customer?.name.toLowerCase().includes(query) ||
                order.customer?.email.toLowerCase().includes(query) ||
                (order.customer?.username?.toLowerCase().includes(query) ??
                    false);
            const addressMatch = order.addressLabel
                .toLowerCase()
                .includes(query);
            const paymentMatch = order.paymentSummary
                .toLowerCase()
                .includes(query);
            const itemsMatch = order.items.some((i) =>
                i.productName.toLowerCase().includes(query),
            );
            return (
                numberMatch ||
                customerMatch ||
                addressMatch ||
                paymentMatch ||
                itemsMatch
            );
        });
    }

    async updateOrderStatus(
        orderId: string,
        status: OrderStatus,
        paymentSummary?: string,
    ): Promise<Order | null> {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.order.findUnique({
                where: { id: orderId },
                include: orderIncludeWithUser,
            });
            if (!existing) {
                return null;
            }

            const shouldAwardPoints =
                existing.status === "pending" &&
                (status === "preparing" || status === "delivered") &&
                existing.pointsEarned > 0;

            if (shouldAwardPoints) {
                const transition = await tx.order.updateMany({
                    where: { id: orderId, status: "pending" },
                    data: {
                        status,
                        ...(paymentSummary
                            ? { paymentSummary: paymentSummary.slice(0, 80) }
                            : {}),
                    },
                });
                if (transition.count > 0) {
                    await tx.user.update({
                        where: { id: existing.userId },
                        data: {
                            points: {
                                increment: existing.pointsEarned,
                            },
                        },
                    });
                }
            } else {
                await tx.order.update({
                    where: { id: orderId },
                    data: {
                        status,
                        ...(paymentSummary
                            ? { paymentSummary: paymentSummary.slice(0, 80) }
                            : {}),
                    },
                });
            }

            const updated = await tx.order.findUnique({
                where: { id: orderId },
                include: orderIncludeWithUser,
            });
            return updated ? toOrderDomain(updated) : toOrderDomain(existing);
        });
    }

    async confirmPaymentAndAwardPoints(
        orderId: string,
        paymentSummary: string,
    ): Promise<Order | null> {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.order.findUnique({
                where: { id: orderId },
                include: orderIncludeWithUser,
            });
            if (!existing) {
                return null;
            }
            if (existing.status !== "pending") {
                return toOrderDomain(existing);
            }

            const transition = await tx.order.updateMany({
                where: { id: orderId, status: "pending" },
                data: {
                    status: "preparing",
                    paymentSummary: paymentSummary.slice(0, 80),
                },
            });

            if (transition.count > 0 && existing.pointsEarned > 0) {
                await tx.user.update({
                    where: { id: existing.userId },
                    data: {
                        points: {
                            increment: existing.pointsEarned,
                        },
                    },
                });
            }

            const updated = await tx.order.findUnique({
                where: { id: orderId },
                include: orderIncludeWithUser,
            });
            return updated ? toOrderDomain(updated) : toOrderDomain(existing);
        });
    }

    async markPaymentCancelled(
        orderId: string,
        paymentSummary: string,
    ): Promise<Order | null> {
        const existing = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: orderIncludeWithUser,
        });
        if (!existing) {
            return null;
        }
        if (existing.status !== "pending") {
            return toOrderDomain(existing);
        }

        const updated = await this.prisma.order.update({
            where: { id: orderId },
            data: {
                status: "cancelled",
                paymentSummary: paymentSummary.slice(0, 80),
            },
            include: orderIncludeWithUser,
        });
        return toOrderDomain(updated);
    }
}

