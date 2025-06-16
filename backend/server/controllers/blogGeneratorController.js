import express from 'express';
import { getAllKeywords } from '../database.js';
import prisma from '../database.js';
import { generateAndPublishService } from '../services/blogGeneratorService.js';

const router = express.Router();

// POST /api/generate-and-publish
export async function generateAndPublish(req, res) {
  try {
    // Always treat req.body as the full, sanitized config
    const parsedConfig = {
      ...req.body,
      sites: typeof req.body.sites === 'string' ? JSON.parse(req.body.sites) : req.body.sites,
      links: typeof req.body.links === 'string' ? JSON.parse(req.body.links) : req.body.links,
      tags: typeof req.body.tags === 'string' ? JSON.parse(req.body.tags) : req.body.tags,
      topics: typeof req.body.topics === 'string' ? JSON.parse(req.body.topics) : req.body.topics,
      contentSource: req.body.contentSource || 'openai',
      engine: req.body.engine || undefined,
    };
    // Call service with parsed config
    const result = await generateAndPublishService(parsedConfig);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('❌ Error in generateAndPublish:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// Bulk save keywords API
router.post('/bulk-save-keywords', async (req, res) => {
  try {
    const { keywords, scheduledTime, userId } = req.body;
    if (!Array.isArray(keywords)) {
      return res.status(400).json({ success: false, error: 'Missing keywords' });
    }
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Missing userId' });
    }
    // Save keywords using Prisma
    const created = await Promise.all(keywords.map(keyword =>
      prisma.keyword.create({ data: { keyword, published: false, publishedOn: [], userId, configId: null, createdAt: new Date(), updatedAt: new Date(), scheduledTime: scheduledTime ? new Date(scheduledTime) : null } })
    ));
    res.status(200).json({ success: true, message: 'Keywords saved.', created });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API to get count of unpublished keywords for a site
router.get('/unpublished-keywords-count', async (req, res) => {
  try {
    const count = await prisma.keyword.count({ where: { published: false } });
    res.status(200).json({ success: true, count });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API to get all saved keywords
router.get('/all-keywords', async (req, res) => {
  try {
    const keywords = await getAllKeywords();
    res.status(200).json({ success: true, keywords });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
