import express, { type Express } from "express";

import { BookingUseCase } from "./application/booking.use-case.js";
import { ProductUseCase } from "./application/product.use-case.js";
import { UserUseCase } from "./application/user.use-case.js";
import type { IBookingRepository } from "./domain/repository/IBooking.repository.js";
import type { IProductRepository } from "./domain/repository/IProduct.repository.js";
import type { IUserRepository } from "./domain/repository/IUser.repository.js";
import { AUTH_BASE_PATH, type AuthService } from "./infrastructure/services/auth.service.js";
import type { Env } from "./infrastructure/services/env.service.js";
import { LoggerService } from "./infrastructure/services/logger.service.js";
import { BookingController } from "./interface/controllers/booking.controller.js";
import { ProductController } from "./interface/controllers/product.controller.js";
import { UserController } from "./interface/controllers/user.controller.js";
import { AuthMiddleware } from "./interface/middlewares/auth.middleware.js";
import {
    createErrorMiddleware,
    notFoundMiddleware,
} from "./interface/middlewares/error.middleware.js";
import { createSecurityMiddlewares } from "./interface/middlewares/security.middleware.js";
import { createAuthRouter } from "./interface/routers/auth.router.js";
import { createApiRouter } from "./interface/routers/index.router.js";

export interface AppDependencies {
    env: Env;
    authService: AuthService;
    userRepository: IUserRepository;
    productRepository: IProductRepository;
    bookingRepository: IBookingRepository;
    logger?: LoggerService;
}

export function createApp(deps: AppDependencies): Express {
    const app = express();
    const logger = deps.logger ?? new LoggerService(deps.env.NODE_ENV === "test");

    app.disable("x-powered-by");
    if (deps.env.TRUST_PROXY) {
        app.set("trust proxy", 1);
    }

    const security = createSecurityMiddlewares(deps.env);

    app.use(security.helmetMiddleware);
    app.use(security.corsMiddleware);
    app.use(security.clientIpMiddleware);
    app.use(security.apiRateLimiter);

    app.use(AUTH_BASE_PATH, createAuthRouter(deps.authService));

    app.use(express.json({ limit: "32kb" }));
    app.use(express.urlencoded({ extended: false, limit: "32kb" }));

    const userUseCase = new UserUseCase(deps.userRepository);
    const productUseCase = new ProductUseCase(deps.productRepository);
    const bookingUseCase = new BookingUseCase(deps.bookingRepository, {
        interior: deps.env.INTERIOR_CAPACITY,
        patio: deps.env.PATIO_CAPACITY,
    });

    const userController = new UserController(userUseCase);
    const productController = new ProductController(productUseCase);
    const bookingController = new BookingController(bookingUseCase);
    const authMiddleware = new AuthMiddleware(deps.authService, deps.userRepository);

    app.use(
        "/api",
        createApiRouter({
            userController,
            productController,
            bookingController,
            authMiddleware,
            writeRateLimiter: security.writeRateLimiter,
        }),
    );

    app.use(notFoundMiddleware);
    app.use(createErrorMiddleware(logger));

    return app;
}

