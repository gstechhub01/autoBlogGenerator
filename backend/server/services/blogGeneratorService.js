import { publishToWordPress } from '../../publisher/wp-publisher.js';
import { scrapeWithPuppeteer } from '../../models/scrappers/scrapperBot.js';
import { generateBlogJSON } from '../../models/AI/openai-content-mo-four.js';
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
 *     categories: string[],
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
    categories = [], // <-- ensure categories is destructured
    sites = [],
    contentSource = 'openai',
    engine = 'google',
    autoTitle = true,
    userId = 1,
    ...rest
  } = resources;

  // DEBUG: Log incoming resources and link value
  console.log('generateAndPublishService resources.link:', link);

  // Defensive: Ensure publishingKeyword is present and valid
  if (!publishingKeyword || typeof publishingKeyword !== 'string' || !publishingKeyword.trim() || publishingKeyword === 'undefined') {
    throw new Error('Missing or invalid publishingKeyword.');
  }
  // Defensive: If link is missing or invalid, do not hyperlink
  let validLink = '';
  if (link && typeof link === 'string' && link.trim() && link !== 'undefined') {
    // Handle case where link is a JSON stringified array, e.g., '["gstechhub.com.ng"]'
    let parsedLink = link;
    try {
      const arr = JSON.parse(link);
      if (Array.isArray(arr) && arr.length > 0) {
        parsedLink = arr[0];
      }
    } catch (e) {
      // Not a JSON array, use as is
    }
    validLink = parsedLink.trim();
  }
  // If validLink is present but does not start with http, prepend https://
  if (validLink && !/^https?:\/\//i.test(validLink)) {
    validLink = 'https://' + validLink;
  }

  // Title logic
  const title = autoTitle ? null : (explicitTitle || topic || publishingKeyword);
  const keyword = publishingKeyword;
  const keywordLinks = inArticleKeywords;
  let blogJSON = null;

  if (resources.contentSource === 'scrapper') {
    // Use scrapper logic
    const scraped = await scrapeWithPuppeteer(
      resources.publishingKeyword,
      resources.engine || 'google',
      {
        prepareForPublishing: true,
        targetKeyword: keyword, // Use main publishing keyword
        targetLink: validLink,  // Use parsed/validated link
        conclusion: resources.conclusion || '',
        featuredImage: resources.featuredImage || '',
        tags: resources.tags || [],
        extra: {
          topics: resources.topics || [],
          inArticleKeywords: resources.inArticleKeywords || []
        }
      }
    );
    blogJSON = scraped;
  } else {
    // Use OpenAI logic
    blogJSON = await generateBlogJSON({
      title: resources.title,
      keyword: resources.publishingKeyword,
      link: validLink,
      tags: resources.tags,
      topics: resources.topics,
    });
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
      // Fetch password and publishingAvailable from DB if missing
      const dbSite = await prisma.siteConfig.findFirst({
        where: { url: site.url, username: site.username },
        select: { url: true, username: true, password: true, publishingAvailable: true }
      });
      if (dbSite && dbSite.password) {
        resolvedSites.push({ ...site, password: dbSite.password, publishingAvailable: dbSite.publishingAvailable });
      } else {
        throw new Error(`Missing password for site: ${site.url} (${site.username})`);
      }
    } else {
      throw new Error('Site config missing url or username');
    }
  }

  // Only publish to the provided site(s)
  // Defensive: Only publish to the first resolved site (if multiple provided)
  const selectedSite = resolvedSites[0];
  if (!selectedSite) {
    throw new Error('No valid site provided for publishing.');
  }

  try {
    const publishPayload = {
      ...blogJSON,
      title: dbArticle.title,
      sections: blogJSON.sections,
      conclusion: blogJSON.conclusion,
      categories: resources.categories // <-- include categories in the payload
    };
    const wpRes = await publishToWordPress(publishPayload, selectedSite);
    const url = wpRes.link || null;
    await prisma.article.update({
      where: { id: dbArticle.id },
      data: {
        siteUrl: selectedSite.url,
        publishedUrl: url
      }
    });
    articles.push({
      title: dbArticle.title,
      keyword,
      file: dbArticle.id,
      site: selectedSite.url,
      url
    });
    publishLog.push({
      timestamp: new Date().toISOString(),
      status: 'success',
      siteUrl: selectedSite.url,
      postUrl: url,
      error: null
    });
    publishedUrls.push({ siteUrl: selectedSite.url, url });
    publishedAny = true;
  } catch (err) {
    const errorMsg = err.message || 'Unknown error';
    articles.push({
      title: dbArticle.title,
      keyword,
      file: dbArticle.id,
      site: selectedSite.url,
      error: errorMsg
    });
    publishLog.push({
      timestamp: new Date().toISOString(),
      status: 'error',
      siteUrl: selectedSite.url,
      postUrl: null,
      error: errorMsg
    });
  }

  // NOTE: Marking keyword as published should be handled by the scheduler/controller, not here.

  return { articles, publishLog, publishedUrls, publishedAny };
}
