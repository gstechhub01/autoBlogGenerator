-- AlterTable
ALTER TABLE "BlogConfig" ADD COLUMN     "contentSource" TEXT DEFAULT 'openai',
ADD COLUMN     "engine" TEXT;
