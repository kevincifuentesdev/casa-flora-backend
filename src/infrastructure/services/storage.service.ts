import {
    GetObjectCommand,
    NoSuchKey,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";

import type { Env } from "./env.service.js";

export interface StoredObject {
    body: Readable;
    contentType: string;
    contentLength?: number;
}

export interface IStorageService {
    put(key: string, body: Buffer, contentType: string): Promise<void>;
    get(key: string): Promise<StoredObject | null>;
}

/** Neon Object Storage (S3 compatible). Neon only supports path-style addressing. */
export class S3StorageService implements IStorageService {
    private readonly client: S3Client;
    private readonly bucket: string;

    constructor(env: Env) {
        this.bucket = env.S3_BUCKET;
        this.client = new S3Client({
            region: env.AWS_REGION,
            endpoint: env.AWS_ENDPOINT_URL_S3,
            forcePathStyle: true,
            credentials: {
                accessKeyId: env.AWS_ACCESS_KEY_ID ?? "",
                secretAccessKey: env.AWS_SECRET_ACCESS_KEY ?? "",
            },
        });
    }

    static isConfigured(env: Env): boolean {
        return Boolean(
            env.AWS_ENDPOINT_URL_S3 && env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY,
        );
    }

    async put(key: string, body: Buffer, contentType: string): Promise<void> {
        await this.client.send(
            new PutObjectCommand({
                Bucket: this.bucket,
                Key: key,
                Body: body,
                ContentType: contentType,
                CacheControl: "public, max-age=31536000, immutable",
            }),
        );
    }

    async get(key: string): Promise<StoredObject | null> {
        try {
            const result = await this.client.send(
                new GetObjectCommand({ Bucket: this.bucket, Key: key }),
            );
            if (!result.Body) return null;
            return {
                body: result.Body as Readable,
                contentType: result.ContentType ?? "application/octet-stream",
                ...(result.ContentLength !== undefined
                    ? { contentLength: result.ContentLength }
                    : {}),
            };
        } catch (error) {
            if (error instanceof NoSuchKey) return null;
            throw error;
        }
    }
}
