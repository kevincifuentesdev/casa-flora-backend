import {
    DuplicateProductError,
    ProductNotFoundError,
} from "../../application/errors/product.error.js";
import {
    type Product,
    type ProductCategory,
    type ProductFilters,
    filterAndSortProducts,
    isValidProductCategory,
} from "../../domain/models/product.js";
import type {
    CreateProductInput,
    IProductRepository,
    UpdateProductInput,
} from "../../domain/repository/IProduct.repository.js";
import type { PrismaClient } from "./client.js";
import type { Product as PrismaProduct } from "./generated/client.js";

function toDomain(row: PrismaProduct): Product {
    return {
        id: row.id,
        name: row.name,
        price: row.price,
        categories: row.categories.filter(isValidProductCategory) as ProductCategory[],
        description: row.description,
        imageUrl: row.imageUrl,
        available: row.available,
        sortOrder: row.sortOrder,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

function isPrismaCode(error: unknown, code: string): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === code
    );
}

export class ProductPgRepository implements IProductRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async findAll(filters: ProductFilters = {}): Promise<Product[]> {
        const rows = await this.prisma.product.findMany({
            where: {
                ...(filters.onlyAvailable === false ? {} : { available: true }),
                ...(filters.maxPrice !== undefined ? { price: { lte: filters.maxPrice } } : {}),
                ...(filters.categories && filters.categories.length > 0
                    ? { categories: { hasSome: filters.categories } }
                    : {}),
            },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        });

        const products = rows.map(toDomain);
        return filterAndSortProducts(products, filters);
    }

    async findById(id: string): Promise<Product | null> {
        const row = await this.prisma.product.findUnique({ where: { id } });
        return row ? toDomain(row) : null;
    }

    async create(input: CreateProductInput): Promise<Product> {
        try {
            const row = await this.prisma.product.create({
                data: {
                    id: input.id,
                    name: input.name,
                    price: input.price,
                    categories: input.categories,
                    description: input.description,
                    imageUrl: input.imageUrl,
                    available: input.available ?? true,
                    sortOrder: input.sortOrder ?? 0,
                },
            });
            return toDomain(row);
        } catch (error) {
            if (isPrismaCode(error, "P2002")) {
                throw new DuplicateProductError(input.id);
            }
            throw error;
        }
    }

    async update(id: string, input: UpdateProductInput): Promise<Product> {
        try {
            const row = await this.prisma.product.update({
                where: { id },
                data: {
                    ...(input.name !== undefined ? { name: input.name } : {}),
                    ...(input.price !== undefined ? { price: input.price } : {}),
                    ...(input.categories !== undefined ? { categories: input.categories } : {}),
                    ...(input.description !== undefined ? { description: input.description } : {}),
                    ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
                    ...(input.available !== undefined ? { available: input.available } : {}),
                    ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
                },
            });
            return toDomain(row);
        } catch (error) {
            if (isPrismaCode(error, "P2025")) {
                throw new ProductNotFoundError(id);
            }
            throw error;
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.prisma.product.delete({ where: { id } });
        } catch (error) {
            if (isPrismaCode(error, "P2025")) {
                throw new ProductNotFoundError(id);
            }
            throw error;
        }
    }
}

