import fs from 'fs';
import path from 'path';
import { generateBlogJSON } from './models/openai-content-mo-four.js';
import { convertBlogJSONToMarkdown } from './util/markdowncoonverter.js'; // Ensure filename is correct
import { publishToWordPress } from './publisher/wp-publisher.js';
import { scrapeWithPuppeteer } from './models/scrapperBot.js';

// Paths
const inputPath = path.join('./server/config', 'blog-config.json');
const jsonOutputPath = path.join('./server/output', 'blog.json');
const mdOutputPath = path.join('./server/output', 'blog.md');

// Ensure /output folder exists
if (!fs.existsSync('./output')) fs.mkdirSync('../server/output');

// Load input data
const inputData = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

(async () => {
  try {
    let blogJSON;
    // Use contentSource and engine from config
    if (inputData.contentSource === 'scrapper') {
      // Use the selected engine or default to google
      const engine = inputData.engine || 'google';
      blogJSON = await scrapeWithPuppeteer(inputData.keywords[0], engine);
    } else {
      // Default to OpenAI
      blogJSON = await generateBlogJSON(inputData);
    }

    // 2. Save raw blog JSON for inspection
    fs.writeFileSync(jsonOutputPath, JSON.stringify(blogJSON, null, 2), 'utf-8');
    console.log('✅ Blog JSON saved to /output/blog.json');

    // 3. Convert and save Markdown
    const blogMarkdown = convertBlogJSONToMarkdown(blogJSON);
    fs.writeFileSync(mdOutputPath, blogMarkdown, 'utf-8');
    console.log('✅ Markdown saved to /output/blog.md');

    // 4.  Publish to WordPress
    const wpPost = await publishToWordPress(blogJSON);
    console.log('✅ Published to WordPress at:', wpPost.link);

  } catch (err) {
    console.error('Error generating blog content:', err.message);
  }
})();
