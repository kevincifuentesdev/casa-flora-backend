import type { Express } from "express";
import { IncomingMessage, ServerResponse, type IncomingHttpHeaders } from "node:http";
import { Socket } from "node:net";
import { beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import {
    DuplicateUsernameError,
    UserNotFoundError,
} from "../src/application/errors/auth.error.js";
import {
    BookingCapacityError,
    BookingNotFoundError,
    DuplicateBookingSlotError,
} from "../src/application/errors/booking.error.js";
import {
    DuplicateProductError,
    ProductNotFoundError,
} from "../src/application/errors/product.error.js";
import {
    BOOKING_TIME_SLOTS,
    type Booking,
    type BookingStatus,
    type BookingTimeSlot,
    type EnvironmentId,
    formatBogotaDate,
} from "../src/domain/models/booking.js";
import {
    INITIAL_PRODUCTS,
    type Product,
    type ProductFilters,
    filterAndSortProducts,
} from "../src/domain/models/product.js";
import {
    type User,
    validateBirthDate,
    validatePersonName,
} from "../src/domain/models/user.js";
import type {
    CreateBookingInput,
    IBookingRepository,
    ReserveBookingAtomicInput,
} from "../src/domain/repository/IBooking.repository.js";
import type {
    CreateProductInput,
    IProductRepository,
    UpdateProductInput,
} from "../src/domain/repository/IProduct.repository.js";
import type {
    IUserRepository,
    UpdateUserProfileInput,
} from "../src/domain/repository/IUser.repository.js";
import type { AuthService } from "../src/infrastructure/services/auth.service.js";
import { parseEnv } from "../src/infrastructure/services/env.service.js";

interface TestResponse<T = unknown> {
    status: number;
    headers: Record<string, string | string[] | number | undefined>;
    body: T;
}

async function requestApp<T = unknown>(
    app: Express,
    path: string,
    options: {
        method?: string;
        headers?: Record<string, string>;
        body?: unknown;
    } = {},
): Promise<TestResponse<T>> {
    return new Promise((resolve, reject) => {
        const socket = new Socket();
        const req = new IncomingMessage(socket);
        req.method = options.method ?? "GET";
        req.url = path;

        const rawBody =
            options.body !== undefined ? Buffer.from(JSON.stringify(options.body), "utf-8") : null;

        const normalizedHeaders: Record<string, string> = {};
        if (options.headers) {
            for (const [key, value] of Object.entries(options.headers)) {
                normalizedHeaders[key.toLowerCase()] = value;
            }
        }
        if (rawBody) {
            normalizedHeaders["content-length"] = String(rawBody.byteLength);
            if (!normalizedHeaders["content-type"]) {
                normalizedHeaders["content-type"] = "application/json";
            }
        }
        req.headers = normalizedHeaders;

        const res = new ServerResponse(req);
        const chunks: Buffer[] = [];

        const originalWrite = res.write.bind(res);
        const originalEnd = res.end.bind(res);

        res.write = ((chunk: unknown, ...args: unknown[]) => {
            if (chunk) {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
            }
            return (originalWrite as (...a: unknown[]) => boolean)(chunk, ...args);
        }) as typeof res.write;

        res.end = ((chunk?: unknown, ...args: unknown[]) => {
            if (chunk && typeof chunk !== "function") {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
            }
            const result = (originalEnd as (...a: unknown[]) => ServerResponse)(chunk, ...args);
            const rawText = Buffer.concat(chunks).toString("utf-8");
            const parsedBody = rawText ? (JSON.parse(rawText) as T) : (undefined as T);

            resolve({
                status: res.statusCode,
                headers: res.getHeaders(),
                body: parsedBody,
            });
            return result;
        }) as typeof res.end;

        res.on("error", reject);

        app(req, res);

        if (rawBody) {
            req.push(rawBody);
        }
        req.push(null);
    });
}

class InMemoryUserRepository implements IUserRepository {
    private readonly users = new Map<string, User>();

    constructor(initial: User[]) {
        for (const user of initial) {
            this.users.set(user.id, user);
        }
    }

    async findById(id: string): Promise<User | null> {
        return this.users.get(id) ?? null;
    }

    async findByEmail(email: string): Promise<User | null> {
        const lower = email.toLowerCase();
        for (const user of this.users.values()) {
            if (user.email.toLowerCase() === lower) return user;
        }
        return null;
    }

    async findByUsername(username: string): Promise<User | null> {
        const lower = username.toLowerCase();
        for (const user of this.users.values()) {
            if (user.username?.toLowerCase() === lower) return user;
        }
        return null;
    }

    async updateProfile(id: string, input: UpdateUserProfileInput): Promise<User> {
        const current = this.users.get(id);
        if (!current) throw new UserNotFoundError();

        if (input.username) {
            const conflict = await this.findByUsername(input.username);
            if (conflict && conflict.id !== id) {
                throw new DuplicateUsernameError();
            }
        }

        const firstName = input.firstName ?? current.firstName;
        const lastName = input.lastName ?? current.lastName;
        const updated: User = {
            ...current,
            firstName,
            lastName,
            name: `${firstName} ${lastName}`,
            birthDate: input.birthDate ?? current.birthDate,
            username: input.username ?? current.username,
            updatedAt: new Date(),
        };
        this.users.set(id, updated);
        return updated;
    }
}

class InMemoryProductRepository implements IProductRepository {
    private readonly products = new Map<string, Product>();

    constructor() {
        const now = new Date();
        for (const item of INITIAL_PRODUCTS) {
            this.products.set(item.id, {
                ...item,
                categories: [...item.categories],
                available: true,
                createdAt: now,
                updatedAt: now,
            });
        }
    }

    async findAll(filters: ProductFilters = {}): Promise<Product[]> {
        return filterAndSortProducts(Array.from(this.products.values()), filters);
    }

    async findById(id: string): Promise<Product | null> {
        return this.products.get(id) ?? null;
    }

    async create(input: CreateProductInput): Promise<Product> {
        if (this.products.has(input.id)) {
            throw new DuplicateProductError(input.id);
        }
        const now = new Date();
        const product: Product = {
            id: input.id,
            name: input.name,
            price: input.price,
            categories: [...input.categories],
            description: input.description,
            imageUrl: input.imageUrl,
            available: input.available ?? true,
            sortOrder: input.sortOrder ?? 99,
            createdAt: now,
            updatedAt: now,
        };
        this.products.set(product.id, product);
        return product;
    }

    async update(id: string, input: UpdateProductInput): Promise<Product> {
        const current = this.products.get(id);
        if (!current) throw new ProductNotFoundError(id);

        const updated: Product = {
            ...current,
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.price !== undefined ? { price: input.price } : {}),
            ...(input.categories !== undefined ? { categories: [...input.categories] } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
            ...(input.available !== undefined ? { available: input.available } : {}),
            ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
            updatedAt: new Date(),
        };
        this.products.set(id, updated);
        return updated;
    }

    async delete(id: string): Promise<void> {
        if (!this.products.has(id)) throw new ProductNotFoundError(id);
        this.products.delete(id);
    }
}

class InMemoryBookingRepository implements IBookingRepository {
    private readonly bookings = new Map<string, Booking>();
    private seq = 1;

    async create(input: CreateBookingInput): Promise<Booking> {
        const now = new Date();
        const booking: Booking = {
            id: `booking-${this.seq++}`,
            userId: input.userId,
            environment: input.environment,
            date: input.date,
            time: input.time,
            diners: input.diners,
            status: "confirmed",
            createdAt: now,
            updatedAt: now,
        };
        this.bookings.set(booking.id, booking);
        return booking;
    }

    async createConfirmedWithinCapacity(input: ReserveBookingAtomicInput): Promise<Booking> {
        const duplicate = await this.findActiveByUserSlot(input.userId, input.date, input.time);
        if (duplicate) {
            throw new DuplicateBookingSlotError();
        }

        const reserved = await this.countConfirmedDiners(
            input.date,
            input.time,
            input.environment,
        );
        const remaining = Math.max(0, input.capacity - reserved);
        if (reserved + input.diners > input.capacity) {
            throw new BookingCapacityError(remaining);
        }

        return this.create(input);
    }

    async findById(id: string): Promise<Booking | null> {
        return this.bookings.get(id) ?? null;
    }

    async findByUserId(userId: string): Promise<Booking[]> {
        return Array.from(this.bookings.values()).filter((b) => b.userId === userId);
    }

    async findActiveByUserSlot(
        userId: string,
        date: string,
        time: BookingTimeSlot,
    ): Promise<Booking | null> {
        for (const booking of this.bookings.values()) {
            if (
                booking.userId === userId &&
                booking.date === date &&
                booking.time === time &&
                booking.status === "confirmed"
            ) {
                return booking;
            }
        }
        return null;
    }

    async countConfirmedDiners(
        date: string,
        time: BookingTimeSlot,
        environment: EnvironmentId,
    ): Promise<number> {
        let sum = 0;
        for (const booking of this.bookings.values()) {
            if (
                booking.date === date &&
                booking.time === time &&
                booking.environment === environment &&
                booking.status === "confirmed"
            ) {
                sum += booking.diners;
            }
        }
        return sum;
    }

    async countConfirmedDinersByDateAndEnvironment(
        date: string,
        environment: EnvironmentId,
    ): Promise<Record<BookingTimeSlot, number>> {
        const counts: Record<BookingTimeSlot, number> = {
            "13:00": 0,
            "14:30": 0,
            "19:00": 0,
            "20:30": 0,
        };
        for (const slot of BOOKING_TIME_SLOTS) {
            counts[slot] = await this.countConfirmedDiners(date, slot, environment);
        }
        return counts;
    }

    async updateStatus(id: string, status: BookingStatus): Promise<Booking> {
        const current = this.bookings.get(id);
        if (!current) throw new BookingNotFoundError();
        const updated: Booking = { ...current, status, updatedAt: new Date() };
        this.bookings.set(id, updated);
        return updated;
    }
}

describe("Casa Flora Backend Clean Architecture & HTTP API", () => {
    let app: Express;

    const customerUser: User = {
        id: "user-customer-1",
        name: "Valentina Restrepo",
        firstName: "Valentina",
        lastName: "Restrepo",
        birthDate: "1998-05-14",
        username: "valen_restrepo",
        email: "valentina@casaflora.co",
        emailVerified: true,
        role: "customer",
        createdAt: new Date("2026-10-20T12:00:00.000Z"),
        updatedAt: new Date("2026-10-20T12:00:00.000Z"),
    };

    const adminUser: User = {
        id: "user-admin-1",
        name: "Kevin Cifuentes",
        firstName: "Kevin",
        lastName: "Cifuentes",
        birthDate: "1999-08-21",
        username: "kevincifuentes",
        email: "kevin@casaflora.co",
        emailVerified: true,
        role: "admin",
        createdAt: new Date("2026-10-20T12:00:00.000Z"),
        updatedAt: new Date("2026-10-20T12:00:00.000Z"),
    };

    beforeAll(() => {
        const env = parseEnv({
            NODE_ENV: "test",
            PORT: "4000",
            DATABASE_URL:
                "postgresql://neondb_owner:password@ep-casa-flora-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require",
            BETTER_AUTH_URL: "http://localhost:4000",
            BETTER_AUTH_SECRET: "test-secret-with-at-least-32-characters-long-12345",
            CORS_ORIGINS: "http://localhost:3000",
            INTERIOR_CAPACITY: "10",
            PATIO_CAPACITY: "6",
        });

        const fakeAuthService = {
            handler: async () =>
                new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                }),
            resolveUserId: async (headers: IncomingHttpHeaders) => {
                const authHeader = headers.authorization;
                if (authHeader === "Bearer token-customer") return customerUser.id;
                if (authHeader === "Bearer token-admin") return adminUser.id;
                return null;
            },
        } as unknown as AuthService;

        app = createApp({
            env,
            authService: fakeAuthService,
            userRepository: new InMemoryUserRepository([customerUser, adminUser]),
            productRepository: new InMemoryProductRepository(),
            bookingRepository: new InMemoryBookingRepository(),
        });
    });

    it("validates domain person names and birth dates", () => {
        expect(validatePersonName("María José", "nombres")).toBeNull();
        expect(validatePersonName("A", "nombres")).toContain("al menos 2 caracteres");
        expect(validateBirthDate("2000-02-29")).toBeNull();
        expect(validateBirthDate("2001-02-29")).toContain("fecha de nacimiento válida");
    });

    it("returns health status and security headers", async () => {
        const res = await requestApp<{ status: string }>(app, "/api/health", {
            headers: { Origin: "http://localhost:3000" },
        });
        expect(res.status).toBe(200);
        expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
        expect(res.headers["x-content-type-options"]).toBe("nosniff");
        expect(res.body.status).toBe("ok");
    });

    it("lists, filters and sorts the 12 Casa Flora products", async () => {
        const allRes = await requestApp<{
            data: Array<{ id: string; price: number }>;
            meta: { total: number; maxPrice: number };
        }>(app, "/api/products");
        expect(allRes.status).toBe(200);
        expect(allRes.body.meta.total).toBe(12);
        expect(allRes.body.meta.maxPrice).toBe(25000);

        const filteredRes = await requestApp<{
            data: Array<{ id: string; price: number }>;
        }>(app, "/api/products?categories=Entrada,Vegano&maxPrice=11000&sort=precio-desc");
        expect(filteredRes.status).toBe(200);
        expect(filteredRes.body.data.length).toBeGreaterThan(0);
        expect(filteredRes.body.data.every((p) => p.price <= 11000)).toBe(true);
    });

    it("enforces authentication and admin authorization on product mutations", async () => {
        const unauth = await requestApp(app, "/api/products", {
            method: "POST",
            body: {},
        });
        expect(unauth.status).toBe(401);

        const forbidden = await requestApp(app, "/api/products", {
            method: "POST",
            headers: { Authorization: "Bearer token-customer" },
            body: {},
        });
        expect(forbidden.status).toBe(403);

        const created = await requestApp(app, "/api/products", {
            method: "POST",
            headers: { Authorization: "Bearer token-admin" },
            body: {
                id: "cazuela-andina",
                name: "Cazuela Andina",
                price: 22000,
                categories: ["Plato Fuerte"],
                description: "Cazuela cremosa de frijol y maíz tierno con aguacate y maduro.",
                imageUrl: "https://example.com/cazuela.jpg",
            },
        });
        expect(created.status).toBe(201);
    });

    it("retrieves and updates the authenticated user profile", async () => {
        const getRes = await requestApp<{ data: { username: string; firstName: string } }>(
            app,
            "/api/users/me",
            {
                headers: { Authorization: "Bearer token-customer" },
            },
        );
        expect(getRes.status).toBe(200);
        expect(getRes.body.data.username).toBe("valen_restrepo");

        const patchRes = await requestApp<{ data: { name: string } }>(app, "/api/users/me", {
            method: "PATCH",
            headers: { Authorization: "Bearer token-customer" },
            body: { firstName: "Valentina Sofía" },
        });
        expect(patchRes.status).toBe(200);
        expect(patchRes.body.data.name).toBe("Valentina Sofía Restrepo");
    });

    it("creates bookings, enforces slot capacity and supports cancellation", async () => {
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const dateIso = formatBogotaDate(tomorrow);

        const createRes = await requestApp<{
            data: { id: string; date: string; status: string };
        }>(app, "/api/bookings", {
            method: "POST",
            headers: { Authorization: "Bearer token-customer" },
            body: {
                environment: "patio",
                date: tomorrow.toISOString(),
                time: "19:00",
                diners: 4,
            },
        });
        expect(createRes.status).toBe(201);
        expect(createRes.body.data.date).toBe(dateIso);
        expect(createRes.body.data.status).toBe("confirmed");

        const duplicateRes = await requestApp(app, "/api/bookings", {
            method: "POST",
            headers: { Authorization: "Bearer token-customer" },
            body: {
                environment: "patio",
                date: dateIso,
                time: "19:00",
                diners: 2,
            },
        });
        expect(duplicateRes.status).toBe(409);

        const overCapacityRes = await requestApp(app, "/api/bookings", {
            method: "POST",
            headers: { Authorization: "Bearer token-admin" },
            body: {
                environment: "patio",
                date: dateIso,
                time: "19:00",
                diners: 4,
            },
        });
        expect(overCapacityRes.status).toBe(409);

        const availabilityRes = await requestApp<{
            data: { slots: Array<{ time: string; remainingDiners: number }> };
        }>(app, `/api/bookings/availability?date=${dateIso}&environment=patio`);
        expect(availabilityRes.status).toBe(200);
        const slot19 = availabilityRes.body.data.slots.find((s) => s.time === "19:00");
        expect(slot19?.remainingDiners).toBe(2);

        const cancelRes = await requestApp<{ data: { status: string } }>(
            app,
            `/api/bookings/${createRes.body.data.id}/cancel`,
            {
                method: "PATCH",
                headers: { Authorization: "Bearer token-customer" },
            },
        );
        expect(cancelRes.status).toBe(200);
        expect(cancelRes.body.data.status).toBe("cancelled");
    });
});

