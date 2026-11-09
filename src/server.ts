import { createApp } from "./app.js";
import { BookingPgRepository } from "./infrastructure/repository/booking.pg.repository.js";
import { createPrismaClient } from "./infrastructure/repository/client.js";
import { OrderPgRepository } from "./infrastructure/repository/order.pg.repository.js";
import { ProductPgRepository } from "./infrastructure/repository/product.pg.repository.js";
import { UserPgRepository } from "./infrastructure/repository/user.pg.repository.js";
import { AuthService, createAuth } from "./infrastructure/services/auth.service.js";
import { parseEnv } from "./infrastructure/services/env.service.js";
import { LoggerService } from "./infrastructure/services/logger.service.js";

async function bootstrap(): Promise<void> {
    const env = parseEnv();
    const logger = new LoggerService(false, {
        application: env.APPLICATION_NAME,
        logstashHost: env.LOGSTASH_HOST,
        logstashPort: env.LOGSTASH_PORT,
    });
    const prisma = createPrismaClient(env.DATABASE_URL);
    const auth = createAuth(prisma, env);
    const authService = new AuthService(auth, prisma);

    const userRepository = new UserPgRepository(prisma);
    const productRepository = new ProductPgRepository(prisma);
    const bookingRepository = new BookingPgRepository(prisma);
    const orderRepository = new OrderPgRepository(prisma);

    const app = createApp({
        env,
        authService,
        userRepository,
        productRepository,
        bookingRepository,
        orderRepository,
        logger,
    });

    const server = app.listen(env.PORT, () => {
        logger.info("Casa Flora API listening", {
            port: env.PORT,
            environment: env.NODE_ENV,
        });
    });

    const shutdown = (signal: string) => {
        logger.info("Shutting down server", { signal });
        server.close(async () => {
            await prisma.$disconnect();
            process.exit(0);
        });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
}

bootstrap().catch((error: unknown) => {
    const logger = new LoggerService(false);
    logger.error("Failed to start server", {
        error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
});
