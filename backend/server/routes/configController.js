import express from 'express';
import prisma from '../database.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// POST /api/save-config (create new blog config)
router.post('/save-config', async (req, res) => {
  try {
    const config = req.body;
    // Save config to BlogConfig table
    const newConfig = await prisma.blogConfig.create({
      data: {
        userId: config.userId || 1, // TODO: Replace with real user auth
        sites: JSON.stringify(config.sites || []),
        keywords: JSON.stringify(config.topics || []),
        links: JSON.stringify(config.links || []),
        tags: JSON.stringify(config.tags || []),
        topics: JSON.stringify(config.topics || []),
        autoTitle: config.autoTitle ?? true,
        articleCount: config.articleCount || 1,
        keywordsPerArticle: config.keywordsPerArticle || 1,
      },
    });
    res.status(200).json({ success: true, message: 'Blog config saved.', config: newConfig });
  } catch (err) {
    console.error('❌ Error saving blog config:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/configs (get all blog configs)
router.get('/configs', async (req, res) => {
  try {
    const configs = await prisma.blogConfig.findMany();
    res.status(200).json({ success: true, configs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/config/:id (get a single config)
router.get('/config/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const config = await prisma.blogConfig.findUnique({ where: { id: Number(id) } });
    if (!config) {
      return res.status(404).json({ success: false, error: 'Config not found' });
    }
    res.status(200).json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/delete-published/:id (delete a published blog config by id)
router.delete('/delete-published/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.blogConfig.delete({ where: { id: Number(id) } });
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/delete-all-published (delete all published blog configs)
router.delete('/delete-all-published', async (req, res) => {
  try {
    await prisma.blogConfig.deleteMany({});
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// SiteConfig CRUD (example: add more as needed)
router.post('/save-site', async (req, res) => {
  try {
    const { name, url, userId } = req.body;
    const site = await prisma.siteConfig.create({
      data: { name, url, userId: userId || 1 },
    });
    res.status(200).json({ success: true, site });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/sites', async (req, res) => {
  try {
    const sites = await prisma.siteConfig.findMany();
    res.status(200).json({ success: true, sites });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
