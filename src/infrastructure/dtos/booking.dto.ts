import { z } from "zod";

import {
    BOOKING_ADMIN_SORT_OPTIONS,
    BOOKING_ENVIRONMENTS,
    BOOKING_FIELD_MESSAGES,
    BOOKING_STATUSES,
    BOOKING_TIME_SLOTS,
    MAX_DINERS,
    MIN_DINERS,
    type Booking,
    type BookingAdminSortOption,
    type BookingCustomerSummary,
    type BookingStatus,
    type BookingTimeSlot,
    type EnvironmentId,
    type SlotAvailability,
    isValidDiners,
    isValidEnvironment,
    isValidTimeSlot,
    normalizeBookingDate,
    validateBookingDate,
} from "../../domain/models/booking.js";

export const createBookingDtoSchema = z.object({
    environment: z
        .unknown()
        .refine(isValidEnvironment, { message: BOOKING_FIELD_MESSAGES.environment }),
    date: z
        .unknown()
        .superRefine((val, ctx) => {
            const result = validateBookingDate(val);
            if ("error" in result) {
                ctx.addIssue({ code: "custom", message: result.error });
            }
        })
        .transform((val) => {
            const result = validateBookingDate(val);
            return "date" in result ? result.date : "";
        }),
    time: z.unknown().refine(isValidTimeSlot, { message: BOOKING_FIELD_MESSAGES.time }),
    diners: z.unknown().refine(isValidDiners, { message: BOOKING_FIELD_MESSAGES.diners }),
});

export type CreateBookingDto = z.infer<typeof createBookingDtoSchema>;

export const bookingAvailabilityQueryDtoSchema = z.object({
    environment: z.enum(BOOKING_ENVIRONMENTS, {
        error: () => BOOKING_FIELD_MESSAGES.environment,
    }),
    date: z
        .string({ error: () => BOOKING_FIELD_MESSAGES.date })
        .superRefine((val, ctx) => {
            const result = validateBookingDate(val);
            if ("error" in result) {
                ctx.addIssue({ code: "custom", message: result.error });
            }
        })
        .transform((val) => {
            const result = validateBookingDate(val);
            return "date" in result ? result.date : "";
        }),
});

export type BookingAvailabilityQueryDto = z.infer<typeof bookingAvailabilityQueryDtoSchema>;

export const bookingIdParamDtoSchema = z.object({
    id: z.string().trim().min(1).max(64),
});

const optionalIsoDateSchema = z
    .string()
    .trim()
    .optional()
    .transform((val) => {
        if (!val) return undefined;
        return normalizeBookingDate(val) ?? undefined;
    });

export const adminBookingQueryDtoSchema = z.object({
    date: optionalIsoDateSchema,
    dateFrom: optionalIsoDateSchema,
    dateTo: optionalIsoDateSchema,
    environment: z.enum(BOOKING_ENVIRONMENTS).optional(),
    status: z.enum(BOOKING_STATUSES).optional(),
    search: z.string().trim().max(120).optional(),
    sort: z.enum(BOOKING_ADMIN_SORT_OPTIONS).default("earliest"),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const userBookingQueryDtoSchema = z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type AdminBookingQueryDto = z.infer<typeof adminBookingQueryDtoSchema>;
export type UserBookingQueryDto = z.infer<typeof userBookingQueryDtoSchema>;

export const updateBookingAdminDtoSchema = z
    .object({
        environment: z.enum(BOOKING_ENVIRONMENTS).optional(),
        date: z
            .string()
            .trim()
            .refine((val) => normalizeBookingDate(val) !== null, {
                message: BOOKING_FIELD_MESSAGES.date,
            })
            .transform((val) => normalizeBookingDate(val) ?? val)
            .optional(),
        time: z.enum(BOOKING_TIME_SLOTS).optional(),
        diners: z.number().int().min(MIN_DINERS).max(MAX_DINERS).optional(),
        status: z.enum(BOOKING_STATUSES).optional(),
    })
    .refine(
        (data) => Object.values(data).some((value) => value !== undefined),
        {
            message:
                "Debes proporcionar al menos un campo para actualizar la reserva.",
        },
    );

export type UpdateBookingAdminDto = z.infer<typeof updateBookingAdminDtoSchema>;

export interface BookingCustomerSummaryDto {
    id: string;
    name: string;
    firstName: string;
    lastName: string;
    email: string;
    username: string | null;
    points: number;
    dietPreference: string | null;
    spiceTolerance: string | null;
    favoriteMoment: string | null;
}

export interface BookingResponseDto {
    id: string;
    userId: string;
    environment: EnvironmentId;
    date: string;
    time: BookingTimeSlot;
    diners: number;
    status: BookingStatus;
    customer?: BookingCustomerSummaryDto;
    createdAt: string;
    updatedAt: string;
}

export interface BookingAvailabilityResponseDto {
    date: string;
    environment: EnvironmentId;
    slots: SlotAvailability[];
    validTimeSlots: readonly BookingTimeSlot[];
}

function toBookingCustomerSummaryDto(
    customer: BookingCustomerSummary,
): BookingCustomerSummaryDto {
    return {
        id: customer.id,
        name: customer.name,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        username: customer.username,
        points: customer.points,
        dietPreference: customer.dietPreference,
        spiceTolerance: customer.spiceTolerance,
        favoriteMoment: customer.favoriteMoment,
    };
}

export function toBookingResponseDto(booking: Booking): BookingResponseDto {
    return {
        id: booking.id,
        userId: booking.userId,
        environment: booking.environment,
        date: booking.date,
        time: booking.time,
        diners: booking.diners,
        status: booking.status,
        ...(booking.customer
            ? { customer: toBookingCustomerSummaryDto(booking.customer) }
            : {}),
        createdAt: booking.createdAt.toISOString(),
        updatedAt: booking.updatedAt.toISOString(),
    };
}

export type { BookingAdminSortOption };

export function toBookingAvailabilityResponseDto(
    date: string,
    environment: EnvironmentId,
    slots: SlotAvailability[],
): BookingAvailabilityResponseDto {
    return {
        date,
        environment,
        slots,
        validTimeSlots: BOOKING_TIME_SLOTS,
    };
}

