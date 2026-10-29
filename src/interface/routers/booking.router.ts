import { Router, type RequestHandler } from "express";

import {
    adminBookingQueryDtoSchema,
    bookingAvailabilityQueryDtoSchema,
    bookingIdParamDtoSchema,
    createBookingDtoSchema,
    updateBookingAdminDtoSchema,
} from "../../infrastructure/dtos/booking.dto.js";
import type { BookingController } from "../controllers/booking.controller.js";
import type { AuthMiddleware } from "../middlewares/auth.middleware.js";
import {
    validateBody,
    validateParams,
    validateQuery,
} from "../middlewares/validate.middleware.js";

export function createBookingRouter(
    bookingController: BookingController,
    authMiddleware: AuthMiddleware,
    writeRateLimiter: RequestHandler,
): Router {
    const router = Router();

    router.get(
        "/availability",
        validateQuery(bookingAvailabilityQueryDtoSchema),
        bookingController.getAvailability,
    );

    router.get("/me", authMiddleware.requireAuth, bookingController.listMyBookings);

    router.get(
        "/admin",
        authMiddleware.requireAdmin,
        validateQuery(adminBookingQueryDtoSchema),
        bookingController.listAllAdmin,
    );

    router.post(
        "/",
        writeRateLimiter,
        authMiddleware.requireAuth,
        validateBody(createBookingDtoSchema),
        bookingController.createBooking,
    );

    router.get(
        "/:id",
        authMiddleware.requireAuth,
        validateParams(bookingIdParamDtoSchema),
        bookingController.getBookingById,
    );

    router.patch(
        "/:id",
        writeRateLimiter,
        authMiddleware.requireAdmin,
        validateParams(bookingIdParamDtoSchema),
        validateBody(updateBookingAdminDtoSchema),
        bookingController.updateBookingAdmin,
    );

    router.patch(
        "/:id/cancel",
        writeRateLimiter,
        authMiddleware.requireAuth,
        validateParams(bookingIdParamDtoSchema),
        bookingController.cancelBooking,
    );

    return router;
}

