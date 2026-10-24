import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/client.js";

export type { PrismaClient } from "./generated/client.js";

/**
 * Creates the single Prisma client used by the application.
 * It talks to PostgreSQL through the `pg` driver adapter.
 */
export function createPrismaClient(connectionString: string): PrismaClient {
    const adapter = new PrismaPg({ connectionString });

    return new PrismaClient({ adapter });
}
