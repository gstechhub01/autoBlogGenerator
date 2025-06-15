/*
  Warnings:

  - Made the column `siteUrl` on table `Article` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Article" ALTER COLUMN "siteUrl" SET NOT NULL;
