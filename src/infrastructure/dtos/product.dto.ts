import { z } from "zod";

import {
    DEFAULT_PRODUCT_SORT,
    PRODUCT_CATEGORIES,
    PRODUCT_ID_PATTERN,
    PRODUCT_SORT_OPTIONS,
    type Product,
    type ProductCategory,
    isValidProductCategory,
} from "../../domain/models/product.js";

const categorySchema = z.enum(PRODUCT_CATEGORIES);

const categoriesParamSchema = z
    .union([z.string(), z.array(z.string())])
    .transform((value) => {
        const raw = Array.isArray(value) ? value : value.split(",");
        return raw.map((item) => item.trim()).filter(Boolean);
    })
    .refine((items) => items.every(isValidProductCategory), {
        message: "Categoría de menú inválida.",
    })
    .transform((items) => items as ProductCategory[]);

export const productQueryDtoSchema = z.object({
    search: z.string().trim().max(120).optional(),
    categories: categoriesParamSchema.optional(),
    maxPrice: z.coerce.number().int().min(0).max(1_000_000).optional(),
    sort: z.enum(PRODUCT_SORT_OPTIONS).default(DEFAULT_PRODUCT_SORT),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type ProductQueryDto = z.infer<typeof productQueryDtoSchema>;

export const productIdParamDtoSchema = z.object({
    id: z
        .string()
        .trim()
        .min(1)
        .max(64)
        .regex(PRODUCT_ID_PATTERN, "Identificador de plato inválido."),
});

export const createProductDtoSchema = z.object({
    id: z
        .string()
        .trim()
        .min(2)
        .max(64)
        .regex(PRODUCT_ID_PATTERN, "Usa minúsculas, números y guiones para el id del plato."),
    name: z.string().trim().min(2).max(80),
    price: z.number().int().min(0).max(1_000_000),
    categories: z.array(categorySchema).min(1).max(4),
    description: z.string().trim().min(10).max(400),
    imageUrl: z.url().max(2048),
    available: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
});

export type CreateProductDto = z.infer<typeof createProductDtoSchema>;

export const updateProductDtoSchema = createProductDtoSchema
    .omit({ id: true })
    .partial()
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
        message: "Debes proporcionar al menos un campo para actualizar el plato.",
    });

export type UpdateProductDto = z.infer<typeof updateProductDtoSchema>;

export interface ProductResponseDto {
    id: string;
    name: string;
    price: number;
    categories: ProductCategory[];
    description: string;
    imageUrl: string;
    available: boolean;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
}

export function toProductResponseDto(product: Product): ProductResponseDto {
    return {
        id: product.id,
        name: product.name,
        price: product.price,
        categories: product.categories,
        description: product.description,
        imageUrl: product.imageUrl,
        available: product.available,
        sortOrder: product.sortOrder,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
    };
}

