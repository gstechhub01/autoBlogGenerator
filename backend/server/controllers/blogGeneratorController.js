import { publishToWordPress } from '../../publisher/wp-publisher.js';
import { scrapeWithPuppeteer } from '../../models/scrapperBot.js';
import { generateBlogJSON } from '../../models/openai-content-mo-four.js';
import prisma, { getAllKeywords, markKeywordPublished, getUnpublishedKeywords } from '../database.js';
import express from 'express';

const router = express.Router();



// Helper: resolve sites from DB
async function resolveSites(siteIdentifiers) {
  if (!siteIdentifiers?.length) {
    return await prisma.siteConfig.findMany();
  }
  // Support both array of objects (with .url) and array of strings (urls)
  const urls = siteIdentifiers.map(s =>
    typeof s === 'string' ? s : s?.url
  ).filter(Boolean); // Remove undefined/null
  if (!urls.length) {
    return await prisma.siteConfig.findMany();
  }
  return await prisma.siteConfig.findMany({ where: { url: { in: urls } } });
}

// Main article processing function
async function processArticle(config, i, sites) {
  // Fetch up to N unpublished keywords globally (no site/config filter)
  let selectedKeywords = [];
  let publishingKeyword = '';
  const keywordsRows = await getUnpublishedKeywords({ limit: 5 });
  if (keywordsRows && keywordsRows.length > 0) {
    selectedKeywords = keywordsRows.map(r => r.keyword);
    publishingKeyword = selectedKeywords[0];
  } else {
    throw new Error('No unpublished keywords available in database.');
  }

  const keywordLinks = selectedKeywords.slice(0, 5);
  const keyword = publishingKeyword;
  const link = config.links && config.links.length > 0 ? config.links[i % config.links.length] : '';
  const topic = config.topics && config.topics.length > 0 ? config.topics[i % config.topics.length] : keyword;
  const title = config.autoTitle ? null : topic;
  let blogJSON = null;

  if (config.contentSource === 'scrapper') {
    const engine = config.engine || 'google';
    const scraped = await scrapeWithPuppeteer(keyword, engine);
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
      title: scraped.title || topic || keyword,
      targetKeyword: keyword,
      targetLink: link,
      excerpt,
      tags: config.tags || [],
      headings: (scraped.qa || []).map(q => q.question),
      sections,
      conclusion: scraped.qa && scraped.qa.length > 0 ? replaceKeywordWithAnchor(scraped.qa[scraped.qa.length - 1].answer) : ''
    };
  } else if (config.contentSource === 'openai') {
    // Only add user-specific rules/settings, not the full prompt
    let openAIPromptRules = '';
    if (keywordLinks.length > 0) {
      openAIPromptRules += `- Use up to ${keywordLinks.length} in-article keywords: ${keywordLinks.join(', ')} as context/SEO.\n`;
    }
    openAIPromptRules += `- Only the publishing keyword should be hyperlinked.\n`;
    if (keywordLinks.length > 0) {
      openAIPromptRules += `- Do not exceed ${keywordLinks.length} keyword links in the article.\n`;
    }
    openAIPromptRules += `- Each keyword should appear naturally.\n`;
    // Pass only extraPrompt, not full rules
    blogJSON = await generateBlogJSON({ title: title || undefined, keyword, link, extraPrompt: openAIPromptRules });
    blogJSON.targetKeyword = keyword;
    blogJSON.targetLink = link;
    blogJSON.tags = config.tags || [];
    if (!blogJSON.title) blogJSON.title = topic || keyword;
  }

  // Defensive: Ensure blogJSON is valid before DB save
  if (!blogJSON || !blogJSON.title) {
    console.error('blogJSON generation failed. Raw response:', blogJSON);
    if (config.contentSource === 'openai') {
      throw new Error('Blog generation failed: No content returned from OpenAI.');
    } else if (config.contentSource === 'scrapper') {
      throw new Error('Blog generation failed: No Q/A pairs or content returned from scrapper.');
    } else {
      throw new Error('Blog generation failed: blogJSON is null or missing title.');
    }
  }

  // Save article to database before publishing
  console.log('blogJSON before DB save:', blogJSON);
  let dbArticle;
  try {
    dbArticle = await prisma.article.create({
      data: {
        userId: config.userId || 1,
        title: blogJSON.title,
        body: blogJSON.sections && blogJSON.sections.length > 0 ? blogJSON.sections.map(s => `<h2>${s.heading}</h2><p>${s.body}</p>`).join('') + `<h2>Conclusion</h2><p>${blogJSON.conclusion}</p>` : '',
        image: blogJSON.sections && blogJSON.sections[0]?.image ? blogJSON.sections[0].image : null,
      }
    });
    console.log('Created article in DB:', dbArticle);
  } catch (err) {
    throw new Error('Failed to create article in database: ' + err.message);
  }

  let articles = [], publishLog = [], publishedUrls = [], publishedAny = false;

  for (const site of sites) {
    try {
      // Use dbArticle for publishing
      const publishPayload = {
        ...blogJSON,
        title: dbArticle.title,
        sections: blogJSON.sections,
        conclusion: blogJSON.conclusion
      };
      const wpRes = await publishToWordPress(publishPayload, site);
      const url = wpRes.link || null;
      articles.push({
        title: dbArticle.title,
        keyword,
        file: dbArticle.id,
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
        title: dbArticle.title,
        keyword,
        file: dbArticle.id,
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

  // Mark publishing keyword as published globally
  await markKeywordPublished(keywordsRows[0].id);

  return { articles, publishLog, publishedUrls, publishedAny };
}

export async function generateAndPublishFromConfig(req, res) {
  try {
    const reqBody = req.body;
    let config = await prisma.blogConfig.findFirst({
      where: {
        userId: reqBody.userId || 1,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!config) {
      config = await prisma.blogConfig.create({
        data: {
          userId: reqBody.userId || 1,
          sites: JSON.stringify(reqBody.sites || []),
          keywords: JSON.stringify(reqBody.topics || []),
          links: JSON.stringify(reqBody.links || []),
          tags: JSON.stringify(reqBody.tags || []),
          topics: JSON.stringify(reqBody.topics || []),
          autoTitle: reqBody.autoTitle ?? true,
          articleCount: reqBody.articleCount || 1,
          keywordsPerArticle: reqBody.keywordsPerArticle || 1,
        },
      });
    }
    const matchedSites = await resolveSites(reqBody.sites);
    let allArticles = [], allLogs = [], allUrls = [], publishedAny = false;
    for (let i = 0; i < (config.articleCount || 1); i++) {
      // Fetch up to N unpublished keywords globally
      let selectedKeywords = [];
      let publishingKeyword = '';
      const keywordsRows = await getUnpublishedKeywords({ limit: 5 });
      if (keywordsRows && keywordsRows.length > 0) {
        selectedKeywords = keywordsRows.map(r => r.keyword);
        publishingKeyword = selectedKeywords[0];
      } else {
        throw new Error('No unpublished keywords available in database.');
      }
      const keywordLinks = selectedKeywords.slice(0, 5);
      const keyword = publishingKeyword;
      const link = config.links[i % config.links.length];
      const topic = config.topics && config.topics.length > 0 ? config.topics[i % config.topics.length] : keyword;
      const title = config.autoTitle ? null : topic;
      let blogJSON = null;
      if (config.contentSource === 'scrapper') {
        const engine = config.engine || 'google';
        const scraped = await scrapeWithPuppeteer(keyword, engine);
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
          title: scraped.title || topic || keyword,
          targetKeyword: keyword,
          targetLink: link,
          excerpt,
          tags: config.tags || [],
          headings: (scraped.qa || []).map(q => q.question),
          sections,
          conclusion: scraped.qa && scraped.qa.length > 0 ? replaceKeywordWithAnchor(scraped.qa[scraped.qa.length - 1].answer) : ''
        };
      } else if (config.contentSource === 'openai') {
        // Only add user-specific rules/settings, not the full prompt
        let openAIPromptRules = '';
        if (keywordLinks.length > 0) {
          openAIPromptRules += `- Use up to ${keywordLinks.length} in-article keywords: ${keywordLinks.join(', ')} as context/SEO.\n`;
        }
        openAIPromptRules += `- Only the publishing keyword should be hyperlinked.\n`;
        if (keywordLinks.length > 0) {
          openAIPromptRules += `- Do not exceed ${keywordLinks.length} keyword links in the article.\n`;
        }
        openAIPromptRules += `- Each keyword should appear naturally.\n`;
        // Pass only extraPrompt, not full rules
        blogJSON = await generateBlogJSON({ title: title || undefined, keyword, link, extraPrompt: openAIPromptRules });
        blogJSON.targetKeyword = keyword;
        blogJSON.targetLink = link;
        blogJSON.tags = config.tags || [];
        if (!blogJSON.title) blogJSON.title = topic || keyword;
      }
      // Defensive: Ensure blogJSON is valid before DB save
      if (!blogJSON || !blogJSON.title) {
        console.error('blogJSON generation failed. Raw response:', blogJSON);
        if (config.contentSource === 'openai') {
          throw new Error('Blog generation failed: No content returned from OpenAI.');
        } else if (config.contentSource === 'scrapper') {
          throw new Error('Blog generation failed: No Q/A pairs or content returned from scrapper.');
        } else {
          throw new Error('Blog generation failed: blogJSON is null or missing title.');
        }
      }
      // Save article to database before publishing
      console.log('blogJSON before DB save:', blogJSON);
      let dbArticle;
      try {
        dbArticle = await prisma.article.create({
          data: {
            userId: config.userId || 1,
            title: blogJSON.title,
            body: blogJSON.sections && blogJSON.sections.length > 0 ? blogJSON.sections.map(s => `<h2>${s.heading}</h2><p>${s.body}</p>`).join('') + `<h2>Conclusion</h2><p>${blogJSON.conclusion}</p>` : '',
            image: blogJSON.sections && blogJSON.sections[0]?.image ? blogJSON.sections[0].image : null,
          }
        });
        console.log('Created article in DB:', dbArticle);
      } catch (err) {
        throw new Error('Failed to create article in database: ' + err.message);
      }
      for (const site of matchedSites) {
        try {
          // Use dbArticle for publishing
          const publishPayload = {
            ...blogJSON,
            title: dbArticle.title,
            sections: blogJSON.sections,
            conclusion: blogJSON.conclusion
          };
          const wpRes = await publishToWordPress(publishPayload, site);
          const url = wpRes.link || null;
          allArticles.push({
            title: dbArticle.title,
            keyword,
            file: dbArticle.id,
            site: site.url,
            url
          });
          allLogs.push({
            timestamp: new Date().toISOString(),
            status: 'success',
            siteUrl: site.url,
            postUrl: url,
            error: null
          });
          allUrls.push({ siteUrl: site.url, url });
          publishedAny = true;
        } catch (err) {
          const errorMsg = err.message || 'Unknown error';
          allArticles.push({
            title: dbArticle.title,
            keyword,
            file: dbArticle.id,
            site: site.url,
            error: errorMsg
          });
          allLogs.push({
            timestamp: new Date().toISOString(),
            status: 'error',
            siteUrl: site.url,
            postUrl: null,
            error: errorMsg
          });
        }
      }
      // Mark publishing keyword as published globally
      await markKeywordPublished(keywordsRows[0].id);
    }
    await prisma.blogConfig.update({
      where: { id: config.id },
      data: {
        hasRun: true,
      },
    });
    res.status(200).json({ success: true, config, articles: allArticles, publishedUrls: allUrls, publishLog: allLogs });
  } catch (err) {
    console.error('❌ Error in generateAndPublishFromConfig:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// Bulk save keywords API
router.post('/bulk-save-keywords', async (req, res) => {
  try {
    const { keywords, site, scheduledTime, userId } = req.body;
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
  // const site = req.query.site; // Not used, as 'site' is not a field in the model
  try {
    // Remove site filter, count only unpublished keywords
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
