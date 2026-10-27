import express, { type Express, type Request, type Response } from "express";

import { BookingUseCase } from "./application/booking.use-case.js";
import { OrderUseCase } from "./application/order.use-case.js";
import { ProductUseCase } from "./application/product.use-case.js";
import { UserUseCase } from "./application/user.use-case.js";
import type { IBookingRepository } from "./domain/repository/IBooking.repository.js";
import type { IOrderRepository } from "./domain/repository/IOrder.repository.js";
import type { IProductRepository } from "./domain/repository/IProduct.repository.js";
import type { IUserRepository } from "./domain/repository/IUser.repository.js";
import { BookingPgRepository } from "./infrastructure/repository/booking.pg.repository.js";
import { createPrismaClient } from "./infrastructure/repository/client.js";
import { OrderPgRepository } from "./infrastructure/repository/order.pg.repository.js";
import { ProductPgRepository } from "./infrastructure/repository/product.pg.repository.js";
import { UserPgRepository } from "./infrastructure/repository/user.pg.repository.js";
import { AUTH_BASE_PATH, AuthService, createAuth } from "./infrastructure/services/auth.service.js";
import { type Env, parseEnv } from "./infrastructure/services/env.service.js";
import {
    type IStorageService,
    S3StorageService,
} from "./infrastructure/services/storage.service.js";
import { LoggerService } from "./infrastructure/services/logger.service.js";
import {
    type IPaymentGateway,
    MercadoPagoGateway,
} from "./infrastructure/services/payment.service.js";
import { BookingController } from "./interface/controllers/booking.controller.js";
import { OrderController } from "./interface/controllers/order.controller.js";
import { ProductController } from "./interface/controllers/product.controller.js";
import { UploadController } from "./interface/controllers/upload.controller.js";
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
    orderRepository?: IOrderRepository;
    paymentGateway?: IPaymentGateway;
    storageService?: IStorageService;
    logger?: LoggerService;
}

export function normalizeApiPath(req: Request): void {
    const rawPath = req.url.split("?")[0];
    if (rawPath && rawPath !== "/" && !rawPath.startsWith("/api")) {
        const queryIndex = req.url.indexOf("?");
        const query = queryIndex !== -1 ? req.url.slice(queryIndex) : "";
        req.url = `/api${rawPath.startsWith("/") ? "" : "/"}${rawPath}${query}`;
    }
}

export function createApp(deps: AppDependencies): Express {
    const app = express();
    const logger = deps.logger ?? new LoggerService(deps.env.NODE_ENV === "test");

    app.disable("x-powered-by");
    if (deps.env.TRUST_PROXY || process.env.VERCEL === "1" || deps.env.NODE_ENV === "production") {
        app.set("trust proxy", 1);
    }

    app.use((req, _res, next) => {
        normalizeApiPath(req as Request);
        next();
    });

    const security = createSecurityMiddlewares(deps.env);

    app.use(security.helmetMiddleware);
    app.use(security.corsMiddleware);
    app.use(security.clientIpMiddleware);
    app.use(security.apiRateLimiter);

    app.get("/", (_req, res) => {
        res.status(200).json({
            service: "casa-flora-backend",
            status: "running",
            version: "0.1.0",
        });
    });

    app.use(AUTH_BASE_PATH, createAuthRouter(deps.authService));

    app.use(express.json({ limit: "32kb" }));
    app.use(express.urlencoded({ extended: false, limit: "32kb" }));

    const paymentGateway = deps.paymentGateway ?? new MercadoPagoGateway(deps.env);
    const userUseCase = new UserUseCase(
        deps.userRepository,
        deps.productRepository,
        deps.orderRepository,
        paymentGateway,
    );
    const productUseCase = new ProductUseCase(deps.productRepository);
    const bookingUseCase = new BookingUseCase(deps.bookingRepository, {
        interior: deps.env.INTERIOR_CAPACITY,
        patio: deps.env.PATIO_CAPACITY,
    });
    const orderUseCase = deps.orderRepository
        ? new OrderUseCase(
              deps.orderRepository,
              deps.productRepository,
              deps.userRepository,
              paymentGateway,
          )
        : undefined;

    const userController = new UserController(userUseCase);
    const productController = new ProductController(productUseCase);
    const bookingController = new BookingController(bookingUseCase);
    const orderController = orderUseCase ? new OrderController(orderUseCase) : undefined;
    const uploadController = new UploadController(deps.storageService);
    const authMiddleware = new AuthMiddleware(deps.authService, deps.userRepository);

    app.use(
        "/api",
        createApiRouter({
            userController,
            productController,
            uploadController,
            bookingController,
            ...(orderController ? { orderController } : {}),
            authMiddleware,
            writeRateLimiter: security.writeRateLimiter,
        }),
    );

    app.use(notFoundMiddleware);
    app.use(createErrorMiddleware(logger));

    return app;
}

let cachedApp: Express | null = null;

export function getOrCreateApp(): Express {
    if (cachedApp) return cachedApp;

    const env = parseEnv();
    const prisma = createPrismaClient(env.DATABASE_URL);
    const auth = createAuth(prisma, env);
    const authService = new AuthService(auth, prisma);

    const userRepository = new UserPgRepository(prisma);
    const productRepository = new ProductPgRepository(prisma);
    const bookingRepository = new BookingPgRepository(prisma);
    const orderRepository = new OrderPgRepository(prisma);

    cachedApp = createApp({
        env,
        ...(S3StorageService.isConfigured(env)
            ? { storageService: new S3StorageService(env) }
            : {}),
        authService,
        userRepository,
        productRepository,
        bookingRepository,
        orderRepository,
    });

    return cachedApp;
}

export default function handler(req: Request, res: Response) {
    normalizeApiPath(req);
    return getOrCreateApp()(req, res);
}
