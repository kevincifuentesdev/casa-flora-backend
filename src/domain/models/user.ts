export const USER_ROLES = ["customer", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface User {
    id: string;
    name: string;
    firstName: string;
    lastName: string;
    birthDate: string;
    username: string | null;
    email: string;
    emailVerified: boolean;
    role: UserRole;
    createdAt: Date;
    updatedAt: Date;
}

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,30}$/;

const PERSON_NAME_PATTERN = /^\p{L}[\p{L}\p{M}\s'’.-]*$/u;
const PERSON_NAME_MIN = 2;
const PERSON_NAME_MAX = 60;
const MAX_AGE_YEARS = 120;

export function isValidUsername(value: string): boolean {
    return USERNAME_PATTERN.test(value);
}

export function normalizePersonName(value: string): string {
    return value.trim().replace(/\s+/g, " ");
}

export function validatePersonName(value: string, label: "nombres" | "apellidos"): string | null {
    const name = normalizePersonName(value);

    if (name.length < PERSON_NAME_MIN) {
        return `Los ${label} deben tener al menos ${PERSON_NAME_MIN} caracteres.`;
    }
    if (name.length > PERSON_NAME_MAX) {
        return `Los ${label} no pueden superar ${PERSON_NAME_MAX} caracteres.`;
    }
    if (!PERSON_NAME_PATTERN.test(name)) {
        return `Los ${label} solo pueden contener letras, espacios, puntos, apóstrofes o guiones.`;
    }
    return null;
}

export function validateBirthDate(value: string, today: Date = new Date()): string | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return "Ingresa una fecha de nacimiento válida.";

    const [, year, month, day] = match.map(Number) as [number, number, number, number];
    const parsed = new Date(Date.UTC(year, month - 1, day));
    const isRealDay =
        parsed.getUTCFullYear() === year &&
        parsed.getUTCMonth() === month - 1 &&
        parsed.getUTCDate() === day;

    if (!isRealDay) return "Ingresa una fecha de nacimiento válida.";

    const todayIso = today.toISOString().slice(0, 10);
    if (value >= todayIso) return "La fecha de nacimiento debe ser anterior a hoy.";

    const oldest = new Date(today);
    oldest.setUTCFullYear(oldest.getUTCFullYear() - MAX_AGE_YEARS);
    if (value < oldest.toISOString().slice(0, 10)) {
        return "Ingresa una fecha de nacimiento válida.";
    }

    return null;
}
