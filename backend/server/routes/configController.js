import express from 'express';
import prisma from '../database.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// POST /api/save-config (create new blog config)
router.post('/save-config', async (req, res) => {
  try {
    const config = req.body;
    const userId = req.user?.userId || config.userId || 1; // Use userId from token if available
    // Save config to BlogConfig table
    const newConfig = await prisma.blogConfig.create({
      data: {
        userId,
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
// POST /api/save-site (add a new site config to DB)
router.post('/save-site', async (req, res) => {
  try {
    const { name, url } = req.body;
    const userId = req.user?.userId || req.body.userId || 1;
    const site = await prisma.siteConfig.create({
      data: { name, url, userId },
    });
    res.status(200).json({ success: true, site });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/sites (get all site configs from DB)
router.get('/sites', async (req, res) => {
  try {
    const sites = await prisma.siteConfig.findMany();
    res.status(200).json({ success: true, sites });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/site-configs (fetch all site configs from DB)
router.get('/site-configs', async (req, res) => {
  try {
    const siteConfigs = await prisma.siteConfig.findMany();
    res.status(200).json({ success: true, siteConfigs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/save-site-configs (save or update multiple site configs)
router.post('/save-site-configs', async (req, res) => {
  try {
    const { sites } = req.body;
    if (!Array.isArray(sites)) {
      return res.status(400).json({ success: false, error: 'Sites must be an array' });
    }
    // Upsert each site config (by url+username)
    const results = [];
    for (const site of sites) {
      if (!site.url || !site.username) continue;
      const upserted = await prisma.siteConfig.upsert({
        where: {
          url_username: {
            url: site.url,
            username: site.username
          }
        },
        update: {
          password: site.password,
          name: site.name || site.url // fallback to url if name not provided
        },
        create: {
          url: site.url,
          username: site.username,
          password: site.password,
          name: site.name || site.url, // fallback to url if name not provided
          userId: req.user?.userId || 1
        }
      });
      results.push(upserted);
    }
    res.status(200).json({ success: true, siteConfigs: results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
