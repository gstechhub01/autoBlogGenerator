import { generateBlogJSON } from '../../models/openai-content-mo-four.js';
import { convertBlogJSONToMarkdown } from '../../util/markdowncoonverter.js';
import { publishToWordPress } from '../../publisher/wp-publisher.js';
import fs from 'fs';
import path from 'path';

export async function generateAndPublishFromConfig(req, res) {
  try {
    const {
      sites = [],
      keywords = [],
      links = [],
      tags = [],
      topics = [],
      autoTitle = true,
      articleCount = 1,
    } = req.body;

    const results = [];
    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    for (let i = 0; i < articleCount; i++) {
      const keyword = keywords[i % keywords.length];
      const link = links[i % links.length];

      // Fallback topic if missing
      let topic = topics[i % topics.length];
      if (!topic || typeof topic !== 'string' || topic.trim() === '') {
        topic = `Topic for "${keyword}"`;
      }

      // If autoTitle is true, let OpenAI decide the title
      const title = autoTitle ? null : `${topic}`;

      // 1. Generate blog JSON
      const blogJSON = await generateBlogJSON({ title, keyword, link });

      const timestamp = Date.now();
      const fileBase = `blog-${timestamp}-${i + 1}`;

      // 2. Save JSON
      fs.writeFileSync(`${outputDir}/${fileBase}.json`, JSON.stringify(blogJSON, null, 2), 'utf-8');

      // 3. Convert to Markdown
      const markdown = convertBlogJSONToMarkdown(blogJSON);
      fs.writeFileSync(`${outputDir}/${fileBase}.md`, markdown, 'utf-8');

      // 4. Publish to each site
      const publishResults = [];
      for (const site of sites) {
        const response = await publishToWordPress(blogJSON, site);
        publishResults.push({ site: site.url, response });
      }

      results.push({
        title: blogJSON.title, // Use actual title from JSON
        keyword,
        file: fileBase,
        publishResults,
      });
    }

    res.status(200).json({ success: true, results });
  } catch (err) {
    console.error('❌ Generation error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}
