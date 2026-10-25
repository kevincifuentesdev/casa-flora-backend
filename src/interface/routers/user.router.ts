import { Router, type RequestHandler } from "express";

import { updateUserProfileDtoSchema } from "../../infrastructure/dtos/user.dto.js";
import type { UserController } from "../controllers/user.controller.js";
import type { AuthMiddleware } from "../middlewares/auth.middleware.js";
import { validateBody } from "../middlewares/validate.middleware.js";

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

    return router;
}
