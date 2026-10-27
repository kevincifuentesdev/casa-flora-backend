import { randomUUID } from "node:crypto";
import type { Request, RequestHandler, Response } from "express";

import { AppError, ValidationError } from "../../application/errors/app.error.js";
import type { IStorageService } from "../../infrastructure/services/storage.service.js";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const PRODUCT_PREFIX = "products/";
const FILE_NAME_PATTERN = /^[a-f0-9-]{36}\.(jpg|png|webp)$/;

type ImageKind = { ext: "jpg" | "png" | "webp"; mime: string };

function detectImage(buf: Buffer): ImageKind | null {
    if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
        return { ext: "jpg", mime: "image/jpeg" };
    }
    if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) {
        return { ext: "png", mime: "image/png" };
    }
    if (
        buf.length > 12 &&
        buf.subarray(0, 4).toString("ascii") === "RIFF" &&
        buf.subarray(8, 12).toString("ascii") === "WEBP"
    ) {
        return { ext: "webp", mime: "image/webp" };
    }
    return null;
}

export class UploadController {
    constructor(private readonly storage?: IStorageService) {}

    private requireStorage(): IStorageService {
        if (!this.storage) {
            throw new AppError(
                503,
                "STORAGE_UNAVAILABLE",
                "El almacenamiento de imágenes no está configurado.",
            );
        }
        return this.storage;
    }

    readonly uploadProductImage: RequestHandler = async (
        req: Request,
        res: Response,
        next,
    ) => {
        try {
            const storage = this.requireStorage();
            const body: unknown = req.body;
            if (!Buffer.isBuffer(body) || body.length === 0) {
                throw new ValidationError("Adjunta una imagen JPG, PNG o WebP.");
            }
            const kind = detectImage(body);
            if (!kind) {
                throw new ValidationError("El archivo debe ser una imagen JPG, PNG o WebP.");
            }

            const fileName = `${randomUUID()}.${kind.ext}`;
            await storage.put(`${PRODUCT_PREFIX}${fileName}`, body, kind.mime);

            const url = `${req.protocol}://${req.get("host")}/api/uploads/products/${fileName}`;
            res.status(201).json({ data: { url, key: `${PRODUCT_PREFIX}${fileName}` } });
        } catch (error) {
            next(error);
        }
    };

    readonly getProductImage: RequestHandler = async (req: Request, res: Response, next) => {
        try {
            const storage = this.requireStorage();
            const name = String(req.params.name ?? "");
            if (!FILE_NAME_PATTERN.test(name)) {
                res.status(404).json({
                    error: { code: "NOT_FOUND", message: "Imagen no encontrada." },
                });
                return;
            }
            const object = await storage.get(`${PRODUCT_PREFIX}${name}`);
            if (!object) {
                res.status(404).json({
                    error: { code: "NOT_FOUND", message: "Imagen no encontrada." },
                });
                return;
            }
            res.setHeader("Content-Type", object.contentType);
            if (object.contentLength !== undefined) {
                res.setHeader("Content-Length", String(object.contentLength));
            }
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
            res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
            object.body.on("error", next);
            object.body.pipe(res);
        } catch (error) {
            next(error);
        }
    };
}
