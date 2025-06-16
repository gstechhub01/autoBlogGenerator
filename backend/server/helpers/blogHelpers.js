// blogHelpers.js
// Helper functions for blog generation and publishing

import prisma from '../database.js';

// Resolve sites from DB
// Helper: resolve sites from DB, only return those with publishingAvailable !== false
export async function resolveSites(siteIdentifiers) {
  if (!siteIdentifiers?.length) {
    return await prisma.siteConfig.findMany({ where: { publishingAvailable: true } });
  }
  const urls = siteIdentifiers.map(s =>
    typeof s === 'string' ? s : s?.url
  ).filter(Boolean);
  if (!urls.length) {
    return await prisma.siteConfig.findMany({ where: { publishingAvailable: true } });
  }
  return await prisma.siteConfig.findMany({ where: { url: { in: urls }, publishingAvailable: true } });
}

// Replace keyword with anchor in text
export function replaceKeywordWithAnchor(text, selectedKeywords, anchorTag) {
  if (!text) return '';
  let replaced = text;
  selectedKeywords.forEach(kw => {
    const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'gi');
    replaced = replaced.replace(regex, anchorTag);
  });
  return replaced;
}
