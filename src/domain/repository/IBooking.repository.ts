import type {
    Booking,
    BookingStatus,
    BookingTimeSlot,
    EnvironmentId,
} from "../models/booking.js";

export interface CreateBookingInput {
    userId: string;
    environment: EnvironmentId;
    date: string;
    time: BookingTimeSlot;
    diners: number;
}

export interface ReserveBookingAtomicInput extends CreateBookingInput {
    capacity: number;
}

export interface IBookingRepository {
    create(input: CreateBookingInput): Promise<Booking>;
    createConfirmedWithinCapacity(input: ReserveBookingAtomicInput): Promise<Booking>;
    findById(id: string): Promise<Booking | null>;
    findByUserId(userId: string): Promise<Booking[]>;
    findActiveByUserSlot(
        userId: string,
        date: string,
        time: BookingTimeSlot,
    ): Promise<Booking | null>;
    countConfirmedDiners(
        date: string,
        time: BookingTimeSlot,
        environment: EnvironmentId,
    ): Promise<number>;
    countConfirmedDinersByDateAndEnvironment(
        date: string,
        environment: EnvironmentId,
    ): Promise<Record<BookingTimeSlot, number>>;
    updateStatus(id: string, status: BookingStatus): Promise<Booking>;
}

