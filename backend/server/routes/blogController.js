import prisma from '../database.js';
import fs from 'fs';
import path from 'path';
import { generateBlogJSON } from '../../models/openai-content-mo-four.js';
import { convertBlogJSONToMarkdown } from '../../util/markdowncoonverter.js';
import { publishToWordPress } from '../../publisher/wp-publisher.js';
import express from 'express';

const router = express.Router();

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

export async function generateAndPublish(req, res) {
  const configPath = path.join('config', 'blog-config.json');

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const {
      sites,
      keywords,
      links,
      tags,
      topics,
      autoTitle,
      articleCount,
    } = config;

    ensureDir('output');

    const results = [];

    for (let i = 0; i < articleCount; i++) {
      const keyword = keywords[i % keywords.length];
      const link = links[i % links.length];
      const topic = topics[i % topics.length] || `Topic for "${keyword}"`;
      const title = autoTitle ? `${keyword} - Expert Insight` : topic;

      const blogJSON = await generateBlogJSON({ title, keyword, link });
      const blogFileName = `blog-${Date.now()}-${i + 1}`;

      fs.writeFileSync(`output/${blogFileName}.json`, JSON.stringify(blogJSON, null, 2), 'utf-8');

      const markdown = convertBlogJSONToMarkdown(blogJSON);
      fs.writeFileSync(`output/${blogFileName}.md`, markdown, 'utf-8');

      const publishResults = [];
      for (const site of sites) {
        const response = await publishToWordPress(blogJSON, site);
        publishResults.push({ site: site.url, response });
      }

      results.push({
        title,
        file: `${blogFileName}.json`,
        publishResults,
      });
    }

    res.status(200).json({ success: true, results });
  } catch (err) {
    console.error('❌ Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// GET /api/published-posts (get all published articles)
router.get('/published-posts', async (req, res) => {
  try {
    // Fetch all articles (optionally filter by publishedAt or other logic if needed)
    const articles = await prisma.article.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, name: true } }
      }
    });
    // Format for frontend
    const posts = articles.map(article => ({
      id: article.id,
      title: article.title,
      body: article.body,
      image: article.image,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
      user: article.user,
    }));
    res.status(200).json({ success: true, posts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
