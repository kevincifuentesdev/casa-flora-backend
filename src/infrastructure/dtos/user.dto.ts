import { z } from "zod";

import {
    type User,
    type UserRole,
    isValidUsername,
    normalizePersonName,
    validateBirthDate,
    validatePersonName,
} from "../../domain/models/user.js";

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
    })
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
        message: "Debes proporcionar al menos un campo para actualizar.",
    });

export type UpdateUserProfileDto = z.infer<typeof updateUserProfileDtoSchema>;

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
    createdAt: string;
    updatedAt: string;
}

export function toUserResponseDto(user: User): UserResponseDto {
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
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
    };
}
