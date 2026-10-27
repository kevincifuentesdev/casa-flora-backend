import { z } from "zod";

export const paginationQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type PaginationQueryDto = z.infer<typeof paginationQuerySchema>;

export interface PaginationMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}

export function paginateArray<T>(
    items: T[],
    pageParam?: number,
    limitParam?: number,
): { data: T[]; pagination: PaginationMeta } {
    const total = items.length;

    if (pageParam === undefined && limitParam === undefined) {
        return {
            data: items,
            pagination: {
                total,
                page: 1,
                limit: total,
                totalPages: 1,
                hasNextPage: false,
                hasPrevPage: false,
            },
        };
    }

    const page = Math.max(1, pageParam ?? 1);
    const limit = Math.max(1, Math.min(100, limitParam ?? 10));
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * limit;
    const data = items.slice(startIndex, startIndex + limit);

    return {
        data,
        pagination: {
            total,
            page: safePage,
            limit,
            totalPages,
            hasNextPage: safePage < totalPages,
            hasPrevPage: safePage > 1,
        },
    };
}
