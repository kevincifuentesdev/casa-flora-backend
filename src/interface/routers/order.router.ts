import { Router, type RequestHandler } from "express";

import { createOrderDtoSchema } from "../../infrastructure/dtos/order.dto.js";
import type { OrderController } from "../controllers/order.controller.js";
import type { AuthMiddleware } from "../middlewares/auth.middleware.js";
import { validateBody } from "../middlewares/validate.middleware.js";

export function createOrderRouter(
    orderController: OrderController,
    authMiddleware: AuthMiddleware,
    writeRateLimiter: RequestHandler,
): Router {
    const router = Router();

    router.get("/me", authMiddleware.requireAuth, orderController.listMine);
    router.post(
        "/",
        writeRateLimiter,
        authMiddleware.requireAuth,
        validateBody(createOrderDtoSchema),
        orderController.create,
    );

    return router;
}

