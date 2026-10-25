export const BOOKING_ENVIRONMENTS = ["interior", "patio"] as const;
export type EnvironmentId = (typeof BOOKING_ENVIRONMENTS)[number];

export const BOOKING_TIME_SLOTS = ["13:00", "14:30", "19:00", "20:30"] as const;
export type BookingTimeSlot = (typeof BOOKING_TIME_SLOTS)[number];

export const TIME_SLOT_GROUPS = [
    { label: "Almuerzo", slots: ["13:00", "14:30"] as const },
    { label: "Cena", slots: ["19:00", "20:30"] as const },
] as const;

export const BOOKING_STATUSES = ["confirmed", "cancelled"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const MIN_DINERS = 1;
export const MAX_DINERS = 10;
export const DEFAULT_DINERS = 2;
export const MAX_ADVANCE_DAYS = 180;

export type BookingField = "environment" | "date" | "time" | "diners";

export const BOOKING_FIELD_MESSAGES: Record<BookingField, string> = {
    environment: "Selecciona un ambiente.",
    date: "Selecciona una fecha.",
    time: "Selecciona un horario.",
    diners: "Número de comensales inválido.",
};

export interface Booking {
    id: string;
    userId: string;
    environment: EnvironmentId;
    date: string;
    time: BookingTimeSlot;
    diners: number;
    status: BookingStatus;
    createdAt: Date;
    updatedAt: Date;
}

export interface SlotAvailability {
    time: BookingTimeSlot;
    capacity: number;
    reservedDiners: number;
    remainingDiners: number;
    available: boolean;
}

const bogotaFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});

export function formatBogotaDate(date: Date = new Date()): string {
    return bogotaFormatter.format(date);
}

export function isValidEnvironment(value: unknown): value is EnvironmentId {
    return (
        typeof value === "string" &&
        (BOOKING_ENVIRONMENTS as readonly string[]).includes(value)
    );
}

export function isValidTimeSlot(value: unknown): value is BookingTimeSlot {
    return (
        typeof value === "string" &&
        (BOOKING_TIME_SLOTS as readonly string[]).includes(value)
    );
}

export function isValidDiners(value: unknown): value is number {
    return (
        typeof value === "number" &&
        Number.isInteger(value) &&
        value >= MIN_DINERS &&
        value <= MAX_DINERS
    );
}

export function normalizeBookingDate(raw: unknown): string | null {
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;

    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (dateOnlyMatch) {
        const [, y, m, d] = dateOnlyMatch.map(Number) as [number, number, number, number];
        const parsed = new Date(Date.UTC(y, m - 1, d));
        const isReal =
            parsed.getUTCFullYear() === y &&
            parsed.getUTCMonth() === m - 1 &&
            parsed.getUTCDate() === d;
        return isReal ? trimmed : null;
    }

    if (!/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) return null;
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;

    return formatBogotaDate(parsed);
}

export function validateBookingDate(
    raw: unknown,
    now: Date = new Date(),
): { date: string } | { error: string } {
    const normalized = normalizeBookingDate(raw);
    if (!normalized) {
        return { error: BOOKING_FIELD_MESSAGES.date };
    }

    const todayIso = formatBogotaDate(now);
    if (normalized < todayIso) {
        return { error: "No es posible reservar en una fecha pasada." };
    }

    const maxDate = new Date(now.getTime() + MAX_ADVANCE_DAYS * 24 * 60 * 60 * 1000);
    const maxIso = formatBogotaDate(maxDate);
    if (normalized > maxIso) {
        return { error: "Solo se permiten reservas con hasta 6 meses de anticipación." };
    }

    return { date: normalized };
}

