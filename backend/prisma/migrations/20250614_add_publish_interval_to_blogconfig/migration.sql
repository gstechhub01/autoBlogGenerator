-- AlterTable
ALTER TABLE "BlogConfig" 
  ADD COLUMN "publishIntervalMinutes" INTEGER,
  ADD COLUMN "lastPublishedAt" TIMESTAMP(3);
