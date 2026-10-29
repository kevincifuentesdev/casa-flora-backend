import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/client.js";

export type { PrismaClient } from "./generated/client.js";

export function createPrismaClient(connectionString: string): PrismaClient {
    const adapter = new PrismaPg({
        connectionString,
        connectionTimeoutMillis: 30000,
        idleTimeoutMillis: 30000,
        query_timeout: 45000,
        statement_timeout: 45000,
        keepAlive: true,
    });

    return new PrismaClient({ adapter });
}
