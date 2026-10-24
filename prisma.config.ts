import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: {
        path: "prisma/migrations",
        seed: "tsx prisma/seed.ts",
    },
    datasource: {
        url:
            process.env.DIRECT_URL ??
            process.env.DATABASE_URL ??
            "postgresql://placeholder:placeholder@ep-placeholder.us-east-2.aws.neon.tech/neondb?sslmode=require",
    },
});
