import { z } from "zod";

import type { UserProfileContext } from "../../application/user.use-case.js";
import {
    DIET_PREFERENCES,
    FAVORITE_MOMENTS,
    PAYMENT_METHOD_TYPES,
    SPICE_TOLERANCES,
    type DietPreference,
    type FavoriteMoment,
    type LoyaltySummary,
    type PaymentMethod,
    type PaymentMethodType,
    type SpiceTolerance,
    type User,
    type UserAddress,
    type UserRole,
    buildLoyaltySummary,
    isValidUsername,
    normalizePersonName,
    validateBirthDate,
    validatePersonName,
} from "../../domain/models/user.js";
import { type OrderResponseDto, toOrderResponseDto } from "./order.dto.js";
import { type ProductResponseDto, toProductResponseDto } from "./product.dto.js";

export const createUserAddressDtoSchema = z.object({
    label: z.string().trim().min(2, "Ingresa un nombre para la dirección.").max(40),
    addressLine: z.string().trim().min(5, "Ingresa una dirección válida.").max(160),
    neighborhood: z.string().trim().min(2, "Ingresa el barrio o sector.").max(80),
    city: z.string().trim().min(2).max(80).default("Medellín, Antioquia"),
    details: z.string().trim().max(160).optional().nullable(),
    isDefault: z.boolean().optional(),
});

export type CreateUserAddressDto = z.infer<typeof createUserAddressDtoSchema>;

export const createPaymentMethodDtoSchema = z.object({
    type: z.enum(PAYMENT_METHOD_TYPES),
    brand: z.string().trim().min(2, "Ingresa la entidad o franquicia.").max(40),
    lastFour: z
        .string()
        .trim()
        .regex(/^\d{4}$/, "Ingresa los últimos 4 dígitos.")
        .optional()
        .nullable(),
    holderName: z.string().trim().min(2).max(80).optional().nullable(),
    isDefault: z.boolean().optional(),
});

export type CreatePaymentMethodDto = z.infer<typeof createPaymentMethodDtoSchema>;

export const completeOnboardingDtoSchema = z.object({
    address: createUserAddressDtoSchema.optional(),
    paymentMethod: createPaymentMethodDtoSchema.optional(),
    dietPreference: z.enum(DIET_PREFERENCES).optional().nullable(),
    spiceTolerance: z.enum(SPICE_TOLERANCES).optional().nullable(),
    favoriteMoment: z.enum(FAVORITE_MOMENTS).optional().nullable(),
});

export type CompleteOnboardingDto = z.infer<typeof completeOnboardingDtoSchema>;

export const resourceIdParamDtoSchema = z.object({
    id: z.string().trim().min(1).max(64),
});

export const updateUserProfileDtoSchema = z
    .object({
        firstName: z
            .string()
            .transform(normalizePersonName)
            .superRefine((val, ctx) => {
                const error = validatePersonName(val, "nombres");
                if (error) ctx.addIssue({ code: "custom", message: error });
            })
            .optional(),
        lastName: z
            .string()
            .transform(normalizePersonName)
            .superRefine((val, ctx) => {
                const error = validatePersonName(val, "apellidos");
                if (error) ctx.addIssue({ code: "custom", message: error });
            })
            .optional(),
        birthDate: z
            .string()
            .trim()
            .superRefine((val, ctx) => {
                const error = validateBirthDate(val);
                if (error) ctx.addIssue({ code: "custom", message: error });
            })
            .optional(),
        username: z
            .string()
            .trim()
            .refine(
                isValidUsername,
                "Usa entre 3 y 30 caracteres: letras, números, puntos, guiones o guion bajo.",
            )
            .optional(),
        onboardingCompleted: z.boolean().optional(),
        dietPreference: z.enum(DIET_PREFERENCES).nullable().optional(),
        spiceTolerance: z.enum(SPICE_TOLERANCES).nullable().optional(),
        favoriteMoment: z.enum(FAVORITE_MOMENTS).nullable().optional(),
    })
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
        message: "Debes proporcionar al menos un campo para actualizar.",
    });

export type UpdateUserProfileDto = z.infer<typeof updateUserProfileDtoSchema>;

export interface UserAddressResponseDto {
    id: string;
    label: string;
    addressLine: string;
    neighborhood: string;
    city: string;
    details: string | null;
    isDefault: boolean;
    createdAt: string;
}

export interface PaymentMethodResponseDto {
    id: string;
    type: PaymentMethodType;
    brand: string;
    lastFour: string | null;
    holderName: string | null;
    isDefault: boolean;
    createdAt: string;
}

export interface UserResponseDto {
    id: string;
    name: string;
    firstName: string;
    lastName: string;
    birthDate: string;
    username: string | null;
    email: string;
    emailVerified: boolean;
    role: UserRole;
    points: number;
    onboardingCompleted: boolean;
    preferences: {
        dietPreference: DietPreference | null;
        spiceTolerance: SpiceTolerance | null;
        favoriteMoment: FavoriteMoment | null;
    };
    loyalty: LoyaltySummary;
    addresses: UserAddressResponseDto[];
    paymentMethods: PaymentMethodResponseDto[];
    recommendedProduct: ProductResponseDto | null;
    orders: OrderResponseDto[];
    createdAt: string;
    updatedAt: string;
}

export function toUserAddressResponseDto(address: UserAddress): UserAddressResponseDto {
    return {
        id: address.id,
        label: address.label,
        addressLine: address.addressLine,
        neighborhood: address.neighborhood,
        city: address.city,
        details: address.details,
        isDefault: address.isDefault,
        createdAt: address.createdAt.toISOString(),
    };
}

export function toPaymentMethodResponseDto(method: PaymentMethod): PaymentMethodResponseDto {
    return {
        id: method.id,
        type: method.type,
        brand: method.brand,
        lastFour: method.lastFour,
        holderName: method.holderName,
        isDefault: method.isDefault,
        createdAt: method.createdAt.toISOString(),
    };
}

export function toUserResponseDto(input: User | UserProfileContext): UserResponseDto {
    const isContext = "user" in input;
    const user = isContext ? input.user : input;
    const loyalty = isContext
        ? input.loyalty
        : buildLoyaltySummary(user.points, user.dietPreference);
    const recommendedProduct =
        isContext && input.recommendedProduct
            ? toProductResponseDto(input.recommendedProduct)
            : null;
    const orders = isContext ? input.orders.map(toOrderResponseDto) : [];

    return {
        id: user.id,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        birthDate: user.birthDate,
        username: user.username,
        email: user.email,
        emailVerified: user.emailVerified,
        role: user.role,
        points: user.points,
        onboardingCompleted: user.onboardingCompleted,
        preferences: {
            dietPreference: user.dietPreference,
            spiceTolerance: user.spiceTolerance,
            favoriteMoment: user.favoriteMoment,
        },
        loyalty,
        addresses: user.addresses.map(toUserAddressResponseDto),
        paymentMethods: user.paymentMethods.map(toPaymentMethodResponseDto),
        recommendedProduct,
        orders,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
    };
}
