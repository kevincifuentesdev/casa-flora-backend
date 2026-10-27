import type { Request, RequestHandler, Response } from "express";

import type { OrderUseCase } from "../../application/order.use-case.js";
import {
    type AdminOrderQueryDto,
    type CheckoutSessionResponseDto,
    type CreateCheckoutDto,
    type CreateOrderDto,
    type UpdateOrderStatusDto,
    type VerifyCheckoutPaymentDto,
    type VerifyCheckoutPaymentResponseDto,
    toOrderResponseDto,
} from "../../infrastructure/dtos/order.dto.js";
import {
    getAuthenticatedUser,
    getOptionalAuthenticatedUser,
} from "../middlewares/auth.middleware.js";

export class OrderController {
    constructor(private readonly orderUseCase: OrderUseCase) {}

    readonly create: RequestHandler = async (req: Request, res: Response, next) => {
        try {
            const current = getAuthenticatedUser(res);
            if (current.role === "admin") {
                res.status(403).json({
                    error: {
                        code: "FORBIDDEN",
                        message:
                            "Las cuentas de administrador no pueden realizar pedidos. Gestiona los pedidos en el panel de administración.",
                    },
                });
                return;
            }
            const body = (res.locals.validatedBody ?? req.body) as CreateOrderDto;
            const order = await this.orderUseCase.createOrder(current.id, body);
            res.status(201).json({ data: toOrderResponseDto(order) });
        } catch (error) {
            next(error);
        }
    };

    readonly checkout: RequestHandler = async (req: Request, res: Response, next) => {
        try {
            const current = getAuthenticatedUser(res);
            if (current.role === "admin") {
                res.status(403).json({
                    error: {
                        code: "FORBIDDEN",
                        message:
                            "Las cuentas de administrador no pueden realizar pedidos. Gestiona los pedidos en el panel de administración.",
                    },
                });
                return;
            }
            const body = (res.locals.validatedBody ?? req.body) as CreateCheckoutDto;
            const session = await this.orderUseCase.createCheckout(
                current.id,
                body,
            );
            const dto: CheckoutSessionResponseDto = {
                preferenceId: session.preferenceId,
                externalReference: session.externalReference,
                checkoutUrl: session.checkoutUrl,
                sandboxCheckoutUrl: session.sandboxCheckoutUrl,
                deliveryMethod: session.deliveryMethod,
                addressLabel: session.addressLabel,
                totalAmount: session.totalAmount,
                pointsEarned: session.pointsEarned,
                order: session.order ? toOrderResponseDto(session.order) : null,
            };
            res.status(201).json({ data: dto });
        } catch (error) {
            next(error);
        }
    };

    readonly verifyCheckout: RequestHandler = async (
        req: Request,
        res: Response,
        next,
    ) => {
        try {
            const current = getOptionalAuthenticatedUser(res);
            const body = (res.locals.validatedBody ??
                req.body) as VerifyCheckoutPaymentDto;
            const verification = await this.orderUseCase.verifyCheckoutPayment(
                current ? current.id : null,
                body,
            );
            const dto: VerifyCheckoutPaymentResponseDto = {
                externalReference: verification.externalReference,
                status: verification.status,
                paymentId: verification.paymentId,
                paymentSummary: verification.paymentSummary,
                order: verification.order
                    ? toOrderResponseDto(verification.order)
                    : null,
            };
            res.status(200).json({ data: dto });
        } catch (error) {
            next(error);
        }
    };

    readonly cancelPending: RequestHandler = async (
        req: Request,
        res: Response,
        next,
    ) => {
        try {
            const current = getAuthenticatedUser(res);
            const orderId = String(req.params.id ?? "").trim();
            const updated = await this.orderUseCase.cancelPendingOrder(
                current.id,
                orderId,
            );
            res.status(200).json({
                data: updated ? toOrderResponseDto(updated) : null,
            });
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

    readonly listAllAdmin: RequestHandler = async (
        req: Request,
        res: Response,
        next,
    ) => {
        try {
            const query = (res.locals.validatedQuery ??
                req.query) as AdminOrderQueryDto;
            const orders = await this.orderUseCase.listAllOrdersForAdmin({
                ...(query.status ? { status: query.status } : {}),
                ...(query.search ? { search: query.search } : {}),
            });
            res.status(200).json({ data: orders.map(toOrderResponseDto) });
        } catch (error) {
            next(error);
        }
    };

    readonly updateStatusAdmin: RequestHandler = async (
        req: Request,
        res: Response,
        next,
    ) => {
        try {
            const { id } = (res.locals.validatedParams ?? req.params) as {
                id: string;
            };
            const body = (res.locals.validatedBody ??
                req.body) as UpdateOrderStatusDto;
            const updated = await this.orderUseCase.updateOrderStatusByAdmin(
                id,
                body.status,
            );
            res.status(200).json({ data: toOrderResponseDto(updated) });
        } catch (error) {
            next(error);
        }
    };
}
