import {
    DuplicateUsernameError,
    UserNotFoundError,
} from "./errors/auth.error.js";
import { ValidationError } from "./errors/app.error.js";
import type { Order } from "../domain/models/order.js";
import type { Product } from "../domain/models/product.js";
import {
    type LoyaltySummary,
    type PaymentMethod,
    type User,
    type UserAddress,
    buildLoyaltySummary,
    isValidUsername,
    normalizePersonName,
    recommendProductForUser,
    validateBirthDate,
    validatePersonName,
} from "../domain/models/user.js";
import type { IOrderRepository } from "../domain/repository/IOrder.repository.js";
import type { IProductRepository } from "../domain/repository/IProduct.repository.js";
import type {
    CompleteOnboardingInput,
    CreatePaymentMethodInput,
    CreateUserAddressInput,
    IUserRepository,
    UpdateUserProfileInput,
} from "../domain/repository/IUser.repository.js";

export interface UserProfileContext {
    user: User;
    loyalty: LoyaltySummary;
    recommendedProduct: Product | null;
    orders: Order[];
}

export class UserUseCase {
    constructor(
        private readonly userRepository: IUserRepository,
        private readonly productRepository?: IProductRepository,
        private readonly orderRepository?: IOrderRepository,
    ) {}

    async getProfile(userId: string): Promise<User> {
        const user = await this.userRepository.findById(userId);
        if (!user) throw new UserNotFoundError();
        return user;
    }

    async getProfileContext(userId: string): Promise<UserProfileContext> {
        const user = await this.getProfile(userId);
        const [products, orders] = await Promise.all([
            this.productRepository ? this.productRepository.findAll() : Promise.resolve([]),
            this.orderRepository ? this.orderRepository.findByUserId(userId) : Promise.resolve([]),
        ]);

        const loyalty = buildLoyaltySummary(user.points, user.dietPreference);
        const recommendedProduct = recommendProductForUser(products, {
            dietPreference: user.dietPreference,
            spiceTolerance: user.spiceTolerance,
            favoriteMoment: user.favoriteMoment,
        });

        return {
            user,
            loyalty,
            recommendedProduct,
            orders,
        };
    }

    async updateProfile(userId: string, input: UpdateUserProfileInput): Promise<UserProfileContext> {
        const cleaned: UpdateUserProfileInput = {};

        if (input.firstName !== undefined) {
            const normalized = normalizePersonName(input.firstName);
            const error = validatePersonName(normalized, "nombres");
            if (error) throw new ValidationError(error, { firstName: error });
            cleaned.firstName = normalized;
        }

        if (input.lastName !== undefined) {
            const normalized = normalizePersonName(input.lastName);
            const error = validatePersonName(normalized, "apellidos");
            if (error) throw new ValidationError(error, { lastName: error });
            cleaned.lastName = normalized;
        }

        if (input.birthDate !== undefined) {
            const error = validateBirthDate(input.birthDate);
            if (error) throw new ValidationError(error, { birthDate: error });
            cleaned.birthDate = input.birthDate;
        }

        if (input.username !== undefined) {
            const trimmed = input.username.trim();
            if (!isValidUsername(trimmed)) {
                const msg =
                    "Usa entre 3 y 30 caracteres: letras, números, puntos, guiones o guion bajo.";
                throw new ValidationError(msg, { username: msg });
            }
            const existing = await this.userRepository.findByUsername(trimmed);
            if (existing && existing.id !== userId) {
                throw new DuplicateUsernameError();
            }
            cleaned.username = trimmed;
        }

        if (input.onboardingCompleted !== undefined) {
            cleaned.onboardingCompleted = input.onboardingCompleted;
        }

        if (input.dietPreference !== undefined) {
            cleaned.dietPreference = input.dietPreference;
        }

        if (input.spiceTolerance !== undefined) {
            cleaned.spiceTolerance = input.spiceTolerance;
        }

        if (input.favoriteMoment !== undefined) {
            cleaned.favoriteMoment = input.favoriteMoment;
        }

        await this.userRepository.updateProfile(userId, cleaned);
        return this.getProfileContext(userId);
    }

    async saveOnboarding(
        userId: string,
        input: CompleteOnboardingInput,
    ): Promise<UserProfileContext> {
        await this.userRepository.saveOnboarding(userId, input);
        return this.getProfileContext(userId);
    }

    async addAddress(userId: string, input: CreateUserAddressInput): Promise<UserAddress> {
        return this.userRepository.addAddress(userId, input);
    }

    async removeAddress(userId: string, addressId: string): Promise<void> {
        await this.userRepository.removeAddress(userId, addressId);
    }

    async addPaymentMethod(
        userId: string,
        input: CreatePaymentMethodInput,
    ): Promise<PaymentMethod> {
        return this.userRepository.addPaymentMethod(userId, input);
    }

    async removePaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
        await this.userRepository.removePaymentMethod(userId, paymentMethodId);
    }
}
