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

// Get unpublished keywords with optional filters
export async function getUnpublishedKeywords({ siteUrl, configId, limit = 5 } = {}) {
  const where = { published: false };
  if (siteUrl) where.site = siteUrl;
  if (configId) where.configId = configId;
  return prisma.keyword.findMany({ where, take: limit });
}

// Mark keyword as published by keyword and site
export async function markKeywordPublishedByKeywordAndSite(keyword, siteUrl) {
  return prisma.keyword.updateMany({
    where: { keyword, site: siteUrl },
    data: { published: true, publishedOn: { push: new Date() }, updatedAt: new Date() }
  });
}

// Add other functions as needed for articles, configs, etc.

export default prisma;
