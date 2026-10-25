import "dotenv/config";

import { INITIAL_PRODUCTS } from "../src/domain/models/product.js";
import { createPrismaClient } from "../src/infrastructure/repository/client.js";

async function seed(): Promise<void> {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error("DATABASE_URL is required to run the database seed.");
    }

    const prisma = createPrismaClient(connectionString);

    try {
        for (const item of INITIAL_PRODUCTS) {
            await prisma.product.upsert({
                where: { id: item.id },
                update: {
                    name: item.name,
                    price: item.price,
                    categories: [...item.categories],
                    description: item.description,
                    imageUrl: item.imageUrl,
                    sortOrder: item.sortOrder,
                    available: true,
                },
                create: {
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    categories: [...item.categories],
                    description: item.description,
                    imageUrl: item.imageUrl,
                    sortOrder: item.sortOrder,
                    available: true,
                },
            });
        }
        console.info(`Seeded ${INITIAL_PRODUCTS.length} Casa Flora menu products.`);
    } finally {
        await prisma.$disconnect();
    }
}

seed().catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exit(1);
});

