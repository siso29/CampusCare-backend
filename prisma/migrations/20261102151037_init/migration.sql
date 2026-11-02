-- CreateEnum
CREATE TYPE "RequestCategory" AS ENUM ('WATER_SUPPLY', 'ELECTRICITY', 'PLUMBING', 'CLEANING', 'CLASSROOM_EQUIPMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "RequestPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'RESOLVED');

-- CreateTable
CREATE TABLE "maintenance_requests" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "RequestCategory" NOT NULL,
    "location" TEXT NOT NULL,
    "priority" "RequestPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "image_url" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "maintenance_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "maintenance_requests_status_idx" ON "maintenance_requests"("status");

-- CreateIndex
CREATE INDEX "maintenance_requests_priority_idx" ON "maintenance_requests"("priority");

-- CreateIndex
CREATE INDEX "maintenance_requests_created_at_idx" ON "maintenance_requests"("created_at");
