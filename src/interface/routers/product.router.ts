import { Router, type RequestHandler } from "express";

import {
    createProductDtoSchema,
    productIdParamDtoSchema,
    productQueryDtoSchema,
    updateProductDtoSchema,
} from "../../infrastructure/dtos/product.dto.js";
import type { ProductController } from "../controllers/product.controller.js";
import type { AuthMiddleware } from "../middlewares/auth.middleware.js";
import {
    validateBody,
    validateParams,
    validateQuery,
} from "../middlewares/validate.middleware.js";

export function createProductRouter(
    productController: ProductController,
    authMiddleware: AuthMiddleware,
    writeRateLimiter: RequestHandler,
): Router {
    const router = Router();

    router.get("/", validateQuery(productQueryDtoSchema), productController.listProducts);
    router.get("/:id", validateParams(productIdParamDtoSchema), productController.getProductById);

    router.post(
        "/",
        writeRateLimiter,
        authMiddleware.requireAdmin,
        validateBody(createProductDtoSchema),
        productController.createProduct,
    );

    router.patch(
        "/:id",
        writeRateLimiter,
        authMiddleware.requireAdmin,
        validateParams(productIdParamDtoSchema),
        validateBody(updateProductDtoSchema),
        productController.updateProduct,
    );

    router.delete(
        "/:id",
        writeRateLimiter,
        authMiddleware.requireAdmin,
        validateParams(productIdParamDtoSchema),
        productController.deleteProduct,
    );

    return router;
}

