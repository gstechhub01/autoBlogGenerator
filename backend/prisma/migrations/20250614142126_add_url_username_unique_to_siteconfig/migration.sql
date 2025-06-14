/*
  Warnings:

  - A unique constraint covering the columns `[url,username]` on the table `SiteConfig` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `password` to the `SiteConfig` table without a default value. This is not possible if the table is not empty.
  - Added the required column `username` to the `SiteConfig` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SiteConfig" ADD COLUMN     "password" TEXT NOT NULL,
ADD COLUMN     "username" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "SiteConfig_url_username_key" ON "SiteConfig"("url", "username");
