import { publishToWordPress } from '../../publisher/wp-publisher.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { scrapeWithPuppeteer } from '../../models/scrapperBot.js';
import { generateBlogJSON } from '../../models/openai-content-mo-four.js';

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
    id, keywords, links, tags, topics, autoTitle, articleCount, scheduleTime
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
      articleCount, scheduleTime,
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
  const keyword = config.keywords[i % config.keywords.length];
  const link = config.links[i % config.links.length];
  const topic = config.topics && config.topics.length > 0 ? config.topics[i % config.topics.length] : keyword;
  const title = config.autoTitle ? null : topic;
  let blogJSON = null;

  if (config.contentSource === 'scrapper') {
    const engine = config.engine || 'google';
    console.log(`[Scrapper] Generating article for keyword: ${keyword}, engine: ${engine}`);
    const scraped = await scrapeWithPuppeteer(keyword, engine);
    // Prepare anchor tag for replacement
    const anchorTag = link ? `<a href="${link}" target="_blank" rel="noopener noreferrer">${keyword}</a>` : keyword;
    function replaceKeywordWithAnchor(text) {
      if (!text) return '';
      const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'gi');
      return text.replace(regex, anchorTag);
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
    // Use OpenAI to generate blog JSON
    console.log(`[OpenAI] Generating article for keyword: ${keyword}`);
    blogJSON = await generateBlogJSON({ title: title || undefined, keyword, link });
    // Optionally, you can post-process blogJSON to match the same structure as above if needed
    blogJSON.targetKeyword = keyword;
    blogJSON.targetLink = link;
    blogJSON.tags = config.tags || [];
  }

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
