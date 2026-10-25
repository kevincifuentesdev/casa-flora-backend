import { toNodeHandler } from "better-auth/node";
import { Router } from "express";

import type { AuthService } from "../../infrastructure/services/auth.service.js";

export function createAuthRouter(authService: AuthService): Router {
    const router = Router();
    const handler = toNodeHandler(authService.handler);

    router.all("/", handler);
    router.all("/*splat", handler);

    return router;
}

