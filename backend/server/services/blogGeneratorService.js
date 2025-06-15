import { publishToWordPress } from '../../publisher/wp-publisher.js';
import { scrapeWithPuppeteer } from '../../models/scrapperBot.js';
import { generateBlogJSON } from '../../models/openai-content-mo-four.js';
import { replaceKeywordWithAnchor } from '../helpers/blogHelpers.js';
import prisma from '../database.js';

// LEGACY: processArticle is deprecated and removed..

/**
 * Process and publish a blog article using provided resources from the scheduler.
 * @param {Object} resources - All publishing resources for this article.
 *   {
 *     publishingKeyword: string, // main keyword for title and SEO
 *     inArticleKeywords: string[], // keywords for in-article links
 *     link: string, // main link for publishing keyword
 *     topic: string, // topic for the article
 *     title: string, // explicit title (optional)
 *     tags: string[],
 *     sites: array, // site configs
 *     contentSource: 'scrapper' | 'openai',
 *     engine: string, // for scrapper
 *     autoTitle: boolean,
 *     ...
 *   }
 * @returns {Object} blogJSON and publish results
 */
export async function generateAndPublishService(resources) {
  const {
    publishingKeyword,
    inArticleKeywords = [],
    link = '',
    topic = '',
    title: explicitTitle = '',
    tags = [],
    sites = [],
    contentSource = 'openai',
    engine = 'google',
    autoTitle = true,
    userId = 1,
    ...rest
  } = resources;

  // Defensive: Ensure publishingKeyword is present and valid
  if (!publishingKeyword || typeof publishingKeyword !== 'string' || !publishingKeyword.trim() || publishingKeyword === 'undefined') {
    throw new Error('Missing or invalid publishingKeyword.');
  }
  // Defensive: If link is missing or invalid, do not hyperlink
  const validLink = link && typeof link === 'string' && link.trim() && link !== 'undefined' ? link : null;

  // Title logic
  const title = autoTitle ? null : (explicitTitle || topic || publishingKeyword);
  const keyword = publishingKeyword;
  const keywordLinks = inArticleKeywords;
  // Only create anchorTag if validLink exists
  const anchorTag = validLink ? `<a href="${validLink}" target="_blank" rel="noopener noreferrer">${keyword}</a>` : keyword;
  let blogJSON = null;

  if (contentSource === 'scrapper') {
    const scraped = await scrapeWithPuppeteer(keyword, engine);
    const sections = (scraped.qa || []).map(q => ({
      heading: q.question,
      body: replaceKeywordWithAnchor(q.answer, keywordLinks, anchorTag),
      image: q.image || ''
    }));
    let excerpt = '';
    if (sections.length > 0) {
      excerpt = sections[0].body.replace(/<[^>]+>/g, '').slice(0, 160);
    }
    blogJSON = {
      title: scraped.title || topic || keyword,
      targetKeyword: keyword,
      targetLink: validLink || '',
      excerpt,
      tags,
      headings: (scraped.qa || []).map(q => q.question),
      sections,
      conclusion: scraped.qa && scraped.qa.length > 0 ? replaceKeywordWithAnchor(scraped.qa[scraped.qa.length - 1].answer, keywordLinks, anchorTag) : ''
    };
  } else if (contentSource === 'openai') {
    let openAIPromptRules = '';
    if (keywordLinks.length > 0) {
      openAIPromptRules += `- Use up to ${keywordLinks.length} in-article keywords: ${keywordLinks.join(', ')} as context/SEO.\n`;
    }
    // Only add hyperlinking rule if validLink exists
    if (validLink) {
      openAIPromptRules += `- Only the publishing keyword should be hyperlinked.\n`;
    } else {
      openAIPromptRules += `- Do NOT hyperlink any keywords.\n`;
    }
    if (keywordLinks.length > 0) {
      openAIPromptRules += `- Do not exceed ${keywordLinks.length} keyword links in the article.\n`;
    }
    openAIPromptRules += `- Each keyword should appear naturally.\n`;
    blogJSON = await generateBlogJSON({ title: title || undefined, keyword, link: validLink || '', extraPrompt: openAIPromptRules });
    blogJSON.targetKeyword = keyword;
    blogJSON.targetLink = validLink || '';
    blogJSON.tags = tags || [];
    if (!blogJSON.title) blogJSON.title = topic || keyword;
  }

  console.log('Generated blogJSON:', JSON.stringify(blogJSON, null, 2));

  // Defensive: Ensure blogJSON is valid before DB save
  if (!blogJSON || !blogJSON.title || typeof blogJSON.title !== 'string' || !blogJSON.title.trim()) {
    console.error('blogJSON generation failed. Raw response:', blogJSON);
    throw new Error('Blog generation failed: blogJSON is null or missing title.');
  }

  let dbArticle;
  try {
    dbArticle = await prisma.article.create({
      data: {
        userId: userId,
        title: blogJSON.title,
        body: blogJSON.sections && blogJSON.sections.length > 0 ? blogJSON.sections.map(s => `<h2>${s.heading}</h2><p>${s.body}</p>`).join('') + `<h2>Conclusion</h2><p>${blogJSON.conclusion}</p>` : '',
        image: blogJSON.sections && blogJSON.sections[0]?.image ? blogJSON.sections[0].image : null,
        siteUrl: sites && sites.length > 0 ? sites[0].url : null // Set initial siteUrl for the first site
      }
    });
  } catch (err) {
    throw new Error('Failed to create article in database: ' + err.message);
  }

  let articles = [], publishLog = [], publishedUrls = [], publishedAny = false;

  // Ensure all site credentials are present (url, username, password)
  const resolvedSites = [];
  for (const site of sites) {
    if (site && site.url && site.username && site.password) {
      resolvedSites.push(site);
    } else if (site && site.url && site.username) {
      // Fetch password from DB if missing
      const dbSite = await prisma.siteConfig.findFirst({
        where: { url: site.url, username: site.username },
        select: { url: true, username: true, password: true }
      });
      if (dbSite && dbSite.password) {
        resolvedSites.push({ ...site, password: dbSite.password });
      } else {
        // Skip or throw if credentials incomplete
        throw new Error(`Missing password for site: ${site.url} (${site.username})`);
      }
    } else {
      // Skip or throw if url/username missing
      throw new Error('Site config missing url or username');
    }
  }

  for (const site of resolvedSites) {
    try {
      const publishPayload = {
        ...blogJSON,
        title: dbArticle.title,
        sections: blogJSON.sections,
        conclusion: blogJSON.conclusion
      };
      const wpRes = await publishToWordPress(publishPayload, site);
      const url = wpRes.link || null;
      // Update the article with siteUrl and publishedUrl
      await prisma.article.update({
        where: { id: dbArticle.id },
        data: {
          siteUrl: site.url,
          publishedUrl: url
        }
      });
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

  // NOTE: Marking keyword as published should be handled by the scheduler/controller, not here.

  return { articles, publishLog, publishedUrls, publishedAny };
}
