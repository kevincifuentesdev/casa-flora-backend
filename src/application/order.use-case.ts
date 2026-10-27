import { UserNotFoundError } from "./errors/auth.error.js";
import {
    AddressNotFoundError,
    DeliveryAddressRequiredError,
    EmptyOrderItemsError,
    OrderNotFoundError,
    PaymentGatewayError,
} from "./errors/order.error.js";
import { ProductNotFoundError } from "./errors/product.error.js";
import type {
    DeliveryMethod,
    Order,
    OrderStatus,
    PaymentVerificationStatus,
} from "../domain/models/order.js";
import { calculateOrderPoints } from "../domain/models/user.js";
import type {
    AdminOrderFilters,
    CreateOrderItemRecordInput,
    IOrderRepository,
} from "../domain/repository/IOrder.repository.js";
import type { IProductRepository } from "../domain/repository/IProduct.repository.js";
import type { IUserRepository } from "../domain/repository/IUser.repository.js";
import type { IPaymentGateway } from "../infrastructure/services/payment.service.js";

export const ORDER_PAYMENT_TIMEOUT_MS = 90 * 1000;

export interface CreateOrderItemInput {
    productId: string;
    quantity: number;
}

export interface CreateOrderUseCaseInput {
    items: CreateOrderItemInput[];
    addressId?: string;
    paymentMethodId?: string;
}

export interface CheckoutDeliveryAddressInput {
    label: string;
    addressLine: string;
    neighborhood: string;
    city: string;
    details?: string | null;
    saveToProfile?: boolean;
}

export interface CreateCheckoutUseCaseInput {
    items: CreateOrderItemInput[];
    deliveryMethod: DeliveryMethod;
    addressId?: string;
    deliveryAddress?: CheckoutDeliveryAddressInput;
}

export interface CheckoutSessionResult {
    preferenceId: string;
    externalReference: string;
    checkoutUrl: string;
    sandboxCheckoutUrl: string;
    deliveryMethod: DeliveryMethod;
    addressLabel: string;
    totalAmount: number;
    pointsEarned: number;
    order: Order | null;
}

export interface VerifyCheckoutPaymentUseCaseInput {
    externalReference: string;
    paymentId?: string;
}

export interface VerifyCheckoutPaymentResult {
    externalReference: string;
    status: PaymentVerificationStatus;
    paymentId: string | null;
    paymentSummary: string;
    order: Order | null;
}

export class OrderUseCase {
    constructor(
        private readonly orderRepository: IOrderRepository,
        private readonly productRepository: IProductRepository,
        private readonly userRepository: IUserRepository,
        private readonly paymentGateway?: IPaymentGateway,
    ) {}

    async createOrder(userId: string, input: CreateOrderUseCaseInput): Promise<Order> {
        if (!input.items || input.items.length === 0) {
            throw new EmptyOrderItemsError();
        }

        const user = await this.userRepository.findById(userId);
        if (!user) throw new UserNotFoundError();

        const itemRecords: CreateOrderItemRecordInput[] = [];
        let totalAmount = 0;

        for (const item of input.items) {
            const product = await this.productRepository.findById(item.productId);
            if (!product) {
                throw new ProductNotFoundError(item.productId);
            }
            const quantity = Math.max(1, Math.min(20, Math.floor(item.quantity)));
            totalAmount += product.price * quantity;
            itemRecords.push({
                productId: product.id,
                productName: product.name,
                productDescription: product.description,
                productImageUrl: product.imageUrl,
                unitPrice: product.price,
                quantity,
            });
        }

        const selectedAddress =
            (input.addressId
                ? user.addresses.find((a) => a.id === input.addressId)
                : undefined) ??
            user.addresses.find((a) => a.isDefault) ??
            user.addresses[0];

        const addressLabel = selectedAddress
            ? `Dirección ${selectedAddress.label} • ${selectedAddress.neighborhood}`
            : "Recogida en local • El Poblado";

        const selectedPayment =
            (input.paymentMethodId
                ? user.paymentMethods.find((p) => p.id === input.paymentMethodId)
                : undefined) ??
            user.paymentMethods.find((p) => p.isDefault) ??
            user.paymentMethods[0];

        const paymentSummary = selectedPayment
            ? selectedPayment.lastFour
                ? `${selectedPayment.brand} **** ${selectedPayment.lastFour}`
                : selectedPayment.brand
            : "Pago contra entrega";

        const pointsEarned = calculateOrderPoints(totalAmount);

        return this.orderRepository.createAndAwardPoints({
            userId,
            addressLabel,
            paymentSummary,
            totalAmount,
            pointsEarned,
            items: itemRecords,
        });
    }

    async createCheckout(
        userId: string | null,
        input: CreateCheckoutUseCaseInput,
    ): Promise<CheckoutSessionResult> {
        if (!input.items || input.items.length === 0) {
            throw new EmptyOrderItemsError();
        }

        if (!this.paymentGateway) {
            throw new PaymentGatewayError("Pasarela de pagos no configurada.");
        }

        const user = userId ? await this.userRepository.findById(userId) : null;
        if (userId && !user) {
            throw new UserNotFoundError();
        }

        const itemRecords: CreateOrderItemRecordInput[] = [];
        let totalAmount = 0;

        for (const item of input.items) {
            const product = await this.productRepository.findById(item.productId);
            if (!product) {
                throw new ProductNotFoundError(item.productId);
            }
            const quantity = Math.max(1, Math.min(20, Math.floor(item.quantity)));
            totalAmount += product.price * quantity;
            itemRecords.push({
                productId: product.id,
                productName: product.name,
                productDescription: product.description,
                productImageUrl: product.imageUrl,
                unitPrice: product.price,
                quantity,
            });
        }

        let addressLabel = "Recoger en el lugar, Sede El Poblado";

        if (input.deliveryMethod === "delivery") {
            if (input.addressId) {
                if (!user) {
                    throw new DeliveryAddressRequiredError();
                }
                const found = user.addresses.find((a) => a.id === input.addressId);
                if (!found) {
                    throw new AddressNotFoundError();
                }
                addressLabel = `Domicilio (${found.label}): ${found.addressLine}, ${found.neighborhood}`;
            } else if (input.deliveryAddress) {
                const addr = input.deliveryAddress;
                addressLabel = `Domicilio (${addr.label}): ${addr.addressLine}, ${addr.neighborhood}`;
                if (user && (addr.saveToProfile || user.addresses.length === 0)) {
                    await this.userRepository.addAddress(user.id, {
                        label: addr.label,
                        addressLine: addr.addressLine,
                        neighborhood: addr.neighborhood,
                        city: addr.city,
                        details: addr.details ?? null,
                        isDefault: user.addresses.length === 0,
                    });
                }
            } else {
                throw new DeliveryAddressRequiredError();
            }
        }

        const pointsEarned = calculateOrderPoints(totalAmount);
        let createdOrder: Order | null = null;

        if (user) {
            createdOrder = await this.orderRepository.createPendingOrder({
                userId: user.id,
                addressLabel,
                paymentSummary: "Mercado Pago (Pendiente de pago)",
                totalAmount,
                pointsEarned,
                items: itemRecords,
            });

            const orderIdToCancel = createdOrder.id;
            setTimeout(async () => {
                try {
                    const currentOrder =
                        await this.orderRepository.findById(orderIdToCancel);
                    if (currentOrder && currentOrder.status === "pending") {
                        let isApproved = false;
                        if (this.paymentGateway) {
                            const check =
                                await this.paymentGateway.verifyPayment({
                                    externalReference: currentOrder.id,
                                });
                            if (check.status === "approved") {
                                await this.orderRepository.confirmPaymentAndAwardPoints(
                                    currentOrder.id,
                                    check.paymentSummary,
                                );
                                isApproved = true;
                            }
                        }
                        if (!isApproved) {
                            await this.orderRepository.markPaymentCancelled(
                                currentOrder.id,
                                "Mercado Pago (Cancelado automáticamente tras 90 segundos sin verificación de pago)",
                            );
                        }
                    }
                } catch {
                    // ignore timeout errors
                }
            }, ORDER_PAYMENT_TIMEOUT_MS).unref?.();
        }

        const externalReference = createdOrder
            ? createdOrder.id
            : `guest-${Date.now()}`;

        const preference = await this.paymentGateway.createCheckoutPreference({
            externalReference,
            items: itemRecords.map((item) => ({
                id: item.productId,
                title: item.productName,
                description: item.productDescription,
                imageUrl: item.productImageUrl,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
            })),
            ...(user ? { payerEmail: user.email, payerName: user.name } : {}),
            deliveryMethod: input.deliveryMethod,
            addressLabel,
        });

        return {
            preferenceId: preference.preferenceId,
            externalReference,
            checkoutUrl: preference.checkoutUrl,
            sandboxCheckoutUrl: preference.sandboxCheckoutUrl,
            deliveryMethod: input.deliveryMethod,
            addressLabel,
            totalAmount,
            pointsEarned,
            order: createdOrder,
        };
    }

    async verifyCheckoutPayment(
        userId: string | null,
        input: VerifyCheckoutPaymentUseCaseInput,
    ): Promise<VerifyCheckoutPaymentResult> {
        if (!this.paymentGateway) {
            throw new PaymentGatewayError("Pasarela de pagos no configurada.");
        }

        const existingOrder = await this.orderRepository.findById(
            input.externalReference,
        );

        if (existingOrder && userId && existingOrder.userId !== userId) {
            return {
                externalReference: input.externalReference,
                status: "pending",
                paymentId: null,
                paymentSummary: "Mercado Pago (Pendiente de pago)",
                order: null,
            };
        }

        if (
            existingOrder &&
            (existingOrder.status === "preparing" ||
                existingOrder.status === "delivered")
        ) {
            return {
                externalReference: input.externalReference,
                status: "approved",
                paymentId: null,
                paymentSummary: existingOrder.paymentSummary,
                order: existingOrder,
            };
        }

        if (existingOrder && existingOrder.status === "cancelled") {
            return {
                externalReference: input.externalReference,
                status: "rejected",
                paymentId: null,
                paymentSummary: existingOrder.paymentSummary,
                order: existingOrder,
            };
        }

        const isTimedOut =
            Boolean(existingOrder) &&
            existingOrder!.status === "pending" &&
            Date.now() - existingOrder!.createdAt.getTime() >=
                ORDER_PAYMENT_TIMEOUT_MS;

        const verification = await this.paymentGateway.verifyPayment({
            externalReference: input.externalReference,
            ...(input.paymentId ? { paymentId: input.paymentId } : {}),
        });

        let updatedOrder: Order | null = existingOrder;

        if (existingOrder) {
            if (verification.status === "approved") {
                updatedOrder =
                    await this.orderRepository.confirmPaymentAndAwardPoints(
                        existingOrder.id,
                        verification.paymentSummary,
                    );
            } else if (verification.status === "rejected" || isTimedOut) {
                const cancelReason =
                    verification.status === "rejected"
                        ? verification.paymentSummary
                        : "Mercado Pago (Cancelado tras 90 segundos sin verificación de pago)";
                updatedOrder =
                    await this.orderRepository.markPaymentCancelled(
                        existingOrder.id,
                        cancelReason,
                    );
                return {
                    externalReference: input.externalReference,
                    status: "rejected",
                    paymentId: verification.paymentId,
                    paymentSummary: cancelReason,
                    order: updatedOrder,
                };
            }
        }

        return {
            externalReference: input.externalReference,
            status: verification.status,
            paymentId: verification.paymentId,
            paymentSummary: verification.paymentSummary,
            order: updatedOrder,
        };
    }

    async cancelPendingOrder(
        userId: string,
        orderId: string,
    ): Promise<Order | null> {
        const existing = await this.orderRepository.findById(orderId);
        if (!existing || existing.userId !== userId) {
            return null;
        }
        if (existing.status !== "pending") {
            return existing;
        }
        return this.orderRepository.markPaymentCancelled(
            existing.id,
            "Mercado Pago (Pago cancelado)",
        );
    }

    async listUserOrders(userId: string): Promise<Order[]> {
        const orders = await this.orderRepository.findByUserId(userId);
        if (!this.paymentGateway) {
            return orders;
        }

        const pendingOrders = orders.filter((o) => o.status === "pending");
        if (pendingOrders.length === 0) {
            return orders;
        }

        let changed = false;
        for (const pending of pendingOrders) {
            try {
                const isTimedOut =
                    Date.now() - pending.createdAt.getTime() >=
                    ORDER_PAYMENT_TIMEOUT_MS;
                const verification = await this.paymentGateway.verifyPayment({
                    externalReference: pending.id,
                });
                if (verification.status === "approved") {
                    await this.orderRepository.confirmPaymentAndAwardPoints(
                        pending.id,
                        verification.paymentSummary,
                    );
                    changed = true;
                } else if (verification.status === "rejected" || isTimedOut) {
                    await this.orderRepository.markPaymentCancelled(
                        pending.id,
                        verification.status === "rejected"
                            ? verification.paymentSummary
                            : "Mercado Pago (Cancelado tras 90 segundos sin verificación de pago)",
                    );
                    changed = true;
                }
            } catch {
                void 0;
            }
        }

        if (!changed) {
            return orders;
        }

        return this.orderRepository.findByUserId(userId);
    }

    async listAllOrdersForAdmin(
        filters: AdminOrderFilters = {},
    ): Promise<Order[]> {
        const orders = await this.orderRepository.findAllForAdmin(filters);
        if (!this.paymentGateway) {
            return orders;
        }

        const pendingOrders = orders.filter((o) => o.status === "pending");
        if (pendingOrders.length === 0) {
            return orders;
        }

        let changed = false;
        for (const pending of pendingOrders) {
            try {
                const isTimedOut =
                    Date.now() - pending.createdAt.getTime() >=
                    ORDER_PAYMENT_TIMEOUT_MS;
                const verification = await this.paymentGateway.verifyPayment({
                    externalReference: pending.id,
                });
                if (verification.status === "approved") {
                    await this.orderRepository.confirmPaymentAndAwardPoints(
                        pending.id,
                        verification.paymentSummary,
                    );
                    changed = true;
                } else if (verification.status === "rejected" || isTimedOut) {
                    await this.orderRepository.markPaymentCancelled(
                        pending.id,
                        verification.status === "rejected"
                            ? verification.paymentSummary
                            : "Mercado Pago (Cancelado tras 90 segundos sin verificación de pago)",
                    );
                    changed = true;
                }
            } catch {
                void 0;
            }
        }

        if (!changed) {
            return orders;
        }

        return this.orderRepository.findAllForAdmin(filters);
    }

    async updateOrderStatusByAdmin(
        orderId: string,
        status: OrderStatus,
    ): Promise<Order> {
        const existing = await this.orderRepository.findById(orderId);
        if (!existing) {
            throw new OrderNotFoundError();
        }

        let paymentSummary: string | undefined;
        if (
            existing.status === "pending" &&
            (status === "preparing" || status === "delivered") &&
            existing.paymentSummary.includes("Pendiente")
        ) {
            paymentSummary = "Confirmado por administración";
        } else if (
            status === "cancelled" &&
            existing.paymentSummary.includes("Pendiente")
        ) {
            paymentSummary = "Cancelado por administración";
        }

        const updated = await this.orderRepository.updateOrderStatus(
            orderId,
            status,
            paymentSummary,
        );
        if (!updated) {
            throw new OrderNotFoundError();
        }
        return updated;
    }
}
