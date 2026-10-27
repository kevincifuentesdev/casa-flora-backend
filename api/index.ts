import type { Request, Response } from "express";
import { getOrCreateApp } from "../src/app.js";

const app = getOrCreateApp();

export default function handler(req: Request, res: Response) {
    return app(req, res);
}

