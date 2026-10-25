import {
    DuplicateProductError,
    ProductNotFoundError,
} from "./errors/product.error.js";
import type { Product, ProductFilters } from "../domain/models/product.js";
import type {
    CreateProductInput,
    IProductRepository,
    UpdateProductInput,
} from "../domain/repository/IProduct.repository.js";

export class ProductUseCase {
    constructor(private readonly productRepository: IProductRepository) {}

    async listProducts(filters: ProductFilters = {}): Promise<Product[]> {
        return this.productRepository.findAll(filters);
    }

    async getProductById(id: string): Promise<Product> {
        const product = await this.productRepository.findById(id);
        if (!product || !product.available) {
            throw new ProductNotFoundError(id);
        }
        return product;
    }

    async createProduct(input: CreateProductInput): Promise<Product> {
        const existing = await this.productRepository.findById(input.id);
        if (existing) {
            throw new DuplicateProductError(input.id);
        }
        return this.productRepository.create(input);
    }

    async updateProduct(id: string, input: UpdateProductInput): Promise<Product> {
        return this.productRepository.update(id, input);
    }

    async deleteProduct(id: string): Promise<void> {
        return this.productRepository.delete(id);
    }
}

