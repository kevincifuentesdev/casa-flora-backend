import type { Request, RequestHandler, Response } from "express";

import type { UserUseCase } from "../../application/user.use-case.js";
import {
    type UpdateUserProfileDto,
    toUserResponseDto,
} from "../../infrastructure/dtos/user.dto.js";
import { getAuthenticatedUser } from "../middlewares/auth.middleware.js";

export class UserController {
    constructor(private readonly userUseCase: UserUseCase) {}

    readonly getProfile: RequestHandler = async (_req: Request, res: Response, next) => {
        try {
            const current = getAuthenticatedUser(res);
            const user = await this.userUseCase.getProfile(current.id);
            res.status(200).json({ data: toUserResponseDto(user) });
        } catch (error) {
            next(error);
        }
    };

    readonly updateProfile: RequestHandler = async (req: Request, res: Response, next) => {
        try {
            const current = getAuthenticatedUser(res);
            const body = (res.locals.validatedBody ?? req.body) as UpdateUserProfileDto;
            const updated = await this.userUseCase.updateProfile(current.id, body);
            res.status(200).json({ data: toUserResponseDto(updated) });
        } catch (error) {
            next(error);
        }
    };
}
