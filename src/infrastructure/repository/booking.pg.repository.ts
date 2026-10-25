import {
    BookingCapacityError,
    BookingNotFoundError,
    DuplicateBookingSlotError,
} from "../../application/errors/booking.error.js";
import {
    BOOKING_TIME_SLOTS,
    type Booking,
    type BookingStatus,
    type BookingTimeSlot,
    type EnvironmentId,
} from "../../domain/models/booking.js";
import type {
    CreateBookingInput,
    IBookingRepository,
    ReserveBookingAtomicInput,
} from "../../domain/repository/IBooking.repository.js";
import type { PrismaClient } from "./client.js";
import type { Booking as PrismaBooking } from "./generated/client.js";

function toDomain(row: PrismaBooking): Booking {
    return {
        id: row.id,
        userId: row.userId,
        environment: row.environment as EnvironmentId,
        date: row.date,
        time: row.time as BookingTimeSlot,
        diners: row.diners,
        status: row.status as BookingStatus,
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
                        status: "confirmed",
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
                        status: "confirmed",
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
                });

                return toDomain(created);
            },
            { isolationLevel: "Serializable" },
        );
    }

    async findById(id: string): Promise<Booking | null> {
        const row = await this.prisma.booking.findUnique({ where: { id } });
        return row ? toDomain(row) : null;
    }

    async findByUserId(userId: string): Promise<Booking[]> {
        const rows = await this.prisma.booking.findMany({
            where: { userId },
            orderBy: [{ date: "desc" }, { time: "desc" }, { createdAt: "desc" }],
        });
        return rows.map(toDomain);
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
                status: "confirmed",
            },
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
                status: "confirmed",
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
                status: "confirmed",
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

