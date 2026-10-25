import { DuplicateUsernameError, UserNotFoundError } from "../../application/errors/auth.error.js";
import { USER_ROLES, type User, type UserRole } from "../../domain/models/user.js";
import type { IUserRepository, UpdateUserProfileInput } from "../../domain/repository/IUser.repository.js";
import type { PrismaClient } from "./client.js";
import type { User as PrismaUser } from "./generated/client.js";

function toRole(value: string): UserRole {
    return (USER_ROLES as readonly string[]).includes(value) ? (value as UserRole) : "customer";
}

function toDomain(row: PrismaUser): User {
    return {
        id: row.id,
        name: row.name,
        firstName: row.firstName,
        lastName: row.lastName,
        birthDate: row.birthDate,
        username: row.username,
        email: row.email,
        emailVerified: row.emailVerified,
        role: toRole(row.role),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

export class UserPgRepository implements IUserRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async findById(id: string): Promise<User | null> {
        const row = await this.prisma.user.findUnique({ where: { id } });
        return row ? toDomain(row) : null;
    }

    async findByEmail(email: string): Promise<User | null> {
        const row = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        return row ? toDomain(row) : null;
    }

    async findByUsername(username: string): Promise<User | null> {
        const row = await this.prisma.user.findUnique({ where: { username: username.toLowerCase() } });
        return row ? toDomain(row) : null;
    }

    async updateProfile(id: string, input: UpdateUserProfileInput): Promise<User> {
        const current = await this.prisma.user.findUnique({ where: { id } });
        if (!current) throw new UserNotFoundError();

        const firstName = input.firstName ?? current.firstName;
        const lastName = input.lastName ?? current.lastName;
        const normalizedUsername = input.username?.toLowerCase();

        try {
            const updated = await this.prisma.user.update({
                where: { id },
                data: {
                    firstName,
                    lastName,
                    name: `${firstName} ${lastName}`,
                    ...(input.birthDate !== undefined ? { birthDate: input.birthDate } : {}),
                    ...(normalizedUsername !== undefined
                        ? { username: normalizedUsername, displayUsername: input.username }
                        : {}),
                },
            });
            return toDomain(updated);
        } catch (error) {
            if (
                typeof error === "object" &&
                error !== null &&
                "code" in error &&
                (error as { code?: string }).code === "P2002"
            ) {
                throw new DuplicateUsernameError();
            }
            throw error;
        }
    }
}

