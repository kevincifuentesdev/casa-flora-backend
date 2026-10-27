import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { fromNodeHeaders } from "better-auth/node";
import { jwt, username } from "better-auth/plugins";
import type { IncomingHttpHeaders } from "node:http";

import {
    PASSWORD_MAX_LENGTH,
    PASSWORD_MIN_LENGTH,
    isValidUsername,
    normalizePersonName,
    validateBirthDate,
    validatePersonName,
} from "../../domain/models/user.js";
import type { PrismaClient } from "../repository/client.js";
import type { Env } from "./env.service.js";

export const AUTH_BASE_PATH = "/api/auth";

export const CLIENT_IP_HEADER = "x-client-ip";

const DAY = 60 * 60 * 24;

function badRequest(code: string, message: string): never {
    throw new APIError("BAD_REQUEST", { code, message });
}

export function createAuth(prisma: PrismaClient, env: Env) {
    const isProduction = env.NODE_ENV === "production";

    return betterAuth({
        appName: "Casa Flora",
        baseURL: env.BETTER_AUTH_URL,
        basePath: AUTH_BASE_PATH,
        secret: env.BETTER_AUTH_SECRET,
        trustedOrigins: [
            ...env.CORS_ORIGINS,
            "https://*.vercel.app",
        ],
        database: prismaAdapter(prisma, { provider: "postgresql" }),

        emailAndPassword: {
            enabled: true,
            minPasswordLength: PASSWORD_MIN_LENGTH,
            maxPasswordLength: PASSWORD_MAX_LENGTH,
            autoSignIn: true,
            requireEmailVerification: false,
            revokeSessionsOnPasswordReset: true,
        },

        user: {
            additionalFields: {
                firstName: { type: "string", required: true, input: true },
                lastName: { type: "string", required: true, input: true },
                birthDate: { type: "string", required: true, input: true },
                role: { type: "string", required: false, defaultValue: "customer", input: false },
            },
        },

        session: {
            expiresIn: 7 * DAY,
            updateAge: DAY,
        },

        rateLimit: {
            enabled: env.NODE_ENV !== "test",
            window: 60,
            max: 100,
            customRules: {
                "/sign-in/email": { window: 60, max: 10 },
                "/sign-in/username": { window: 60, max: 10 },
                "/sign-up/email": { window: 60 * 60, max: 20 },
            },
        },

        advanced: {
            cookiePrefix: "casa-flora",
            useSecureCookies: isProduction,
            defaultCookieAttributes: {
                httpOnly: true,
                sameSite: isProduction ? "none" : "lax",
                secure: isProduction,
            },
            ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
            ...(env.COOKIE_DOMAIN
                ? { crossSubDomainCookies: { enabled: true, domain: env.COOKIE_DOMAIN } }
                : {}),
        },

        databaseHooks: {
            user: {
                create: {
                    before: async (user) => {
                        const { firstName, lastName, birthDate } = user as Record<string, unknown>;

                        if (typeof firstName !== "string" || typeof lastName !== "string") {
                            return badRequest("INVALID_NAME", "Ingresa tus nombres y apellidos.");
                        }

                        const firstNameError = validatePersonName(firstName, "nombres");
                        if (firstNameError) return badRequest("INVALID_FIRST_NAME", firstNameError);

                        const lastNameError = validatePersonName(lastName, "apellidos");
                        if (lastNameError) return badRequest("INVALID_LAST_NAME", lastNameError);

                        const birthDateError =
                            typeof birthDate === "string"
                                ? validateBirthDate(birthDate)
                                : "Selecciona tu fecha de nacimiento.";
                        if (birthDateError) return badRequest("INVALID_BIRTH_DATE", birthDateError);

                        const cleanFirstName = normalizePersonName(firstName);
                        const cleanLastName = normalizePersonName(lastName);

                        return {
                            data: {
                                ...user,
                                firstName: cleanFirstName,
                                lastName: cleanLastName,
                                name: `${cleanFirstName} ${cleanLastName}`,
                                role: "customer",
                            },
                        };
                    },
                },
            },
        },

        plugins: [
            username({
                minUsernameLength: 3,
                maxUsernameLength: 30,
                usernameValidator: isValidUsername,
            }),
            jwt({
                disableSettingJwtHeader: true,
                jwks: {
                    disablePrivateKeyEncryption: true,
                    keyPairConfig: { alg: "EdDSA", crv: "Ed25519" },
                    rotationInterval: 30 * DAY,
                    gracePeriod: 30 * DAY,
                },
                jwt: {
                    issuer: env.BETTER_AUTH_URL,
                    audience: env.JWT_AUDIENCE,
                    expirationTime: env.JWT_EXPIRES_IN,
                    definePayload: ({ user }) => ({ role: user.role, username: user.username }),
                },
            }),
        ],
    });
}

export type Auth = ReturnType<typeof createAuth>;

export class AuthService {
    constructor(
        private readonly auth: Auth,
        private readonly prisma?: PrismaClient,
    ) {}

    get handler() {
        return this.auth.handler;
    }

    async resolveUserId(headers: IncomingHttpHeaders): Promise<string | null> {
        const authorization = headers.authorization;

        if (authorization !== undefined) {
            const [scheme, token, ...rest] = authorization.split(" ");
            if (scheme?.toLowerCase() === "bearer" && token && rest.length === 0) {
                if (token.split(".").length === 3) {
                    try {
                        const result = await this.auth.api.verifyJWT({ body: { token } });
                        if (result.payload?.sub) return result.payload.sub;
                    } catch {
                        // ignore and check session table
                    }
                }

                if (this.prisma) {
                    try {
                        const sessionRecord = await this.prisma.session.findUnique({
                            where: { token },
                            select: { userId: true, expiresAt: true },
                        });
                        if (sessionRecord && sessionRecord.expiresAt > new Date()) {
                            return sessionRecord.userId;
                        }
                    } catch {
                        // ignore and continue
                    }
                }
            }
        }

        try {
            const session = await this.auth.api.getSession({ headers: fromNodeHeaders(headers) });
            if (session?.user?.id) return session.user.id;
        } catch {
            // fallback to direct cookie lookup
        }

        if (this.prisma && headers.cookie) {
            try {
                const match = /(?:^|;\s*)(?:__Secure-)?casa-flora\.session_token=([^;]+)/.exec(headers.cookie);
                if (match?.[1]) {
                    const rawCookieVal = decodeURIComponent(match[1]);
                    const token = rawCookieVal.split(".")[0];
                    if (token) {
                        const sessionRecord = await this.prisma.session.findUnique({
                            where: { token },
                            select: { userId: true, expiresAt: true },
                        });
                        if (sessionRecord && sessionRecord.expiresAt > new Date()) {
                            return sessionRecord.userId;
                        }
                    }
                }
            } catch {
                // ignore
            }
        }

        return null;
    }
}
