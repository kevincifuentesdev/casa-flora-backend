export const ORDER_STATUSES = [
    "pending",
    "preparing",
    "delivered",
    "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_VERIFICATION_STATUSES = [
    "approved",
    "pending",
    "rejected",
] as const;
export type PaymentVerificationStatus =
    (typeof PAYMENT_VERIFICATION_STATUSES)[number];

export const DELIVERY_METHODS = ["pickup", "delivery"] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

export interface OrderItem {
    id: string;
    orderId: string;
    productId: string;
    productName: string;
    productDescription: string;
    productImageUrl: string;
    unitPrice: number;
    quantity: number;
}

export interface OrderCustomerSummary {
    id: string;
    name: string;
    email: string;
    username: string | null;
    points: number;
}

export interface Order {
    id: string;
    orderNumber: number;
    userId: string;
    addressLabel: string;
    paymentSummary: string;
    totalAmount: number;
    pointsEarned: number;
    status: OrderStatus;
    items: OrderItem[];
    customer?: OrderCustomerSummary;
    createdAt: Date;
    updatedAt: Date;
}
