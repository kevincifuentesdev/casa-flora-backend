import {
    DuplicateUsernameError,
    UserNotFoundError,
} from "./errors/auth.error.js";
import { ValidationError } from "./errors/app.error.js";
import {
    type User,
    isValidUsername,
    normalizePersonName,
    validateBirthDate,
    validatePersonName,
} from "../domain/models/user.js";
import type {
    IUserRepository,
    UpdateUserProfileInput,
} from "../domain/repository/IUser.repository.js";

export class UserUseCase {
    constructor(private readonly userRepository: IUserRepository) {}

    async getProfile(userId: string): Promise<User> {
        const user = await this.userRepository.findById(userId);
        if (!user) throw new UserNotFoundError();
        return user;
    }

    async updateProfile(userId: string, input: UpdateUserProfileInput): Promise<User> {
        const cleaned: UpdateUserProfileInput = {};

        if (input.firstName !== undefined) {
            const normalized = normalizePersonName(input.firstName);
            const error = validatePersonName(normalized, "nombres");
            if (error) throw new ValidationError(error, { firstName: error });
            cleaned.firstName = normalized;
        }

        if (input.lastName !== undefined) {
            const normalized = normalizePersonName(input.lastName);
            const error = validatePersonName(normalized, "apellidos");
            if (error) throw new ValidationError(error, { lastName: error });
            cleaned.lastName = normalized;
        }

        if (input.birthDate !== undefined) {
            const error = validateBirthDate(input.birthDate);
            if (error) throw new ValidationError(error, { birthDate: error });
            cleaned.birthDate = input.birthDate;
        }

        if (input.username !== undefined) {
            const trimmed = input.username.trim();
            if (!isValidUsername(trimmed)) {
                const msg =
                    "Usa entre 3 y 30 caracteres: letras, números, puntos, guiones o guion bajo.";
                throw new ValidationError(msg, { username: msg });
            }
            const existing = await this.userRepository.findByUsername(trimmed);
            if (existing && existing.id !== userId) {
                throw new DuplicateUsernameError();
            }
            cleaned.username = trimmed;
        }

        return this.userRepository.updateProfile(userId, cleaned);
    }
}
