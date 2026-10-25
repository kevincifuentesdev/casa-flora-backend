import type { User } from "../models/user.js";

export interface UpdateUserProfileInput {
    firstName?: string;
    lastName?: string;
    birthDate?: string;
    username?: string;
}

export interface IUserRepository {
    findById(id: string): Promise<User | null>;
    findByEmail(email: string): Promise<User | null>;
    findByUsername(username: string): Promise<User | null>;
    updateProfile(id: string, input: UpdateUserProfileInput): Promise<User>;
}

