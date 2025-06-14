-- AlterTable
ALTER TABLE "BlogConfig" 
  ADD COLUMN "status" VARCHAR(16) DEFAULT 'pending',
  ADD COLUMN "processingLog" JSONB,
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "finishedAt" TIMESTAMP(3);

-- Optionally, create an enum for status if you want stricter typing in Prisma
-- CREATE TYPE "BlogConfigStatus" AS ENUM ('pending', 'running', 'finished', 'error');
-- ALTER TABLE "BlogConfig" ADD COLUMN "status" "BlogConfigStatus" DEFAULT 'pending';
