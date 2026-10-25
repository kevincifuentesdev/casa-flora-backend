import type { Product, ProductCategory, ProductFilters } from "../models/product.js";

export interface CreateProductInput {
    id: string;
    name: string;
    price: number;
    categories: ProductCategory[];
    description: string;
    imageUrl: string;
    available?: boolean;
    sortOrder?: number;
}

export interface UpdateProductInput {
    name?: string;
    price?: number;
    categories?: ProductCategory[];
    description?: string;
    imageUrl?: string;
    available?: boolean;
    sortOrder?: number;
}

export interface IProductRepository {
    findAll(filters?: ProductFilters): Promise<Product[]>;
    findById(id: string): Promise<Product | null>;
    create(input: CreateProductInput): Promise<Product>;
    update(id: string, input: UpdateProductInput): Promise<Product>;
    delete(id: string): Promise<void>;
}

