import { Router, type RequestHandler } from "express";

import type { BookingController } from "../controllers/booking.controller.js";
import type { OrderController } from "../controllers/order.controller.js";
import type { ProductController } from "../controllers/product.controller.js";
import type { UserController } from "../controllers/user.controller.js";
import type { AuthMiddleware } from "../middlewares/auth.middleware.js";
import { createBookingRouter } from "./booking.router.js";
import { createOrderRouter } from "./order.router.js";
import { createProductRouter } from "./product.router.js";
import { createUserRouter } from "./user.router.js";

export interface ApiRouterDependencies {
    userController: UserController;
    productController: ProductController;
    bookingController: BookingController;
    orderController?: OrderController;
    authMiddleware: AuthMiddleware;
    writeRateLimiter: RequestHandler;
}

export function createApiRouter(deps: ApiRouterDependencies): Router {
    const router = Router();

    router.get("/health", (_req, res) => {
        res.status(200).json({
            status: "ok",
            service: "casa-flora-backend",
            timestamp: new Date().toISOString(),
        });
    });

    router.use(
        "/users",
        createUserRouter(deps.userController, deps.authMiddleware, deps.writeRateLimiter),
    );
    router.use(
        "/products",
        createProductRouter(deps.productController, deps.authMiddleware, deps.writeRateLimiter),
    );
    router.use(
        "/bookings",
        createBookingRouter(deps.bookingController, deps.authMiddleware, deps.writeRateLimiter),
    );
    if (deps.orderController) {
        router.use(
            "/orders",
            createOrderRouter(deps.orderController, deps.authMiddleware, deps.writeRateLimiter),
        );
    }

    return router;
}
