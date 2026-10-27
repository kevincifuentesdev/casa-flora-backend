import "dotenv/config";
import { z } from "zod";

const origin = z.url().transform((value) => new URL(value).origin);

const envSchema = z
    .object({
        NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
        PORT: z.coerce.number().int().min(1).max(65535).default(4000),

        DATABASE_URL: z
            .string()
            .regex(/^postgres(ql)?:\/\//, "must be a PostgreSQL connection string"),
        DIRECT_URL: z
            .string()
            .regex(/^postgres(ql)?:\/\//, "must be a PostgreSQL connection string")
            .optional(),

        BETTER_AUTH_URL: z.url().default("http://localhost:4000"),
        BETTER_AUTH_SECRET: z
            .string()
            .min(32, "must be at least 32 characters (try: openssl rand -base64 48)"),

        PAYMENT_SECRET: z
            .string()
            .trim()
            .regex(
                /^(APP_USR-|TEST-)[A-Za-z0-9-]+$/,
                "must be a valid Mercado Pago access token",
            )
            .default(
                "APP_USR-0000000000000000-000000-00000000000000000000000000000000-0000000000",
            ),
        PAYMENT_TEST_USER_ID: z
            .string()
            .trim()
            .regex(/^\d+$/)
            .optional(),
        PAYMENT_TEST_USER: z.string().trim().min(3).optional(),
        PAYMENT_TEST_PSW: z.string().trim().min(4).optional(),
        PAYMENT_TEST_CODE: z.string().trim().min(1).optional(),

        CORS_ORIGINS: z
            .string()
            .default("http://localhost:3000")
            .transform((value) =>
                value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
            )
            .pipe(z.array(origin).min(1)),

        TRUST_PROXY: z
            .enum(["true", "false"])
            .default("false")
            .transform((value) => value === "true"),

        COOKIE_DOMAIN: z.string().min(1).optional(),

        JWT_AUDIENCE: z.string().min(1).default("casa-flora"),
        JWT_EXPIRES_IN: z.string().min(2).default("15m"),

        AWS_ENDPOINT_URL_S3: z.url().optional(),
        AWS_ACCESS_KEY_ID: z.string().min(1).optional(),
        AWS_SECRET_ACCESS_KEY: z.string().min(1).optional(),
        AWS_REGION: z.string().min(1).default("us-east-1"),
        S3_BUCKET: z.string().min(1).default("casa-flora"),

        INTERIOR_CAPACITY: z.coerce.number().int().min(1).max(500).default(40),
        PATIO_CAPACITY: z.coerce.number().int().min(1).max(500).default(24),
    })
    .superRefine((env, ctx) => {
        if (env.NODE_ENV === "production" && /change[-_ ]?me/i.test(env.BETTER_AUTH_SECRET)) {
            ctx.addIssue({
                code: "custom",
                path: ["BETTER_AUTH_SECRET"],
                message: "must not use the example placeholder in production",
            });
        }
        if (
            env.NODE_ENV !== "test" &&
            env.PAYMENT_SECRET.startsWith("APP_USR-00000000")
        ) {
            ctx.addIssue({
                code: "custom",
                path: ["PAYMENT_SECRET"],
                message: "PAYMENT_SECRET must be configured with a real Mercado Pago token",
            });
        }
    });

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
    constructor(public readonly issues: string[]) {
        super(`Invalid environment configuration:\n - ${issues.join("\n - ")}`);
        this.name = "EnvValidationError";
    }
}

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
    const result = envSchema.safeParse(source);

    if (!result.success) {
        throw new EnvValidationError(
            result.error.issues.map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`),
        );
    }

    return result.data;
}
