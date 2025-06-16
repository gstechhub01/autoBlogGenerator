import express from 'express';
import { scrapeWithPuppeteer } from '../../models/scrappers/scrapperBot.js';

const router = express.Router();

router.post('/api/scrape', async (req, res) => {
  const { query, engine } = req.body;
  if (!query || !engine) {
    return res.status(400).json({ success: false, error: 'Missing query or engine' });
  }
  try {
    const result = await scrapeWithPuppeteer(query, engine);
    res.status(200).json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
