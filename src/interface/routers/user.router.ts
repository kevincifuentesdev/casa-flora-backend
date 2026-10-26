import { Router, type RequestHandler } from "express";

import {
    completeOnboardingDtoSchema,
    createPaymentMethodDtoSchema,
    createUserAddressDtoSchema,
    resourceIdParamDtoSchema,
    updateUserProfileDtoSchema,
} from "../../infrastructure/dtos/user.dto.js";
import type { UserController } from "../controllers/user.controller.js";
import type { AuthMiddleware } from "../middlewares/auth.middleware.js";
import { validateBody, validateParams } from "../middlewares/validate.middleware.js";

export function createUserRouter(
    userController: UserController,
    authMiddleware: AuthMiddleware,
    writeRateLimiter: RequestHandler,
): Router {
    const router = Router();

    router.get("/me", authMiddleware.requireAuth, userController.getProfile);
    router.patch(
        "/me",
        writeRateLimiter,
        authMiddleware.requireAuth,
        validateBody(updateUserProfileDtoSchema),
        userController.updateProfile,
    );
    router.post(
        "/me/onboarding",
        writeRateLimiter,
        authMiddleware.requireAuth,
        validateBody(completeOnboardingDtoSchema),
        userController.completeOnboarding,
    );
    router.post(
        "/me/addresses",
        writeRateLimiter,
        authMiddleware.requireAuth,
        validateBody(createUserAddressDtoSchema),
        userController.addAddress,
    );
    router.delete(
        "/me/addresses/:id",
        writeRateLimiter,
        authMiddleware.requireAuth,
        validateParams(resourceIdParamDtoSchema),
        userController.removeAddress,
    );
    router.post(
        "/me/payment-methods",
        writeRateLimiter,
        authMiddleware.requireAuth,
        validateBody(createPaymentMethodDtoSchema),
        userController.addPaymentMethod,
    );
    router.delete(
        "/me/payment-methods/:id",
        writeRateLimiter,
        authMiddleware.requireAuth,
        validateParams(resourceIdParamDtoSchema),
        userController.removePaymentMethod,
    );

    return router;
}
