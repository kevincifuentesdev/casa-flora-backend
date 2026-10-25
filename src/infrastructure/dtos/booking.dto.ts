import { z } from "zod";

import {
    BOOKING_ENVIRONMENTS,
    BOOKING_FIELD_MESSAGES,
    BOOKING_TIME_SLOTS,
    type Booking,
    type BookingStatus,
    type BookingTimeSlot,
    type EnvironmentId,
    type SlotAvailability,
    isValidDiners,
    isValidEnvironment,
    isValidTimeSlot,
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

export interface BookingResponseDto {
    id: string;
    userId: string;
    environment: EnvironmentId;
    date: string;
    time: BookingTimeSlot;
    diners: number;
    status: BookingStatus;
    createdAt: string;
    updatedAt: string;
}

export interface BookingAvailabilityResponseDto {
    date: string;
    environment: EnvironmentId;
    slots: SlotAvailability[];
     validTimeSlots: readonly BookingTimeSlot[];
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
        createdAt: booking.createdAt.toISOString(),
        updatedAt: booking.updatedAt.toISOString(),
    };
}

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

