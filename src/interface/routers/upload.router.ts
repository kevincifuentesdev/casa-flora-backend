import express, { Router, type RequestHandler } from "express";

import { MAX_UPLOAD_BYTES, type UploadController } from "../controllers/upload.controller.js";
import type { AuthMiddleware } from "../middlewares/auth.middleware.js";

export function createUploadRouter(
    uploadController: UploadController,
    authMiddleware: AuthMiddleware,
    writeRateLimiter: RequestHandler,
): Router {
    const router = Router();

    router.post(
        "/products",
        writeRateLimiter,
        authMiddleware.requireAdmin,
        express.raw({ type: ["image/*", "application/octet-stream"], limit: MAX_UPLOAD_BYTES }),
        uploadController.uploadProductImage,
    );
    router.get("/products/:name", uploadController.getProductImage);

    return router;
}
