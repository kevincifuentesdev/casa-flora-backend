import type { Request, RequestHandler, Response } from "express";

import type { ProductUseCase } from "../../application/product.use-case.js";
import { PRODUCT_CATEGORIES } from "../../domain/models/product.js";
import { paginateArray } from "../../infrastructure/dtos/pagination.dto.js";
import {
    type CreateProductDto,
    type ProductQueryDto,
    type UpdateProductDto,
    toProductResponseDto,
} from "../../infrastructure/dtos/product.dto.js";

export class ProductController {
    constructor(private readonly productUseCase: ProductUseCase) {}

    readonly listProducts: RequestHandler = async (_req: Request, res: Response, next) => {
        try {
            const query = (res.locals.validatedQuery ?? {}) as ProductQueryDto;
            const products = await this.productUseCase.listProducts({
                search: query.search,
                categories: query.categories,
                maxPrice: query.maxPrice,
                sort: query.sort,
                onlyAvailable: true,
            });

            const items = products.map(toProductResponseDto);
            const maxPrice = items.reduce((max, item) => Math.max(max, item.price), 0);
            const { data: pagedItems, pagination } = paginateArray(
                items,
                query.page,
                query.limit,
            );

            res.status(200).json({
                data: pagedItems,
                meta: {
                    total: pagination.total,
                    page: pagination.page,
                    limit: pagination.limit,
                    totalPages: pagination.totalPages,
                    hasNextPage: pagination.hasNextPage,
                    hasPrevPage: pagination.hasPrevPage,
                    categories: PRODUCT_CATEGORIES,
                    maxPrice,
                },
            });
        } catch (error) {
            next(error);
        }
    };

    readonly listAdminProducts: RequestHandler = async (
        _req: Request,
        res: Response,
        next,
    ) => {
        try {
            const query = (res.locals.validatedQuery ?? {}) as ProductQueryDto;
            const products = await this.productUseCase.listProducts({
                search: query.search,
                categories: query.categories,
                maxPrice: query.maxPrice,
                sort: query.sort,
                onlyAvailable: false,
            });

            const items = products.map(toProductResponseDto);
            const maxPrice = items.reduce(
                (max, item) => Math.max(max, item.price),
                0,
            );
            const { data: pagedItems, pagination } = paginateArray(
                items,
                query.page,
                query.limit,
            );

            res.status(200).json({
                data: pagedItems,
                meta: {
                    total: pagination.total,
                    page: pagination.page,
                    limit: pagination.limit,
                    totalPages: pagination.totalPages,
                    hasNextPage: pagination.hasNextPage,
                    hasPrevPage: pagination.hasPrevPage,
                    categories: PRODUCT_CATEGORIES,
                    maxPrice,
                },
            });
        } catch (error) {
            next(error);
        }
    };

    readonly getProductById: RequestHandler = async (req: Request, res: Response, next) => {
        try {
            const { id } = (res.locals.validatedParams ?? req.params) as { id: string };
            const product = await this.productUseCase.getProductById(id);
            res.status(200).json({ data: toProductResponseDto(product) });
        } catch (error) {
            next(error);
        }
    };

    readonly createProduct: RequestHandler = async (req: Request, res: Response, next) => {
        try {
            const body = (res.locals.validatedBody ?? req.body) as CreateProductDto;
            const created = await this.productUseCase.createProduct(body);
            res.status(201).json({ data: toProductResponseDto(created) });
        } catch (error) {
            next(error);
        }
    };

    readonly updateProduct: RequestHandler = async (req: Request, res: Response, next) => {
        try {
            const { id } = (res.locals.validatedParams ?? req.params) as { id: string };
            const body = (res.locals.validatedBody ?? req.body) as UpdateProductDto;
            const updated = await this.productUseCase.updateProduct(id, body);
            res.status(200).json({ data: toProductResponseDto(updated) });
        } catch (error) {
            next(error);
        }
    };

    readonly deleteProduct: RequestHandler = async (req: Request, res: Response, next) => {
        try {
            const { id } = (res.locals.validatedParams ?? req.params) as { id: string };
            await this.productUseCase.deleteProduct(id);
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    };
}

