/*
  Warnings:

  - Changed the type of `sites` on the `BlogConfig` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `links` on the `BlogConfig` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `tags` on the `BlogConfig` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `topics` on the `BlogConfig` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "BlogConfig" DROP COLUMN "sites",
ADD COLUMN     "sites" JSONB NOT NULL,
DROP COLUMN "links",
ADD COLUMN     "links" JSONB NOT NULL,
DROP COLUMN "tags",
ADD COLUMN     "tags" JSONB NOT NULL,
DROP COLUMN "topics",
ADD COLUMN     "topics" JSONB NOT NULL;
