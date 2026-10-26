import type { Product } from "./product.js";

export const USER_ROLES = ["customer", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const DIET_PREFERENCES = ["cows", "trees", "both"] as const;
export type DietPreference = (typeof DIET_PREFERENCES)[number];

export const SPICE_TOLERANCES = ["none", "mild", "spicy"] as const;
export type SpiceTolerance = (typeof SPICE_TOLERANCES)[number];

export const FAVORITE_MOMENTS = ["almuerzo", "tarde", "postre"] as const;
export type FavoriteMoment = (typeof FAVORITE_MOMENTS)[number];

export const PAYMENT_METHOD_TYPES = ["card", "pse", "cash"] as const;
export type PaymentMethodType = (typeof PAYMENT_METHOD_TYPES)[number];

export const REWARD_GOAL_POINTS = 15;
export const PESOS_PER_POINT = 2500;
export const MIN_POINTS_PER_ORDER = 3;

export interface UserPreferences {
    dietPreference: DietPreference | null;
    spiceTolerance: SpiceTolerance | null;
    favoriteMoment: FavoriteMoment | null;
}

export interface UserAddress {
    id: string;
    userId: string;
    label: string;
    addressLine: string;
    neighborhood: string;
    city: string;
    details: string | null;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface PaymentMethod {
    id: string;
    userId: string;
    type: PaymentMethodType;
    brand: string;
    lastFour: string | null;
    holderName: string | null;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface LoyaltySummary {
    points: number;
    nextRewardGoal: number;
    pointsInCurrentCycle: number;
    pointsRemaining: number;
    progressPercent: number;
    rewardName: string;
    availableRewards: number;
}

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
    points: number;
    onboardingCompleted: boolean;
    dietPreference: DietPreference | null;
    spiceTolerance: SpiceTolerance | null;
    favoriteMoment: FavoriteMoment | null;
    addresses: UserAddress[];
    paymentMethods: PaymentMethod[];
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

export function calculateOrderPoints(totalAmount: number): number {
    if (totalAmount <= 0) return 0;
    return Math.max(MIN_POINTS_PER_ORDER, Math.floor(totalAmount / PESOS_PER_POINT));
}

export function buildLoyaltySummary(
    points: number,
    dietPreference: DietPreference | null,
): LoyaltySummary {
    const safePoints = Math.max(0, Math.floor(points));
    const availableRewards = Math.floor(safePoints / REWARD_GOAL_POINTS);
    const pointsInCurrentCycle = safePoints % REWARD_GOAL_POINTS;
    const pointsRemaining = REWARD_GOAL_POINTS - pointsInCurrentCycle;
    const progressPercent = Math.min(
        100,
        Math.round((pointsInCurrentCycle / REWARD_GOAL_POINTS) * 100),
    );

    const rewardName =
        dietPreference === "trees" ? "Rolls de Yuca Silvestre" : "Empanadas de la Abuela";

    return {
        points: safePoints,
        nextRewardGoal: REWARD_GOAL_POINTS,
        pointsInCurrentCycle,
        pointsRemaining,
        progressPercent,
        rewardName,
        availableRewards,
    };
}

export function recommendProductForUser(
    products: readonly Product[],
    preferences: UserPreferences,
): Product | null {
    const available = products.filter((item) => item.available);
    if (available.length === 0) return null;

    if (preferences.favoriteMoment === "postre") {
        if (preferences.dietPreference === "trees") {
            const veganDessert = available.find(
                (item) => item.categories.includes("Postre") && item.categories.includes("Vegano"),
            );
            if (veganDessert) return veganDessert;
        }
        const dessert = available.find((item) => item.categories.includes("Postre"));
        if (dessert) return dessert;
    }

    if (preferences.dietPreference === "trees") {
        const vegan = available.find((item) => item.categories.includes("Vegano"));
        if (vegan) return vegan;
    }

    if (preferences.favoriteMoment === "tarde") {
        const starter = available.find((item) => item.categories.includes("Entrada"));
        if (starter) return starter;
    }

    if (preferences.dietPreference === "cows") {
        const hearty = available.find(
            (item) => item.id === "abuela" || item.categories.includes("Plato Fuerte"),
        );
        if (hearty) return hearty;
    }

    return available.find((item) => item.id === "fernando") ?? available[0] ?? null;
}
