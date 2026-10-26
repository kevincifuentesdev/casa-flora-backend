import { UserNotFoundError } from "./errors/auth.error.js";
import { EmptyOrderItemsError } from "./errors/order.error.js";
import { ProductNotFoundError } from "./errors/product.error.js";
import type { Order } from "../domain/models/order.js";
import { calculateOrderPoints } from "../domain/models/user.js";
import type {
    CreateOrderItemRecordInput,
    IOrderRepository,
} from "../domain/repository/IOrder.repository.js";
import type { IProductRepository } from "../domain/repository/IProduct.repository.js";
import type { IUserRepository } from "../domain/repository/IUser.repository.js";

export interface CreateOrderItemInput {
    productId: string;
    quantity: number;
}

export interface CreateOrderUseCaseInput {
    items: CreateOrderItemInput[];
    addressId?: string;
    paymentMethodId?: string;
}

export class OrderUseCase {
    constructor(
        private readonly orderRepository: IOrderRepository,
        private readonly productRepository: IProductRepository,
        private readonly userRepository: IUserRepository,
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

    async listUserOrders(userId: string): Promise<Order[]> {
        return this.orderRepository.findByUserId(userId);
    }
}
