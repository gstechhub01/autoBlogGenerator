/*
  Warnings:

  - You are about to drop the column `keywords` on the `BlogConfig` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "BlogConfig" DROP COLUMN "keywords",
ADD COLUMN     "keywordsPerArticle" INTEGER;

-- CreateTable
CREATE TABLE "Keyword" (
    "id" SERIAL NOT NULL,
    "keyword" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "publishedOn" TEXT[],
    "userId" INTEGER NOT NULL,
    "configId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Keyword_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Keyword" ADD CONSTRAINT "Keyword_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Keyword" ADD CONSTRAINT "Keyword_configId_fkey" FOREIGN KEY ("configId") REFERENCES "BlogConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
