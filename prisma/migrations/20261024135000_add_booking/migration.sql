CREATE TABLE "booking" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "environment" VARCHAR(16) NOT NULL,
    "date" VARCHAR(10) NOT NULL,
    "time" VARCHAR(5) NOT NULL,
    "diners" INTEGER NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'confirmed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "booking_environment_check" CHECK ("environment" IN ('interior', 'patio')),
    CONSTRAINT "booking_time_check" CHECK ("time" IN ('13:00', '14:30', '19:00', '20:30')),
    CONSTRAINT "booking_diners_check" CHECK ("diners" BETWEEN 1 AND 10),
    CONSTRAINT "booking_status_check" CHECK ("status" IN ('confirmed', 'cancelled'))
);

CREATE INDEX "booking_userId_date_idx" ON "booking"("userId", "date");

CREATE INDEX "booking_date_time_environment_status_idx" ON "booking"("date", "time", "environment", "status");

ALTER TABLE "booking" ADD CONSTRAINT "booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

