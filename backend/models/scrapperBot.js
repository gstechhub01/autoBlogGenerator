import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import express from 'express';
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

// Main scraping function with dynamic engine
export async function scrapeWithPuppeteer(query = 'What is ChatGPT', engine = 'google') {
  console.log(`🚀 [Scrapper] Starting scrape for query: "${query}" using engine: ${engine}`);

  const { searchUrl, paaSelector } = getEngineConfig(engine, query);

  const browser = await puppeteer.launch({
    headless: false,
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
    expandAndScrape = await page.evaluate(() => {
      // Yahoo's related questions are often under a section with heading 'People also ask' or 'Related questions'
      // We'll look for those blocks and filter out AI/summary/empty/irrelevant entries
      function isValidQuestion(q) {
        if (!q) return false;
        const lower = q.toLowerCase();
        if (
          lower.includes('ai-generated') ||
          lower.includes('powered by openai') ||
          lower.includes('creating an answer for you') ||
          lower.includes('we weren’t able to create a summary') ||
          lower.includes('is this helpful?') ||
          lower.includes('see full list') ||
          lower.includes('loading...') ||
          lower.trim() === ''
        ) return false;
        // Filter out questions that are just dates or navigation
        if (/\d{1,2} [a-z]{3,9} \d{4}/i.test(lower)) return false;
        return true;
      }
      // Yahoo sometimes puts related Qs in .compText, but also in .Mb(12px) or .Ov(h) blocks
      const blocks = Array.from(document.querySelectorAll('.compText, .Mb\\(12px\\), .Ov\\(h\\)'));
      let qa = [];
      for (let el of blocks) {
        // Try to find a question (bold or heading or first line)
        let question = '';
        const bold = el.querySelector('b');
        if (bold) question = bold.innerText.trim();
        if (!question) question = el.querySelector('h3,h4')?.innerText?.trim() || '';
        if (!question) question = el.innerText.split('\n')[0].trim();
        // Try to find answer (next sibling or paragraph)
        let answer = '';
        const para = el.querySelector('p');
        if (para) answer = para.innerText.trim();
        if (!answer) {
          // Sometimes answer is in the next sibling
          let next = el.nextElementSibling;
          if (next && next.tagName === 'P') answer = next.innerText.trim();
        }
        // Filter
        if (
          isValidQuestion(question) &&
          answer &&
          answer.length > 20 && // Only keep answers with some substance
          !answer.toLowerCase().includes('ai-generated') &&
          !answer.toLowerCase().includes('powered by openai') &&
          !answer.toLowerCase().includes('creating an answer for you') &&
          !answer.toLowerCase().includes('we weren’t able to create a summary') &&
          !answer.toLowerCase().includes('is this helpful?') &&
          !answer.toLowerCase().includes('see full list') &&
          !answer.toLowerCase().includes('loading...')
        ) {
          qa.push({ question, answer });
        }
      }
      return qa;
    });
  } else {
    expandAndScrape = await page.evaluate((paaSelector) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
      const pairs = Array.from(document.querySelectorAll(paaSelector));
      let qa = [];
      for (let i = 0; i < pairs.length; i++) {
        const el = pairs[i];
        // Try to expand if possible
        const button = el.querySelector('div[role="button"]');
        if (button) button.click();
        // Wait for answer to load (simulate async)
        // await sleep(800); // Not available in browser context, so skip
        const question = el.innerText.split('\n')[0] || 'No question found';
        // Try to find answer element
        let answer = '';
        const answerEl = el.querySelector('.s75CSd') || el.querySelector('.b_paragraph') || el.querySelector('.compText') || null;
        answer = answerEl ? answerEl.innerText : '';
        qa.push({ question, answer });
      }
      return qa;
    }, paaSelector);
  }

  // Get page title and first heading for context
  const pageTitle = await page.title();
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
    title: pageTitle,
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

  const filename = `search_${query.replace(/\s+/g, '_')}_${engine}_puppeteer.json`;
  fs.writeFileSync(path.join(process.cwd(), filename), JSON.stringify(formattedResult, null, 2));
  console.log(`✅ [Scrapper] Saved to ${filename}`);
  console.log(`✅ [Scrapper] Scrape complete. Total Q/A pairs: ${expandAndScrape.length}`);
  return formattedResult;
}

// Express API endpoint for dynamic scraping
export const app = express();
app.use(express.json());

app.post('/api/scrape', async (req, res) => {
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
