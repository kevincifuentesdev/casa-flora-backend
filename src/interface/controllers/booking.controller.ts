import type { Request, RequestHandler, Response } from "express";

import type { BookingUseCase } from "../../application/booking.use-case.js";
import {
    type BookingAvailabilityQueryDto,
    type CreateBookingDto,
    toBookingAvailabilityResponseDto,
    toBookingResponseDto,
} from "../../infrastructure/dtos/booking.dto.js";
import { getAuthenticatedUser } from "../middlewares/auth.middleware.js";

export class BookingController {
    constructor(private readonly bookingUseCase: BookingUseCase) {}

    readonly getAvailability: RequestHandler = async (req: Request, res: Response, next) => {
        try {
            const query = (res.locals.validatedQuery ?? req.query) as BookingAvailabilityQueryDto;
            const result = await this.bookingUseCase.getAvailability(
                query.date,
                query.environment,
            );
            res.status(200).json({
                data: toBookingAvailabilityResponseDto(
                    result.date,
                    result.environment,
                    result.slots,
                ),
            });
        } catch (error) {
            next(error);
        }
    };

    readonly createBooking: RequestHandler = async (req: Request, res: Response, next) => {
        try {
            const user = getAuthenticatedUser(res);
            const body = (res.locals.validatedBody ?? req.body) as CreateBookingDto;
            const booking = await this.bookingUseCase.createBooking({
                userId: user.id,
                environment: body.environment,
                date: body.date,
                time: body.time,
                diners: body.diners,
            });
            res.status(201).json({ data: toBookingResponseDto(booking) });
        } catch (error) {
            next(error);
        }
    };

    readonly listMyBookings: RequestHandler = async (_req: Request, res: Response, next) => {
        try {
            const user = getAuthenticatedUser(res);
            const bookings = await this.bookingUseCase.listUserBookings(user.id);
            res.status(200).json({ data: bookings.map(toBookingResponseDto) });
        } catch (error) {
            next(error);
        }
    };

    readonly getBookingById: RequestHandler = async (req: Request, res: Response, next) => {
        try {
            const user = getAuthenticatedUser(res);
            const { id } = (res.locals.validatedParams ?? req.params) as { id: string };
            const booking = await this.bookingUseCase.getBookingById(id, user.id, user.role);
            res.status(200).json({ data: toBookingResponseDto(booking) });
        } catch (error) {
            next(error);
        }
    };

    readonly cancelBooking: RequestHandler = async (req: Request, res: Response, next) => {
        try {
            const user = getAuthenticatedUser(res);
            const { id } = (res.locals.validatedParams ?? req.params) as { id: string };
            const cancelled = await this.bookingUseCase.cancelBooking(id, user.id, user.role);
            res.status(200).json({ data: toBookingResponseDto(cancelled) });
        } catch (error) {
            next(error);
        }
    };
}

