import type { Request, RequestHandler, Response } from "express";

import type { UserUseCase } from "../../application/user.use-case.js";
import {
    type CompleteOnboardingDto,
    type CreatePaymentMethodDto,
    type CreateUserAddressDto,
    type UpdateUserProfileDto,
    toPaymentMethodResponseDto,
    toUserAddressResponseDto,
    toUserResponseDto,
} from "../../infrastructure/dtos/user.dto.js";
import { getAuthenticatedUser } from "../middlewares/auth.middleware.js";

export class UserController {
    constructor(private readonly userUseCase: UserUseCase) {}

    readonly getProfile: RequestHandler = async (_req: Request, res: Response, next) => {
        try {
            const current = getAuthenticatedUser(res);
            const context = await this.userUseCase.getProfileContext(current.id);
            res.status(200).json({ data: toUserResponseDto(context) });
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

    readonly completeOnboarding: RequestHandler = async (req: Request, res: Response, next) => {
        try {
            const current = getAuthenticatedUser(res);
            const body = (res.locals.validatedBody ?? req.body) as CompleteOnboardingDto;
            const updated = await this.userUseCase.saveOnboarding(current.id, body);
            res.status(200).json({ data: toUserResponseDto(updated) });
        } catch (error) {
            next(error);
        }
    };

    readonly addAddress: RequestHandler = async (req: Request, res: Response, next) => {
        try {
            const current = getAuthenticatedUser(res);
            const body = (res.locals.validatedBody ?? req.body) as CreateUserAddressDto;
            const address = await this.userUseCase.addAddress(current.id, body);
            res.status(201).json({ data: toUserAddressResponseDto(address) });
        } catch (error) {
            next(error);
        }
    };

    readonly removeAddress: RequestHandler = async (req: Request, res: Response, next) => {
        try {
            const current = getAuthenticatedUser(res);
            const params = (res.locals.validatedParams ?? req.params) as { id: string };
            await this.userUseCase.removeAddress(current.id, params.id);
            res.status(204).end();
        } catch (error) {
            next(error);
        }
    };

    readonly addPaymentMethod: RequestHandler = async (req: Request, res: Response, next) => {
        try {
            const current = getAuthenticatedUser(res);
            const body = (res.locals.validatedBody ?? req.body) as CreatePaymentMethodDto;
            const method = await this.userUseCase.addPaymentMethod(current.id, body);
            res.status(201).json({ data: toPaymentMethodResponseDto(method) });
        } catch (error) {
            next(error);
        }
    };

    readonly removePaymentMethod: RequestHandler = async (req: Request, res: Response, next) => {
        try {
            const current = getAuthenticatedUser(res);
            const params = (res.locals.validatedParams ?? req.params) as { id: string };
            await this.userUseCase.removePaymentMethod(current.id, params.id);
            res.status(204).end();
        } catch (error) {
            next(error);
        }
    };
}
