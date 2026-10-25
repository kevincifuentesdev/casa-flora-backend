import type { Request, RequestHandler, Response } from "express";

import {
    ForbiddenError,
    UnauthorizedError,
} from "../../application/errors/auth.error.js";
import type { User } from "../../domain/models/user.js";
import type { IUserRepository } from "../../domain/repository/IUser.repository.js";
import type { AuthService } from "../../infrastructure/services/auth.service.js";

export interface AuthenticatedLocals {
    user?: User;
}

export function getAuthenticatedUser(res: Response): User {
    const user = (res.locals as AuthenticatedLocals).user;
    if (!user) {
        throw new UnauthorizedError();
    }
    return user;
}

export class AuthMiddleware {
    constructor(
        private readonly authService: AuthService,
        private readonly userRepository: IUserRepository,
    ) {}

    readonly requireAuth: RequestHandler = async (req: Request, res: Response, next) => {
        try {
            const userId = await this.authService.resolveUserId(req.headers);
            if (!userId) {
                throw new UnauthorizedError();
            }

            const user = await this.userRepository.findById(userId);
            if (!user) {
                throw new UnauthorizedError();
            }

            (res.locals as AuthenticatedLocals).user = user;
            next();
        } catch (error) {
            next(error);
        }
    };

    readonly requireAdmin: RequestHandler = async (req: Request, res: Response, next) => {
        await this.requireAuth(req, res, (err?: unknown) => {
            if (err) {
                next(err);
                return;
            }

            const user = (res.locals as AuthenticatedLocals).user;
            if (!user || user.role !== "admin") {
                next(new ForbiddenError());
                return;
            }

            next();
        });
    };
}

