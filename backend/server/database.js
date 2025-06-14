import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Example: Fetch all keywords
export async function getAllKeywords() {
  return prisma.keyword.findMany();
}

// Example: Save a new keyword
export async function saveKeyword(data) {
  return prisma.keyword.create({ data });
}

// Example: Mark keyword as published
export async function markKeywordPublished(id) {
  return prisma.keyword.update({ where: { id }, data: { published: true } });
}

// Example: Get unpublished keywords
export async function getUnpublishedKeywords() {
  return prisma.keyword.findMany({ where: { published: false } });
}

// Add other functions as needed for articles, configs, etc.

export default prisma;
