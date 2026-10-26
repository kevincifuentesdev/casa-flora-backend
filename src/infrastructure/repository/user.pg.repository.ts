import { DuplicateUsernameError, UserNotFoundError } from "../../application/errors/auth.error.js";
import {
    AddressNotFoundError,
    PaymentMethodNotFoundError,
} from "../../application/errors/order.error.js";
import {
    DIET_PREFERENCES,
    FAVORITE_MOMENTS,
    PAYMENT_METHOD_TYPES,
    SPICE_TOLERANCES,
    USER_ROLES,
    type DietPreference,
    type FavoriteMoment,
    type PaymentMethod,
    type PaymentMethodType,
    type SpiceTolerance,
    type User,
    type UserAddress,
    type UserRole,
} from "../../domain/models/user.js";
import type {
    CompleteOnboardingInput,
    CreatePaymentMethodInput,
    CreateUserAddressInput,
    IUserRepository,
    UpdateUserProfileInput,
} from "../../domain/repository/IUser.repository.js";
import type { PrismaClient } from "./client.js";
import type {
    PaymentMethod as PrismaPaymentMethod,
    User as PrismaUser,
    UserAddress as PrismaUserAddress,
} from "./generated/client.js";

type PrismaUserWithRelations = PrismaUser & {
    addresses?: PrismaUserAddress[];
    paymentMethods?: PrismaPaymentMethod[];
};

function toRole(value: string): UserRole {
    return (USER_ROLES as readonly string[]).includes(value) ? (value as UserRole) : "customer";
}

function toDietPreference(value: string | null): DietPreference | null {
    return value && (DIET_PREFERENCES as readonly string[]).includes(value)
        ? (value as DietPreference)
        : null;
}

function toSpiceTolerance(value: string | null): SpiceTolerance | null {
    return value && (SPICE_TOLERANCES as readonly string[]).includes(value)
        ? (value as SpiceTolerance)
        : null;
}

function toFavoriteMoment(value: string | null): FavoriteMoment | null {
    return value && (FAVORITE_MOMENTS as readonly string[]).includes(value)
        ? (value as FavoriteMoment)
        : null;
}

function toPaymentMethodType(value: string): PaymentMethodType {
    return (PAYMENT_METHOD_TYPES as readonly string[]).includes(value)
        ? (value as PaymentMethodType)
        : "card";
}

function toAddressDomain(row: PrismaUserAddress): UserAddress {
    return {
        id: row.id,
        userId: row.userId,
        label: row.label,
        addressLine: row.addressLine,
        neighborhood: row.neighborhood,
        city: row.city,
        details: row.details,
        isDefault: row.isDefault,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

function toPaymentMethodDomain(row: PrismaPaymentMethod): PaymentMethod {
    return {
        id: row.id,
        userId: row.userId,
        type: toPaymentMethodType(row.type),
        brand: row.brand,
        lastFour: row.lastFour,
        holderName: row.holderName,
        isDefault: row.isDefault,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

function toDomain(row: PrismaUserWithRelations): User {
    return {
        id: row.id,
        name: row.name,
        firstName: row.firstName,
        lastName: row.lastName,
        birthDate: row.birthDate,
        username: row.username,
        email: row.email,
        emailVerified: row.emailVerified,
        role: toRole(row.role),
        points: row.points,
        onboardingCompleted: row.onboardingCompleted,
        dietPreference: toDietPreference(row.dietPreference),
        spiceTolerance: toSpiceTolerance(row.spiceTolerance),
        favoriteMoment: toFavoriteMoment(row.favoriteMoment),
        addresses: (row.addresses ?? []).map(toAddressDomain),
        paymentMethods: (row.paymentMethods ?? []).map(toPaymentMethodDomain),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

const userInclude = {
    addresses: {
        orderBy: [{ isDefault: "desc" as const }, { createdAt: "desc" as const }],
    },
    paymentMethods: {
        orderBy: [{ isDefault: "desc" as const }, { createdAt: "desc" as const }],
    },
};

export class UserPgRepository implements IUserRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async findById(id: string): Promise<User | null> {
        const row = await this.prisma.user.findUnique({
            where: { id },
            include: userInclude,
        });
        return row ? toDomain(row) : null;
    }

    async findByEmail(email: string): Promise<User | null> {
        const row = await this.prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            include: userInclude,
        });
        return row ? toDomain(row) : null;
    }

    async findByUsername(username: string): Promise<User | null> {
        const row = await this.prisma.user.findUnique({
            where: { username: username.toLowerCase() },
            include: userInclude,
        });
        return row ? toDomain(row) : null;
    }

    async updateProfile(id: string, input: UpdateUserProfileInput): Promise<User> {
        const current = await this.prisma.user.findUnique({ where: { id } });
        if (!current) throw new UserNotFoundError();

        const firstName = input.firstName ?? current.firstName;
        const lastName = input.lastName ?? current.lastName;
        const normalizedUsername = input.username?.toLowerCase();

        try {
            const updated = await this.prisma.user.update({
                where: { id },
                data: {
                    firstName,
                    lastName,
                    name: `${firstName} ${lastName}`,
                    ...(input.birthDate !== undefined ? { birthDate: input.birthDate } : {}),
                    ...(normalizedUsername !== undefined
                        ? { username: normalizedUsername, displayUsername: input.username }
                        : {}),
                    ...(input.onboardingCompleted !== undefined
                        ? { onboardingCompleted: input.onboardingCompleted }
                        : {}),
                    ...(input.dietPreference !== undefined
                        ? { dietPreference: input.dietPreference }
                        : {}),
                    ...(input.spiceTolerance !== undefined
                        ? { spiceTolerance: input.spiceTolerance }
                        : {}),
                    ...(input.favoriteMoment !== undefined
                        ? { favoriteMoment: input.favoriteMoment }
                        : {}),
                },
                include: userInclude,
            });
            return toDomain(updated);
        } catch (error) {
            if (
                typeof error === "object" &&
                error !== null &&
                "code" in error &&
                (error as { code?: string }).code === "P2002"
            ) {
                throw new DuplicateUsernameError();
            }
            throw error;
        }
    }

    async addAddress(userId: string, input: CreateUserAddressInput): Promise<UserAddress> {
        const existingCount = await this.prisma.userAddress.count({ where: { userId } });
        const shouldBeDefault = input.isDefault ?? existingCount === 0;

        return this.prisma.$transaction(async (tx) => {
            if (shouldBeDefault && existingCount > 0) {
                await tx.userAddress.updateMany({
                    where: { userId },
                    data: { isDefault: false },
                });
            }

            const created = await tx.userAddress.create({
                data: {
                    userId,
                    label: input.label.trim(),
                    addressLine: input.addressLine.trim(),
                    neighborhood: input.neighborhood.trim(),
                    city: input.city?.trim() || "Medellín, Antioquia",
                    details: input.details?.trim() || null,
                    isDefault: shouldBeDefault,
                },
            });

            return toAddressDomain(created);
        });
    }

    async removeAddress(userId: string, addressId: string): Promise<void> {
        const existing = await this.prisma.userAddress.findFirst({
            where: { id: addressId, userId },
        });
        if (!existing) throw new AddressNotFoundError();

        await this.prisma.userAddress.delete({ where: { id: addressId } });
    }

    async addPaymentMethod(
        userId: string,
        input: CreatePaymentMethodInput,
    ): Promise<PaymentMethod> {
        const existingCount = await this.prisma.paymentMethod.count({ where: { userId } });
        const shouldBeDefault = input.isDefault ?? existingCount === 0;

        return this.prisma.$transaction(async (tx) => {
            if (shouldBeDefault && existingCount > 0) {
                await tx.paymentMethod.updateMany({
                    where: { userId },
                    data: { isDefault: false },
                });
            }

            const created = await tx.paymentMethod.create({
                data: {
                    userId,
                    type: input.type,
                    brand: input.brand.trim(),
                    lastFour: input.lastFour?.trim() || null,
                    holderName: input.holderName?.trim() || null,
                    isDefault: shouldBeDefault,
                },
            });

            return toPaymentMethodDomain(created);
        });
    }

    async removePaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
        const existing = await this.prisma.paymentMethod.findFirst({
            where: { id: paymentMethodId, userId },
        });
        if (!existing) throw new PaymentMethodNotFoundError();

        await this.prisma.paymentMethod.delete({ where: { id: paymentMethodId } });
    }

    async saveOnboarding(userId: string, input: CompleteOnboardingInput): Promise<User> {
        const current = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!current) throw new UserNotFoundError();

        return this.prisma.$transaction(async (tx) => {
            if (input.address) {
                const count = await tx.userAddress.count({ where: { userId } });
                await tx.userAddress.create({
                    data: {
                        userId,
                        label: input.address.label.trim(),
                        addressLine: input.address.addressLine.trim(),
                        neighborhood: input.address.neighborhood.trim(),
                        city: input.address.city?.trim() || "Medellín, Antioquia",
                        details: input.address.details?.trim() || null,
                        isDefault: count === 0,
                    },
                });
            }

            if (input.paymentMethod) {
                const count = await tx.paymentMethod.count({ where: { userId } });
                await tx.paymentMethod.create({
                    data: {
                        userId,
                        type: input.paymentMethod.type,
                        brand: input.paymentMethod.brand.trim(),
                        lastFour: input.paymentMethod.lastFour?.trim() || null,
                        holderName: input.paymentMethod.holderName?.trim() || null,
                        isDefault: count === 0,
                    },
                });
            }

            const updated = await tx.user.update({
                where: { id: userId },
                data: {
                    onboardingCompleted: true,
                    ...(input.dietPreference !== undefined
                        ? { dietPreference: input.dietPreference }
                        : {}),
                    ...(input.spiceTolerance !== undefined
                        ? { spiceTolerance: input.spiceTolerance }
                        : {}),
                    ...(input.favoriteMoment !== undefined
                        ? { favoriteMoment: input.favoriteMoment }
                        : {}),
                },
                include: userInclude,
            });

            return toDomain(updated);
        });
    }
}
