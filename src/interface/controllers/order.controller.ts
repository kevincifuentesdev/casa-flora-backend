import type { Request, RequestHandler, Response } from "express";

import type { OrderUseCase } from "../../application/order.use-case.js";
import {
    type CreateOrderDto,
    toOrderResponseDto,
} from "../../infrastructure/dtos/order.dto.js";
import { getAuthenticatedUser } from "../middlewares/auth.middleware.js";

export class OrderController {
    constructor(private readonly orderUseCase: OrderUseCase) {}

    readonly create: RequestHandler = async (req: Request, res: Response, next) => {
        try {
            const current = getAuthenticatedUser(res);
            const body = (res.locals.validatedBody ?? req.body) as CreateOrderDto;
            const order = await this.orderUseCase.createOrder(current.id, body);
            res.status(201).json({ data: toOrderResponseDto(order) });
        } catch (error) {
            next(error);
        }
    };

    readonly listMine: RequestHandler = async (_req: Request, res: Response, next) => {
        try {
            const current = getAuthenticatedUser(res);
            const orders = await this.orderUseCase.listUserOrders(current.id);
            res.status(200).json({ data: orders.map(toOrderResponseDto) });
        } catch (error) {
            next(error);
        }
    };
}

