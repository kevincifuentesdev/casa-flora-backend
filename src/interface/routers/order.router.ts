import { Router, type RequestHandler } from "express";

import {
    adminOrderQueryDtoSchema,
    createCheckoutDtoSchema,
    createOrderDtoSchema,
    orderIdParamDtoSchema,
    updateOrderStatusDtoSchema,
    verifyCheckoutPaymentDtoSchema,
} from "../../infrastructure/dtos/order.dto.js";
import type { OrderController } from "../controllers/order.controller.js";
import type { AuthMiddleware } from "../middlewares/auth.middleware.js";
import {
    validateBody,
    validateParams,
    validateQuery,
} from "../middlewares/validate.middleware.js";

export function createOrderRouter(
    orderController: OrderController,
    authMiddleware: AuthMiddleware,
    writeRateLimiter: RequestHandler,
): Router {
    const router = Router();

    router.get("/me", authMiddleware.requireAuth, orderController.listMine);
    router.get(
        "/admin",
        authMiddleware.requireAdmin,
        validateQuery(adminOrderQueryDtoSchema),
        orderController.listAllAdmin,
    );
    router.post(
        "/checkout",
        writeRateLimiter,
        authMiddleware.optionalAuth,
        validateBody(createCheckoutDtoSchema),
        orderController.checkout,
    );
    router.post(
        "/checkout/verify",
        writeRateLimiter,
        authMiddleware.optionalAuth,
        validateBody(verifyCheckoutPaymentDtoSchema),
        orderController.verifyCheckout,
    );
    router.patch(
        "/:id/status",
        writeRateLimiter,
        authMiddleware.requireAdmin,
        validateParams(orderIdParamDtoSchema),
        validateBody(updateOrderStatusDtoSchema),
        orderController.updateStatusAdmin,
    );
    router.patch(
        "/:id/cancel",
        writeRateLimiter,
        authMiddleware.requireAuth,
        orderController.cancelPending,
    );
    router.post(
        "/",
        writeRateLimiter,
        authMiddleware.requireAuth,
        validateBody(createOrderDtoSchema),
        orderController.create,
    );

    return router;
}
