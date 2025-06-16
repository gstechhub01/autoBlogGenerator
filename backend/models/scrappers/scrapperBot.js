import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha';
import dotenv from 'dotenv';
import extractYahooQA from './extractYahooQA.js';
import extractGoogleQA from './extractGoogleQA.js';
import extractBingQA from './extractBingQA.js';
import extractDuckDuckGoQA from './extractDuckDuckGoQA.js';
import { prepareBlogFromScrapper } from '../../templates/scrapperFormatter.js';
dotenv.config();

puppeteer.use(StealthPlugin());
puppeteer.use(
  RecaptchaPlugin({
    provider: {
      id: '2captcha',
      token: process.env.TWOCAPTCHA_API_KEY || 'YOUR_2CAPTCHA_API_KEY', // Set your 2captcha key in .env
    },
    visualFeedback: true, // Shows a box around CAPTCHAs being solved
  })
);

// Utility to handle different search engines
function getEngineConfig(engine, query) {
  switch (engine) {
    case 'google':
      return {
        searchUrl: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        paaSelector: 'div[jscontroller="exgaYe"]',
        engine: 'google',
      };
    case 'bing':
      return {
        searchUrl: `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
        paaSelector: '.b_ans',
        engine: 'bing',
      };
    case 'duckduckgo':
      return {
        searchUrl: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        paaSelector: '.related_question',
        engine: 'duckduckgo',
      };
    case 'yahoo':
      return {
        searchUrl: `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`,
        paaSelector: '.compText',
        engine: 'yahoo',
      };
    default:
      throw new Error(`Unsupported search engine: ${engine}`);
  }
}

export async function scrapeWithPuppeteer(query = 'What is ChatGPT', engine = 'google', options = {}) {
  console.log(`🚀 [Scrapper] Starting scrape for query: "${query}" using engine: ${engine}`);

  const { searchUrl, paaSelector } = getEngineConfig(engine, query);

  const browser = await puppeteer.launch({
    headless: true,
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36'
  );

  console.log(`🌐 Navigating to: ${searchUrl}`);
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

  // --- AUTO CAPTCHA HANDLING ---
  if (page.solveRecaptchas) {
    const { captchas, solved, error } = await page.solveRecaptchas();
    if (captchas && captchas.length > 0) {
      if (error) {
        console.warn('⚠️ CAPTCHA solve error:', error);
      } else {
        console.log(`✅ Solved ${solved.length} CAPTCHA(s).`);
        await page.reload({ waitUntil: 'domcontentloaded' });
      }
    }
  }

  try {
    await page.waitForSelector(paaSelector, { timeout: 10000 });
    console.log('✅ [Scrapper] PAA section found.');
  } catch {
    console.warn(`⚠️ [Scrapper] No related questions found or took too long to load.`);
  }

  // Extract Q/A pairs (generic for all engines, but Yahoo needs special handling)
  let expandAndScrape;
  if (engine === 'yahoo') {
    expandAndScrape = await extractYahooQA(page);
  } else if (engine === 'google') {
    expandAndScrape = await extractGoogleQA(page, paaSelector);
  } else if (engine === 'bing') {
    expandAndScrape = await extractBingQA(page, paaSelector);
  } else if (engine === 'duckduckgo') {
    expandAndScrape = await extractDuckDuckGoQA(page, paaSelector);
  } else {
    expandAndScrape = [];
  }

  // Get page title and first heading for context
  const pageTitle = query;
  const firstHeading = await page.evaluate(() => {
    const h3 = document.querySelector('h3');
    return h3 ? h3.innerText : '';
  });

  await browser.close();

  // Format headings: first letter uppercase, rest lowercase
  function formatHeading(str) {
    if (!str) return '';
    // Remove leading/trailing whitespace and collapse spaces
    str = str.trim().replace(/\s+/g, ' ');
    // Capitalize first letter, rest lowercase
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
  // Helper to check if a string is just a number or generic word
  function isGenericQuestion(q) {
    if (!q) return true;
    const generic = ['top', 'tech', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
    return generic.includes(q.trim().toLowerCase()) || /^\d+$/.test(q.trim());
  }
  // Helper to check if answer starts with a date (e.g., 'Apr 22, 2025 ·')
  function answerStartsWithDate(ans) {
    return /^([A-Z][a-z]{2,8} \d{1,2}, \d{4} · )/.test(ans.trim());
  }
  if (Array.isArray(expandAndScrape)) {
    expandAndScrape = expandAndScrape
      .filter(item => !isGenericQuestion(item.question) && item.answer && !answerStartsWithDate(item.answer))
      .map(item => ({
        ...item,
        question: formatHeading(item.question)
      }));
  }

  // Instead of formatting here, just return the raw Q/A and meta
  const formattedResult = {
    query,
    engine,
    title: pageTitle, // Only use the page title, never include engine in the title
    firstHeading,
    qa: expandAndScrape,
    keywords: [query],
    links: expandAndScrape
      .map(item => (item.answer.match(/https?:\/\/[\w\.-]+[\w\/-]+/g) || []))
      .flat(),
    debug: {
      searchUrl,
      totalPairs: expandAndScrape.length,
      timestamp: new Date().toISOString(),
    },
  };
  console.log(`✅ [Scrapper] Scrape complete. Total Q/A pairs: ${expandAndScrape.length}`);

  // If options.prepareForPublishing is true, return formatted for publishing
  if (options.prepareForPublishing) {
    return prepareBlogFromScrapper({
      scrapperResult: formattedResult,
      targetKeyword: options.targetKeyword || query,
      targetLink: options.targetLink || '',
      conclusion: options.conclusion || '',
      featuredImage: options.featuredImage || '',
      tags: options.tags || [],
      extra: options.extra || {},
    });
  }

  return formattedResult;
}

// Removed Express app and route logic for modularization
