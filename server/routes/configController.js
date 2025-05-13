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

// POST /api/save-config (append new config)
router.post('/save-config', (req, res) => {
  try {
    ensureConfigFile();
    const config = req.body;
    const configs = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));

    const newConfig = {
      ...config,
      id: uuidv4(),
      hasRun: false,
    };

    configs.push(newConfig);
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2), 'utf-8');

    res.status(200).json({ success: true, message: 'Config saved.', config: newConfig });
  } catch (err) {
    console.error('❌ Error saving config:', err);
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

export default router;
