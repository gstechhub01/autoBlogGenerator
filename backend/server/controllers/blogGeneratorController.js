import { publishToWordPress } from '../../publisher/wp-publisher.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { scrapeWithPuppeteer } from '../../models/scrapperBot.js';
import { generateBlogJSON } from '../../models/openai-content-mo-four.js';
import { bulkSaveKeywords, markKeywordPublished, getUnpublishedKeywords } from '../database.js';
import express from 'express';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_FILE = path.join(__dirname, '..', '..', 'config', 'blog-configs.json');
const SITE_CONFIG_FILE = path.join(__dirname, '..', '..', 'config', 'site-configs.json');
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'output');

function readJSON(filePath, fallback = []) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (e) {
    console.error(`[Read Error] ${filePath}:`, e.message);
  }
  return fallback;
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function resolveSites(siteIdentifiers, allSites) {
  return siteIdentifiers?.length
    ? siteIdentifiers.map(id => allSites.find(cfg => cfg.url === id.url && cfg.username === id.username)).filter(Boolean)
    : allSites;
}

function findOrCreateConfig(configs, reqBody, matchedSites) {
  const {
    id, keywords, links, tags, topics, autoTitle, articleCount, scheduleTime, keywordsPerArticle
  } = reqBody;

  let config = configs.find(c => c.id === id) ||
    configs.find(c =>
      JSON.stringify(c.keywords) === JSON.stringify(keywords) &&
      JSON.stringify(c.links) === JSON.stringify(links) &&
      JSON.stringify(c.tags) === JSON.stringify(tags) &&
      JSON.stringify(c.topics) === JSON.stringify(topics)
    );

  if (!config) {
    config = {
      id: id || Math.random().toString(36).slice(2),
      keywords, links, tags, topics, autoTitle,
      articleCount, scheduleTime, keywordsPerArticle: keywordsPerArticle || 1,
      hasRun: false, published: false,
      publishedUrl: null, publishedUrls: [],
      publishLog: [], lastError: null,
      articles: [], sites: matchedSites
    };
    configs.push(config);
  }

  return { config, index: configs.findIndex(c => c.id === config.id) };
}

// Main article processing function
async function processArticle(config, i, sites) {
  // Fetch up to 5 unpublished keywords for the site
  let selectedKeywords = [];
  let publishingKeyword = '';
  let site = sites[0]?.url || '';
  await new Promise((resolve) => {
    getUnpublishedKeywords(site, 5, (err, rows) => {
      if (!err && rows && rows.length > 0) {
        selectedKeywords = rows.map(r => r.keyword);
        publishingKeyword = selectedKeywords[0];
      } else {
        // fallback to config.keywords
        selectedKeywords = config.keywords.slice(0, 5);
        publishingKeyword = selectedKeywords[0];
      }
      resolve();
    });
  });

  const keywordLinks = selectedKeywords.slice(0, 5);
  const keyword = publishingKeyword;
  const link = config.links[i % config.links.length];
  const topic = config.topics && config.topics.length > 0 ? config.topics[i % config.topics.length] : keyword;
  const title = config.autoTitle ? null : topic;
  let blogJSON = null;

  if (config.contentSource === 'scrapper') {
    const engine = config.engine || 'google';
    console.log(`[Scrapper] Generating article for keywords: ${keyword}, engine: ${engine}`);
    const scraped = await scrapeWithPuppeteer(keyword, engine);
    // Prepare anchor tag for replacement
    const anchorTag = link ? `<a href="${link}" target="_blank" rel="noopener noreferrer">${keyword}</a>` : keyword;
    function replaceKeywordWithAnchor(text) {
      if (!text) return '';
      let replaced = text;
      selectedKeywords.forEach(kw => {
        const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'gi');
        replaced = replaced.replace(regex, anchorTag);
      });
      return replaced;
    }
    const sections = (scraped.qa || []).map(q => ({
      heading: q.question,
      body: replaceKeywordWithAnchor(q.answer),
      image: q.image || ''
    }));
    let excerpt = '';
    if (sections.length > 0) {
      excerpt = sections[0].body.replace(/<[^>]+>/g, '').slice(0, 160);
    }
    blogJSON = {
      title: scraped.title || topic,
      targetKeyword: keyword,
      targetLink: link,
      excerpt,
      tags: config.tags || [],
      headings: (scraped.qa || []).map(q => q.question),
      sections,
      conclusion: scraped.qa && scraped.qa.length > 0 ? replaceKeywordWithAnchor(scraped.qa[scraped.qa.length - 1].answer) : ''
    };
  } else if (config.contentSource === 'openai') {
    // Pass publishing and in-article keyword/link rules to OpenAI
    const openAIPromptRules = `\nRules:\n- Use the publishing keyword: \"${keyword}\" for the main anchor link.\n- Use up to 5 in-article keywords: ${keywordLinks.join(', ')} as context/SEO, but only the publishing keyword should be hyperlinked.\n- Do not exceed 5 keyword links in the article.\n- Each keyword should appear naturally.\n- Follow all other formatting rules as before.`;
    blogJSON = await generateBlogJSON({ title: title || undefined, keyword, link, extraPrompt: openAIPromptRules });
    blogJSON.targetKeyword = keyword;
    blogJSON.targetLink = link;
    blogJSON.tags = config.tags || [];
  }

  // Mark publishing keyword as published
  markKeywordPublished(keyword, site);

  if (!blogJSON) {
    blogJSON = {
      title: title || keyword,
      targetKeyword: keyword,
      targetLink: link,
      excerpt: '',
      tags: config.tags || [],
      headings: [],
      sections: [],
      conclusion: ''
    };
  }

  const timestamp = Date.now();
  const fileBase = `blog-${timestamp}-${i + 1}`;
  const filePath = `${OUTPUT_DIR}/${fileBase}.json`;
  fs.writeFileSync(filePath, JSON.stringify(blogJSON, null, 2), 'utf-8');

  let articles = [], publishLog = [], publishedUrls = [], publishedAny = false;

  for (const site of sites) {
    try {
      const wpRes = await publishToWordPress(blogJSON, site);
      const url = wpRes.link || null;
      articles.push({
        title: blogJSON.title,
        keyword,
        file: fileBase,
        site: site.url,
        url
      });
      publishLog.push({
        timestamp: new Date().toISOString(),
        status: 'success',
        siteUrl: site.url,
        postUrl: url,
        error: null
      });
      publishedUrls.push({ siteUrl: site.url, url });
      publishedAny = true;
    } catch (err) {
      const errorMsg = err.message || 'Unknown error';
      articles.push({
        title: blogJSON.title,
        keyword,
        file: fileBase,
        site: site.url,
        error: errorMsg
      });
      publishLog.push({
        timestamp: new Date().toISOString(),
        status: 'error',
        siteUrl: site.url,
        postUrl: null,
        error: errorMsg
      });
    }
  }

  return { articles, publishLog, publishedUrls, publishedAny };
}

export async function generateAndPublishFromConfig(req, res) {
  try {
    // Load configs and sites
    const configs = readJSON(CONFIG_FILE, []);
    const allSites = readJSON(SITE_CONFIG_FILE, []);
    const reqBody = req.body;
    const matchedSites = resolveSites(reqBody.sites, allSites);
    const { config, index } = findOrCreateConfig(configs, reqBody, matchedSites);

    // Generate/publish articles
    let allArticles = [], allLogs = [], allUrls = [], publishedAny = false;
    for (let i = 0; i < (config.articleCount || 1); i++) {
      const { articles, publishLog, publishedUrls, publishedAny: anyPublished } = await processArticle({ ...config, ...reqBody }, i, matchedSites);
      allArticles.push(...articles);
      allLogs.push(...publishLog);
      allUrls.push(...publishedUrls);
      if (anyPublished) publishedAny = true;
    }

    // Strictly update config to match the required pattern
    const updatedConfig = {
      sites: config.sites,
      keywords: config.keywords,
      links: config.links,
      tags: config.tags,
      topics: config.topics,
      autoTitle: config.autoTitle,
      articleCount: config.articleCount,
      contentSource: config.contentSource,
      engine: config.engine,
      id: config.id,
      hasRun: true,
      publishLog: allLogs,
      publishedUrls: allUrls,
      publishedUrl: allUrls.length > 0 ? allUrls[allUrls.length - 1].url : null,
      published: publishedAny,
      lastError: publishedAny ? null : (allArticles.find(a => a.error)?.error || null)
    };
    configs[index >= 0 ? index : configs.length - 1] = updatedConfig;
    writeJSON(CONFIG_FILE, configs);

    res.status(200).json({ success: true, config: updatedConfig, articles: allArticles, publishedUrls: allUrls, publishLog: allLogs });
  } catch (err) {
    console.error('❌ Error in generateAndPublishFromConfig:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// Bulk save keywords API
router.post('/bulk-save-keywords', async (req, res) => {
  try {
    const { keywords, site, scheduledTime } = req.body;
    if (!Array.isArray(keywords)) {
      return res.status(400).json({ success: false, error: 'Missing keywords' });
    }
    // If site is not provided, use a default value or null
    bulkSaveKeywords(keywords, site || '', scheduledTime || null);
    res.status(200).json({ success: true, message: 'Keywords saved.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API to get count of unpublished keywords for a site
router.get('/unpublished-keywords-count', async (req, res) => {
  const site = req.query.site;
  if (!site) return res.status(400).json({ success: false, error: 'Missing site' });
  getUnpublishedKeywords(site, 10000, (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.status(200).json({ success: true, count: rows ? rows.length : 0 });
  });
});

// API to get all saved keywords
router.get('/all-keywords', async (req, res) => {
  try {
    getUnpublishedKeywords(null, 10000, (err, rows) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      // If site is null, fetch all keywords
      if (!rows || rows.length === 0) {
        // fallback: fetch all keywords from DB
        const db = require('../database.js').db;
        db.all('SELECT * FROM keywords', [], (err2, allRows) => {
          if (err2) return res.status(500).json({ success: false, error: err2.message });
          res.status(200).json({ success: true, keywords: allRows });
        });
      } else {
        res.status(200).json({ success: true, keywords: rows });
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
