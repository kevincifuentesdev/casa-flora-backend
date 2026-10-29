import {
    BookingCapacityError,
    BookingNotFoundError,
    DuplicateBookingSlotError,
} from "../../application/errors/booking.error.js";
import {
    BOOKING_STATUSES,
    BOOKING_TIME_SLOTS,
    type Booking,
    type BookingCustomerSummary,
    type BookingStatus,
    type BookingTimeSlot,
    type EnvironmentId,
} from "../../domain/models/booking.js";
import type {
    AdminBookingFilters,
    CreateBookingInput,
    IBookingRepository,
    ReserveBookingAtomicInput,
    UpdateBookingAdminInput,
} from "../../domain/repository/IBooking.repository.js";
import type { PrismaClient } from "./client.js";
import type { Booking as PrismaBooking } from "./generated/client.js";

type PrismaBookingUserSummary = {
    id: string;
    name: string;
    firstName: string;
    lastName: string;
    email: string;
    username: string | null;
    points: number;
    dietPreference: string | null;
    spiceTolerance: string | null;
    favoriteMoment: string | null;
};

type PrismaBookingWithUser = PrismaBooking & {
    user?: PrismaBookingUserSummary | null;
};

const bookingIncludeWithUser = {
    user: {
        select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            username: true,
            points: true,
            dietPreference: true,
            spiceTolerance: true,
            favoriteMoment: true,
        },
    },
} as const;

function toBookingStatus(value: string): BookingStatus {
    return (BOOKING_STATUSES as readonly string[]).includes(value)
        ? (value as BookingStatus)
        : "confirmed";
}

function toCustomerDomain(
    row: PrismaBookingUserSummary,
): BookingCustomerSummary {
    return {
        id: row.id,
        name: row.name,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        username: row.username,
        points: row.points,
        dietPreference: row.dietPreference,
        spiceTolerance: row.spiceTolerance,
        favoriteMoment: row.favoriteMoment,
    };
}

function toDomain(row: PrismaBookingWithUser): Booking {
    return {
        id: row.id,
        userId: row.userId,
        environment: row.environment as EnvironmentId,
        date: row.date,
        time: row.time as BookingTimeSlot,
        diners: row.diners,
        status: toBookingStatus(row.status),
        ...(row.user ? { customer: toCustomerDomain(row.user) } : {}),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

export class BookingPgRepository implements IBookingRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async create(input: CreateBookingInput): Promise<Booking> {
        const row = await this.prisma.booking.create({
            data: {
                userId: input.userId,
                environment: input.environment,
                date: input.date,
                time: input.time,
                diners: input.diners,
                status: "confirmed",
            },
            include: bookingIncludeWithUser,
        });
        return toDomain(row);
    }

    async createConfirmedWithinCapacity(input: ReserveBookingAtomicInput): Promise<Booking> {
        return this.prisma.$transaction(
            async (tx) => {
                const duplicate = await tx.booking.findFirst({
                    where: {
                        userId: input.userId,
                        date: input.date,
                        time: input.time,
                        status: { in: ["confirmed", "seated"] },
                    },
                });

                if (duplicate) {
                    throw new DuplicateBookingSlotError();
                }

                const aggregate = await tx.booking.aggregate({
                    where: {
                        date: input.date,
                        time: input.time,
                        environment: input.environment,
                        status: { in: ["confirmed", "seated"] },
                    },
                    _sum: { diners: true },
                });

                const reserved = aggregate._sum.diners ?? 0;
                const remaining = Math.max(0, input.capacity - reserved);

                if (reserved + input.diners > input.capacity) {
                    throw new BookingCapacityError(remaining);
                }

                const created = await tx.booking.create({
                    data: {
                        userId: input.userId,
                        environment: input.environment,
                        date: input.date,
                        time: input.time,
                        diners: input.diners,
                        status: "confirmed",
                    },
                    include: bookingIncludeWithUser,
                });

                return toDomain(created);
            },
            { isolationLevel: "Serializable" },
        );
    }

    async findById(id: string): Promise<Booking | null> {
        const row = await this.prisma.booking.findUnique({
            where: { id },
            include: bookingIncludeWithUser,
        });
        return row ? toDomain(row) : null;
    }

    async findByUserId(userId: string): Promise<Booking[]> {
        const rows = await this.prisma.booking.findMany({
            where: { userId },
            include: bookingIncludeWithUser,
            orderBy: [{ date: "desc" }, { time: "desc" }, { createdAt: "desc" }],
        });
        return rows.map(toDomain);
    }

    async findAllForAdmin(filters: AdminBookingFilters = {}): Promise<Booking[]> {
        const sort = filters.sort ?? "earliest";
        const orderBy =
            sort === "latest"
                ? [
                      { date: "desc" as const },
                      { time: "desc" as const },
                      { createdAt: "desc" as const },
                  ]
                : sort === "diners-desc"
                  ? [
                        { diners: "desc" as const },
                        { date: "asc" as const },
                        { time: "asc" as const },
                    ]
                  : [
                        { date: "asc" as const },
                        { time: "asc" as const },
                        { createdAt: "asc" as const },
                    ];

        const rows = await this.prisma.booking.findMany({
            where: {
                ...(filters.date
                    ? { date: filters.date }
                    : filters.dateFrom || filters.dateTo
                      ? {
                            date: {
                                ...(filters.dateFrom
                                    ? { gte: filters.dateFrom }
                                    : {}),
                                ...(filters.dateTo
                                    ? { lte: filters.dateTo }
                                    : {}),
                            },
                        }
                      : {}),
                ...(filters.environment
                    ? { environment: filters.environment }
                    : {}),
                ...(filters.status ? { status: filters.status } : {}),
            },
            include: bookingIncludeWithUser,
            orderBy,
        });

        const mapped = rows.map(toDomain);
        const query = filters.search?.trim().toLowerCase();
        if (!query) {
            return mapped;
        }

        return mapped.filter((b) => {
            const idMatch = b.id.toLowerCase().includes(query);
            const customerMatch =
                b.customer?.name.toLowerCase().includes(query) ||
                b.customer?.email.toLowerCase().includes(query) ||
                (b.customer?.username?.toLowerCase().includes(query) ?? false);
            const dateMatch = b.date.includes(query) || b.time.includes(query);
            return idMatch || customerMatch || dateMatch;
        });
    }

    async findActiveByUserSlot(
        userId: string,
        date: string,
        time: BookingTimeSlot,
    ): Promise<Booking | null> {
        const row = await this.prisma.booking.findFirst({
            where: {
                userId,
                date,
                time,
                status: { in: ["confirmed", "seated"] },
            },
            include: bookingIncludeWithUser,
        });
        return row ? toDomain(row) : null;
    }

    async countConfirmedDiners(
        date: string,
        time: BookingTimeSlot,
        environment: EnvironmentId,
    ): Promise<number> {
        const aggregate = await this.prisma.booking.aggregate({
            where: {
                date,
                time,
                environment,
                status: { in: ["confirmed", "seated"] },
            },
            _sum: { diners: true },
        });
        return aggregate._sum.diners ?? 0;
    }

    async countConfirmedDinersByDateAndEnvironment(
        date: string,
        environment: EnvironmentId,
    ): Promise<Record<BookingTimeSlot, number>> {
        const rows = await this.prisma.booking.groupBy({
            by: ["time"],
            where: {
                date,
                environment,
                status: { in: ["confirmed", "seated"] },
            },
            _sum: { diners: true },
        });

        const counts: Record<BookingTimeSlot, number> = {
            "13:00": 0,
            "14:30": 0,
            "19:00": 0,
            "20:30": 0,
        };

        for (const row of rows) {
            if ((BOOKING_TIME_SLOTS as readonly string[]).includes(row.time)) {
                counts[row.time as BookingTimeSlot] = row._sum.diners ?? 0;
            }
        }

        return counts;
    }

    async updateStatus(id: string, status: BookingStatus): Promise<Booking> {
        try {
            const row = await this.prisma.booking.update({
                where: { id },
                data: { status },
                include: bookingIncludeWithUser,
            });
            return toDomain(row);
        } catch (error) {
            if (
                typeof error === "object" &&
                error !== null &&
                "code" in error &&
                (error as { code?: string }).code === "P2025"
            ) {
                throw new BookingNotFoundError();
            }
            throw error;
        }
    }

    async updateByAdmin(
        id: string,
        input: UpdateBookingAdminInput,
    ): Promise<Booking> {
        try {
            const row = await this.prisma.booking.update({
                where: { id },
                data: {
                    ...(input.environment !== undefined
                        ? { environment: input.environment }
                        : {}),
                    ...(input.date !== undefined ? { date: input.date } : {}),
                    ...(input.time !== undefined ? { time: input.time } : {}),
                    ...(input.diners !== undefined
                        ? { diners: input.diners }
                        : {}),
                    ...(input.status !== undefined
                        ? { status: input.status }
                        : {}),
                },
                include: bookingIncludeWithUser,
            });
            return toDomain(row);
        } catch (error) {
            if (
                typeof error === "object" &&
                error !== null &&
                "code" in error &&
                (error as { code?: string }).code === "P2025"
            ) {
                throw new BookingNotFoundError();
            }
            throw error;
        }
    }
}

