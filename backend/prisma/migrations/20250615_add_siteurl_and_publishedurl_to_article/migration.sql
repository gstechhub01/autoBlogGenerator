-- AlterTable
ALTER TABLE "Article"
ADD COLUMN "siteUrl" TEXT,
ADD COLUMN "publishedUrl" TEXT;

-- Set a default value for existing rows to avoid NOT NULL constraint errors
UPDATE "Article" SET "siteUrl" = 'unknown' WHERE "siteUrl" IS NULL;
