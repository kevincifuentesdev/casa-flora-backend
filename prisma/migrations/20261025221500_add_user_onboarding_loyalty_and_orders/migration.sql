ALTER TABLE "user"
ADD COLUMN "points" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "dietPreference" VARCHAR(24),
ADD COLUMN "spiceTolerance" VARCHAR(24),
ADD COLUMN "favoriteMoment" VARCHAR(24);

CREATE TABLE "user_address" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" VARCHAR(40) NOT NULL,
    "addressLine" VARCHAR(160) NOT NULL,
    "neighborhood" VARCHAR(80) NOT NULL,
    "city" VARCHAR(80) NOT NULL DEFAULT 'Medellín, Antioquia',
    "details" VARCHAR(160),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_address_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_method" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" VARCHAR(24) NOT NULL,
    "brand" VARCHAR(40) NOT NULL,
    "lastFour" VARCHAR(4),
    "holderName" VARCHAR(80),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_method_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_order" (
    "id" TEXT NOT NULL,
    "orderNumber" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "addressLabel" VARCHAR(120) NOT NULL,
    "paymentSummary" VARCHAR(80) NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "pointsEarned" INTEGER NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'delivered',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_order_item" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productDescription" TEXT NOT NULL,
    "productImageUrl" TEXT NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "customer_order_item_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_address_userId_idx" ON "user_address"("userId");

CREATE INDEX "payment_method_userId_idx" ON "payment_method"("userId");

CREATE INDEX "customer_order_userId_createdAt_idx" ON "customer_order"("userId", "createdAt");

CREATE INDEX "customer_order_item_orderId_idx" ON "customer_order_item"("orderId");

ALTER TABLE "user_address" ADD CONSTRAINT "user_address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_method" ADD CONSTRAINT "payment_method_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_order" ADD CONSTRAINT "customer_order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_order_item" ADD CONSTRAINT "customer_order_item_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "customer_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
