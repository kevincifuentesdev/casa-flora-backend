import { ValidationError } from "./errors/app.error.js";
import { ForbiddenError } from "./errors/auth.error.js";
import {
    BookingAlreadyCancelledError,
    BookingNotFoundError,
} from "./errors/booking.error.js";
import {
    BOOKING_FIELD_MESSAGES,
    BOOKING_TIME_SLOTS,
    type Booking,
    type BookingField,
    type BookingTimeSlot,
    type EnvironmentId,
    type SlotAvailability,
    isValidDiners,
    isValidEnvironment,
    isValidTimeSlot,
    validateBookingDate,
} from "../domain/models/booking.js";
import type { UserRole } from "../domain/models/user.js";
import type {
    AdminBookingFilters,
    IBookingRepository,
    UpdateBookingAdminInput,
} from "../domain/repository/IBooking.repository.js";

export interface BookingCapacityConfig {
    interior: number;
    patio: number;
}

export interface CreateBookingCommand {
    userId: string;
    environment: unknown;
    date: unknown;
    time: unknown;
    diners: unknown;
}

export class BookingUseCase {
    constructor(
        private readonly bookingRepository: IBookingRepository,
        private readonly capacities: BookingCapacityConfig,
    ) {}

    private getCapacity(environment: EnvironmentId): number {
        return environment === "interior" ? this.capacities.interior : this.capacities.patio;
    }

    async createBooking(command: CreateBookingCommand): Promise<Booking> {
        const errors: Partial<Record<BookingField, string>> = {};

        if (!isValidEnvironment(command.environment)) {
            errors.environment = BOOKING_FIELD_MESSAGES.environment;
        }

        const dateResult = validateBookingDate(command.date);
        if ("error" in dateResult) {
            errors.date = dateResult.error;
        }

        if (!isValidTimeSlot(command.time)) {
            errors.time = BOOKING_FIELD_MESSAGES.time;
        }

        if (!isValidDiners(command.diners)) {
            errors.diners = BOOKING_FIELD_MESSAGES.diners;
        }

        if (Object.keys(errors).length > 0) {
            const firstMessage =
                errors.environment ??
                errors.date ??
                errors.time ??
                errors.diners ??
                "Datos de reserva inválidos.";
            throw new ValidationError(firstMessage, errors as Record<string, string>);
        }

        const environment = command.environment as EnvironmentId;
        const date = (dateResult as { date: string }).date;
        const time = command.time as BookingTimeSlot;
        const diners = command.diners as number;
        const capacity = this.getCapacity(environment);

        return this.bookingRepository.createConfirmedWithinCapacity({
            userId: command.userId,
            environment,
            date,
            time,
            diners,
            capacity,
        });
    }

    async listUserBookings(userId: string): Promise<Booking[]> {
        return this.bookingRepository.findByUserId(userId);
    }

    async listAllBookingsForAdmin(
        filters: AdminBookingFilters = {},
    ): Promise<Booking[]> {
        return this.bookingRepository.findAllForAdmin(filters);
    }

    async updateBookingByAdmin(
        bookingId: string,
        input: UpdateBookingAdminInput,
    ): Promise<Booking> {
        const existing = await this.bookingRepository.findById(bookingId);
        if (!existing) {
            throw new BookingNotFoundError();
        }
        return this.bookingRepository.updateByAdmin(bookingId, input);
    }

    async getBookingById(
        bookingId: string,
        requesterId: string,
        requesterRole: UserRole = "customer",
    ): Promise<Booking> {
        const booking = await this.bookingRepository.findById(bookingId);
        if (!booking) throw new BookingNotFoundError();

        if (booking.userId !== requesterId && requesterRole !== "admin") {
            throw new ForbiddenError("No tienes permiso para consultar esta reserva.");
        }

        return booking;
    }

    async cancelBooking(
        bookingId: string,
        requesterId: string,
        requesterRole: UserRole = "customer",
    ): Promise<Booking> {
        const booking = await this.getBookingById(bookingId, requesterId, requesterRole);

        if (booking.status === "cancelled") {
            throw new BookingAlreadyCancelledError();
        }

        return this.bookingRepository.updateStatus(booking.id, "cancelled");
    }

    async getAvailability(
        rawDate: unknown,
        rawEnvironment: unknown,
    ): Promise<{ date: string; environment: EnvironmentId; slots: SlotAvailability[] }> {
        if (!isValidEnvironment(rawEnvironment)) {
            throw new ValidationError(BOOKING_FIELD_MESSAGES.environment, {
                environment: BOOKING_FIELD_MESSAGES.environment,
            });
        }

        const dateResult = validateBookingDate(rawDate);
        if ("error" in dateResult) {
            throw new ValidationError(dateResult.error, { date: dateResult.error });
        }

        const environment = rawEnvironment;
        const date = dateResult.date;
        const capacity = this.getCapacity(environment);
        const reservedBySlot =
            await this.bookingRepository.countConfirmedDinersByDateAndEnvironment(
                date,
                environment,
            );

        const slots: SlotAvailability[] = BOOKING_TIME_SLOTS.map((time) => {
            const reservedDiners = reservedBySlot[time] ?? 0;
            const remainingDiners = Math.max(0, capacity - reservedDiners);
            return {
                time,
                capacity,
                reservedDiners,
                remainingDiners,
                available: remainingDiners > 0,
            };
        });

        return { date, environment, slots };
    }
}

