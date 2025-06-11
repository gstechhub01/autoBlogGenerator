import express from 'express';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

const CONFIG_DIR = path.join(process.cwd(), 'config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'blog-configs.json');

// Ensure config directory and file exist
function ensureConfigFile() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, '[]', 'utf-8'); // Start with empty array
  }
}

// POST /api/save-config (append new blog config)
router.post('/save-config', (req, res) => {
  try {
    ensureConfigFile();
    const config = req.body;
    const configs = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));

    // Accept contentSource and engine from frontend
    const newConfig = {
      ...config,
      contentSource: config.contentSource || 'openai', // 'openai' or 'scrapper'
      engine: config.engine || null, // e.g., 'google', 'bing', etc. if scrapper
      id: uuidv4(),
      hasRun: false,
    };

    configs.push(newConfig);
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2), 'utf-8');

    res.status(200).json({ success: true, message: 'Blog config saved.', config: newConfig });
  } catch (err) {
    console.error('❌ Error saving blog config:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/configs (return all)
router.get('/configs', (req, res) => {
  try {
    ensureConfigFile();
    const configs = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    res.status(200).json({ success: true, configs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/site-configs (return all site configs)
router.get('/site-configs', (req, res) => {
  try {
    const siteConfigPath = path.join(CONFIG_DIR, 'site-configs.json');
    if (!fs.existsSync(siteConfigPath)) {
      fs.writeFileSync(siteConfigPath, '[]', 'utf-8');
    }
    const siteConfigs = JSON.parse(fs.readFileSync(siteConfigPath, 'utf-8'));
    res.status(200).json({ success: true, siteConfigs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/save-site-configs (save all site configs)
router.post('/save-site-configs', (req, res) => {
  try {
    const siteConfigPath = path.join(CONFIG_DIR, 'site-configs.json');
    const { sites } = req.body;
    if (!Array.isArray(sites)) {
      return res.status(400).json({ success: false, error: 'Sites must be an array.' });
    }
    // Read existing configs
    let existingSites = [];
    if (fs.existsSync(siteConfigPath)) {
      existingSites = JSON.parse(fs.readFileSync(siteConfigPath, 'utf-8'));
    }
    // Merge: keep unique by url+username
    const mergedSites = [...existingSites];
    for (const newSite of sites) {
      const exists = mergedSites.some(site => site.url === newSite.url && site.username === newSite.username);
      if (!exists) {
        mergedSites.push(newSite);
      }
    }
    fs.writeFileSync(siteConfigPath, JSON.stringify(mergedSites, null, 2), 'utf-8');
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/publish-log/:id (get publish log and status for a config)
router.get('/publish-log/:id', (req, res) => {
  try {
    ensureConfigFile();
    const { id } = req.params;
    const configs = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    const config = configs.find(c => c.id === id);
    if (!config) {
      return res.status(404).json({ success: false, error: 'Config not found' });
    }
    res.status(200).json({
      success: true,
      publishLog: config.publishLog || [],
      published: config.published || false,
      publishedUrl: config.publishedUrl || null,
      hasRun: config.hasRun || false,
      lastError: config.lastError || null,
      scheduleTime: config.scheduleTime || null
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/published-posts (return all published posts with URLs and site info)
router.get('/published-posts', (req, res) => {
  try {
    ensureConfigFile();
    const configs = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    // Flatten all publishLog entries with status 'success' and a postUrl
    const posts = [];
    configs.forEach(cfg => {
      if (Array.isArray(cfg.publishLog)) {
        cfg.publishLog.forEach(log => {
          if (log.status === 'success' && log.postUrl) {
            posts.push({
              title: (cfg.keywords && cfg.keywords.length > 0) ? cfg.keywords[0] : 'Untitled',
              siteUrl: log.siteUrl,
              postUrl: log.postUrl,
              publishedAt: log.timestamp
            });
          }
        });
      }
    });
    res.status(200).json({ success: true, posts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/delete-published/:id (delete a published blog config by id)
router.delete('/delete-published/:id', (req, res) => {
  try {
    ensureConfigFile();
    const { id } = req.params;
    let configs = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    const initialLength = configs.length;
    configs = configs.filter(cfg => cfg.id !== id);
    if (configs.length === initialLength) {
      return res.status(404).json({ success: false, error: 'Config not found' });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2), 'utf-8');
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/delete-all-published (delete all published blog configs)
router.delete('/delete-all-published', (req, res) => {
  try {
    ensureConfigFile();
    let configs = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    const initialLength = configs.length;
    configs = configs.filter(cfg => !cfg.hasRun);
    if (configs.length === initialLength) {
      return res.status(404).json({ success: false, error: 'No published configs found' });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2), 'utf-8');
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
