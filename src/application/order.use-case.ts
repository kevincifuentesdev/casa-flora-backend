import { UserNotFoundError } from "./errors/auth.error.js";
import {
    AddressNotFoundError,
    DeliveryAddressRequiredError,
    EmptyOrderItemsError,
    PaymentGatewayError,
} from "./errors/order.error.js";
import { ProductNotFoundError } from "./errors/product.error.js";
import type { DeliveryMethod, Order } from "../domain/models/order.js";
import { calculateOrderPoints } from "../domain/models/user.js";
import type {
    CreateOrderItemRecordInput,
    IOrderRepository,
} from "../domain/repository/IOrder.repository.js";
import type { IProductRepository } from "../domain/repository/IProduct.repository.js";
import type { IUserRepository } from "../domain/repository/IUser.repository.js";
import type { IPaymentGateway } from "../infrastructure/services/payment.service.js";

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
    checkoutUrl: string;
    sandboxCheckoutUrl: string;
    deliveryMethod: DeliveryMethod;
    addressLabel: string;
    totalAmount: number;
    pointsEarned: number;
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
            createdOrder = await this.orderRepository.createAndAwardPoints({
                userId: user.id,
                addressLabel,
                paymentSummary: "Mercado Pago Checkout Pro",
                totalAmount,
                pointsEarned,
                items: itemRecords,
            });
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
            checkoutUrl: preference.checkoutUrl,
            sandboxCheckoutUrl: preference.sandboxCheckoutUrl,
            deliveryMethod: input.deliveryMethod,
            addressLabel,
            totalAmount,
            pointsEarned,
            order: createdOrder,
        };
    }

    async listUserOrders(userId: string): Promise<Order[]> {
        return this.orderRepository.findByUserId(userId);
    }
}
