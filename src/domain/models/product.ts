export const PRODUCT_CATEGORIES = [
    "Entrada",
    "Vegano",
    "Plato Fuerte",
    "Especial del Día",
    "Bebida",
    "Postre",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_SORT_OPTIONS = [
    "relevancia",
    "precio-asc",
    "precio-desc",
    "nombre-az",
] as const;

export type ProductSortOption = (typeof PRODUCT_SORT_OPTIONS)[number];

export const DEFAULT_PRODUCT_SORT: ProductSortOption = "relevancia";

export const PRODUCT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface Product {
    id: string;
    name: string;
    price: number;
    categories: ProductCategory[];
    description: string;
    imageUrl: string;
    available: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface ProductFilters {
    search?: string;
    categories?: ProductCategory[];
    maxPrice?: number;
    sort?: ProductSortOption;
    onlyAvailable?: boolean;
}

export function isValidProductCategory(value: string): value is ProductCategory {
    return (PRODUCT_CATEGORIES as readonly string[]).includes(value);
}

export function isValidProductSort(value: string): value is ProductSortOption {
    return (PRODUCT_SORT_OPTIONS as readonly string[]).includes(value);
}

export function filterAndSortProducts(
    products: readonly Product[],
    filters: ProductFilters = {},
): Product[] {
    let result = products.filter((item) => (filters.onlyAvailable === false ? true : item.available));

    if (filters.categories && filters.categories.length > 0) {
        const selected = new Set(filters.categories);
        result = result.filter((item) => item.categories.some((cat) => selected.has(cat)));
    }

    if (filters.maxPrice !== undefined) {
        const max = filters.maxPrice;
        result = result.filter((item) => item.price <= max);
    }

    const query = filters.search?.trim().toLowerCase();
    if (query) {
        result = result.filter(
            (item) =>
                item.name.toLowerCase().includes(query) ||
                item.description.toLowerCase().includes(query),
        );
    }

    const sorted = [...result];
    const sort = filters.sort ?? DEFAULT_PRODUCT_SORT;

    switch (sort) {
        case "precio-asc":
            sorted.sort((a, b) => a.price - b.price || a.sortOrder - b.sortOrder);
            break;
        case "precio-desc":
            sorted.sort((a, b) => b.price - a.price || a.sortOrder - b.sortOrder);
            break;
        case "nombre-az":
            sorted.sort((a, b) => a.name.localeCompare(b.name, "es"));
            break;
        case "relevancia":
        default:
            sorted.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "es"));
            break;
    }

    return sorted;
}

export interface SeedProductItem {
    id: string;
    name: string;
    price: number;
    categories: ProductCategory[];
    description: string;
    imageUrl: string;
    sortOrder: number;
}

export const INITIAL_PRODUCTS: readonly SeedProductItem[] = [
    {
        id: "fernando",
        name: "Fernando",
        price: 10000,
        categories: ["Entrada"],
        description:
            "Crujientes empanadas de carne desmechada con hogao casero, acompañadas de ají de la casa.",
        imageUrl:
            "https://lh3.googleusercontent.com/aida-public/AB6AXuCXSP_B-LGu-sMyt5QJu1AgpgAXmbzX3nkEDohVFQ0O-C9dXLOWTGSQGnrxJmnXhTrpsoEgizAb-uxK7YZWfZwcXYkMUzp7QTCu8JDbDYEbSNOYttMfvtU_Mk2zvg1wEDFYoZnwzMk61LqyM7gFOR3wpkkL-uk8_q_jelEOPAepyj_tYq6sz3g0kSnH9clcfuOXhXA9rsg8YA2xx2r0VNETWF09CKsY0IFzkraCyKIV-7Dk8JzxH7L_",
        sortOrder: 1,
    },
    {
        id: "silvestre",
        name: "Silvestre",
        price: 10000,
        categories: ["Entrada", "Vegano"],
        description:
            "Rolls de yuca rellenos de vegetales salteados con salsa de aguacate y cilantro fresco.",
        imageUrl:
            "https://lh3.googleusercontent.com/aida-public/AB6AXuA65ruuwar2LWcSQ_Dqx5onp8jQmx1x_LfXraDB9pdu0iwwpQCX3IPrm2gsY3KtTJL9L38kJB1uwW2EC4sEHMT2u_tP4wmtNMviimVdTYlsMd2k3CMSxY7CTicgcMua1Va5woU6e-_IMDAiOxaEExdmd__D-wRUUewYB014bkE0S1htt3XZHH4N-3gHYaeFEb6wKqPJFQ7gtYBCAf5Ct_I7rwa7JPZ4Z2Ja2qMmD2sitWHjyhxh1gh6",
        sortOrder: 2,
    },
    {
        id: "oscar",
        name: "Oscar",
        price: 12000,
        categories: ["Entrada"],
        description:
            "Patacones dorados con ceviche de camarón, limón y un toque de ají dulce colombiano.",
        imageUrl:
            "https://lh3.googleusercontent.com/aida-public/AB6AXuBlRuEeQob8kYjfydnU85W1a9AcjawDYDO3kocXM9Zikg4LoqU8CuAxmEtYLkYv15mu_MI8SPI1Li-bJM2dAaW2bQ6Ra9Ndm6RWbcuQwqciu3__gCnzDROwl4LGWIGgx1Kokn8QCF29wNAL8WTGVkWwvFLk505J_Htbr_B5Kvm2NXp_046er3EQYRv7ZuYrZKfR11562n0SD6FwVQGlspBA5OH-rUcou8S3O6Je7nbf8yrBqCyH2Yqq",
        sortOrder: 3,
    },
    {
        id: "raices",
        name: "Raíces",
        price: 14000,
        categories: ["Entrada"],
        description:
            "Sopa de ajiaco santafereño con pollo desmechado, alcaparras, crema y aguacate.",
        imageUrl:
            "https://lh3.googleusercontent.com/aida-public/AB6AXuCXSP_B-LGu-sMyt5QJu1AgpgAXmbzX3nkEDohVFQ0O-C9dXLOWTGSQGnrxJmnXhTrpsoEgizAb-uxK7YZWfZwcXYkMUzp7QTCu8JDbDYEbSNOYttMfvtU_Mk2zvg1wEDFYoZnwzMk61LqyM7gFOR3wpkkL-uk8_q_jelEOPAepyj_tYq6sz3g0kSnH9clcfuOXhXA9rsg8YA2xx2r0VNETWF09CKsY0IFzkraCyKIV-7Dk8JzxH7L_",
        sortOrder: 4,
    },
    {
        id: "jardin",
        name: "Jardín",
        price: 11000,
        categories: ["Entrada", "Vegano"],
        description:
            "Ensalada fresca de quinoa, mango, aguacate y vinagreta de maracuyá con hierbas del huerto.",
        imageUrl:
            "https://lh3.googleusercontent.com/aida-public/AB6AXuA65ruuwar2LWcSQ_Dqx5onp8jQmx1x_LfXraDB9pdu0iwwpQCX3IPrm2gsY3KtTJL9L38kJB1uwW2EC4sEHMT2u_tP4wmtNMviimVdTYlsMd2k3CMSxY7CTicgcMua1Va5woU6e-_IMDAiOxaEExdmd__D-wRUUewYB014bkE0S1htt3XZHH4N-3gHYaeFEb6wKqPJFQ7gtYBCAf5Ct_I7rwa7JPZ4Z2Ja2qMmD2sitWHjyhxh1gh6",
        sortOrder: 5,
    },
    {
        id: "abuela",
        name: "Abuela",
        price: 18000,
        categories: ["Plato Fuerte"],
        description:
            "Bandeja paisa tradicional con frijoles, arroz, chicharrón, huevo, arepa y maduro.",
        imageUrl:
            "https://lh3.googleusercontent.com/aida-public/AB6AXuBlRuEeQob8kYjfydnU85W1a9AcjawDYDO3kocXM9Zikg4LoqU8CuAxmEtYLkYv15mu_MI8SPI1Li-bJM2dAaW2bQ6Ra9Ndm6RWbcuQwqciu3__gCnzDROwl4LGWIGgx1Kokn8QCF29wNAL8WTGVkWwvFLk505J_Htbr_B5Kvm2NXp_046er3EQYRv7ZuYrZKfR11562n0SD6FwVQGlspBA5OH-rUcou8S3O6Je7nbf8yrBqCyH2Yqq",
        sortOrder: 6,
    },
    {
        id: "tradicion",
        name: "Tradición",
        price: 20000,
        categories: ["Plato Fuerte"],
        description: "Lomo de cerdo en salsa de tamarindo con arroz de coco y ensalada tropical.",
        imageUrl:
            "https://lh3.googleusercontent.com/aida-public/AB6AXuAEZqMeTahwGjtsXqlq_bwYCZx0vzL4gi3uvXtvQE5YVnUg57_Yvh8CFDn2JJ8EYdZVluqsupZoa8ObBT0YFCpgTPIS-lmRNCHEOpKJKa5dJOVO0NU_kLGDO0ItvanzI_28rmvuxgug-kXLkaVMx7yLOKoTll7qS7VQXoqttIH-nxrGsNyjBc8W4vWW7OvLxOrjz9er0fgXEarf30s9vuyEJsJxxHvN9dBzo1i5jb9Zcqd4_z42aUsN",
        sortOrder: 7,
    },
    {
        id: "montana",
        name: "Montaña",
        price: 25000,
        categories: ["Plato Fuerte", "Especial del Día"],
        description:
            "Trucha arcoíris de río con papa criolla dorada, ensalada campesina y limón.",
        imageUrl:
            "https://lh3.googleusercontent.com/aida-public/AB6AXuCXSP_B-LGu-sMyt5QJu1AgpgAXmbzX3nkEDohVFQ0O-C9dXLOWTGSQGnrxJmnXhTrpsoEgizAb-uxK7YZWfZwcXYkMUzp7QTCu8JDbDYEbSNOYttMfvtU_Mk2zvg1wEDFYoZnwzMk61LqyM7gFOR3wpkkL-uk8_q_jelEOPAepyj_tYq6sz3g0kSnH9clcfuOXhXA9rsg8YA2xx2r0VNETWF09CKsY0IFzkraCyKIV-7Dk8JzxH7L_",
        sortOrder: 8,
    },
    {
        id: "aguapanela",
        name: "Aguapanela",
        price: 5000,
        categories: ["Bebida"],
        description:
            "Aguapanela artesanal con limón, preparada con panela orgánica de caña de la región.",
        imageUrl:
            "https://lh3.googleusercontent.com/aida-public/AB6AXuA65ruuwar2LWcSQ_Dqx5onp8jQmx1x_LfXraDB9pdu0iwwpQCX3IPrm2gsY3KtTJL9L38kJB1uwW2EC4sEHMT2u_tP4wmtNMviimVdTYlsMd2k3CMSxY7CTicgcMua1Va5woU6e-_IMDAiOxaEExdmd__D-wRUUewYB014bkE0S1htt3XZHH4N-3gHYaeFEb6wKqPJFQ7gtYBCAf5Ct_I7rwa7JPZ4Z2Ja2qMmD2sitWHjyhxh1gh6",
        sortOrder: 9,
    },
    {
        id: "limonada-de-coco",
        name: "Limonada de Coco",
        price: 7000,
        categories: ["Bebida"],
        description:
            "Refrescante limonada natural con leche de coco y hierbabuena, servida bien fría.",
        imageUrl:
            "https://lh3.googleusercontent.com/aida-public/AB6AXuBlRuEeQob8kYjfydnU85W1a9AcjawDYDO3kocXM9Zikg4LoqU8CuAxmEtYLkYv15mu_MI8SPI1Li-bJM2dAaW2bQ6Ra9Ndm6RWbcuQwqciu3__gCnzDROwl4LGWIGgx1Kokn8QCF29wNAL8WTGVkWwvFLk505J_Htbr_B5Kvm2NXp_046er3EQYRv7ZuYrZKfR11562n0SD6FwVQGlspBA5OH-rUcou8S3O6Je7nbf8yrBqCyH2Yqq",
        sortOrder: 10,
    },
    {
        id: "mariela",
        name: "Mariela",
        price: 12000,
        categories: ["Postre"],
        description:
            "Tres leches de arequipe con canela y frutos rojos frescos de la cosecha local.",
        imageUrl:
            "https://lh3.googleusercontent.com/aida-public/AB6AXuAEZqMeTahwGjtsXqlq_bwYCZx0vzL4gi3uvXtvQE5YVnUg57_Yvh8CFDn2JJ8EYdZVluqsupZoa8ObBT0YFCpgTPIS-lmRNCHEOpKJKa5dJOVO0NU_kLGDO0ItvanzI_28rmvuxgug-kXLkaVMx7yLOKoTll7qS7VQXoqttIH-nxrGsNyjBc8W4vWW7OvLxOrjz9er0fgXEarf30s9vuyEJsJxxHvN9dBzo1i5jb9Zcqd4_z42aUsN",
        sortOrder: 11,
    },
    {
        id: "dulce-hogar",
        name: "Dulce Hogar",
        price: 8000,
        categories: ["Postre", "Vegano"],
        description:
            "Mousse de maracuyá vegano con base de coco rallado y coulis de frutos tropicales.",
        imageUrl:
            "https://lh3.googleusercontent.com/aida-public/AB6AXuCXSP_B-LGu-sMyt5QJu1AgpgAXmbzX3nkEDohVFQ0O-C9dXLOWTGSQGnrxJmnXhTrpsoEgizAb-uxK7YZWfZwcXYkMUzp7QTCu8JDbDYEbSNOYttMfvtU_Mk2zvg1wEDFYoZnwzMk61LqyM7gFOR3wpkkL-uk8_q_jelEOPAepyj_tYq6sz3g0kSnH9clcfuOXhXA9rsg8YA2xx2r0VNETWF09CKsY0IFzkraCyKIV-7Dk8JzxH7L_",
        sortOrder: 12,
    },
];
