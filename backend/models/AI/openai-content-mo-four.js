import { OpenAI } from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateBlogJSON({ title, keyword, link, inArticleKeyword = '', extraPrompt = '' }) {
  // If inArticleKeyword is provided, use it for anchor/target keyword, else fallback to keyword
  const anchorKeyword = inArticleKeyword || keyword;
  const prompt = `
Generate a JSON blog post with the following structure:

{
  "title": "string",
  "targetKeyword": "string",
  "targetLink": "string",
  "excerpt": "string",
  "tags": ["string", ...],
  "headings": ["string", ...],
  "sections": [
    { "heading": "string", "body": "string", "image": "string (image URL)" }
  ],
  "conclusion": "string"
}

Rules:
- Use the title: "${title}"
- The main topic/SEO keyword for the article is: "${keyword}"
- For all anchor/hyperlink injections, use the keyword: "${anchorKeyword}" and the link: "${link}"
${extraPrompt}
- Replace every full occurrence of "${anchorKeyword}" with this exact HTML anchor tag:
  <a href="${link}" target="_blank" rel="noopener noreferrer">${anchorKeyword}</a>
- Ensure at least one hyperlink appears in 3 paragraphs where natural.
- Each section must have a heading, a detailed body, and a relevant image URL.
- Include at least 5 detailed sections.
- The total blog post should be at least 2000 words.
- Add a short "excerpt" of max 160 characters.
- The "headings" array should list all section titles.
- Ensure the JSON is valid and contains no extra commentary or explanation.
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a blog writing assistant. Return clean JSON only.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7
  });

  const jsonText = response.choices[0].message.content.trim();

  try {
    const parsed = JSON.parse(jsonText);
    // Ensure anchor is present at least once
    if (anchorKeyword && link) {
      const anchor = `<a href="${link}" target="_blank" rel="noopener noreferrer">${anchorKeyword}</a>`;
      let anchorPresent = false;
      // Check in sections
      if (Array.isArray(parsed.sections)) {
        anchorPresent = parsed.sections.some(sec => sec.body && sec.body.includes(anchor));
      }
      // Check in excerpt and conclusion
      if (!anchorPresent && (parsed.excerpt && parsed.excerpt.includes(anchor))) anchorPresent = true;
      if (!anchorPresent && (parsed.conclusion && parsed.conclusion.includes(anchor))) anchorPresent = true;
      // Check in headings
      if (!anchorPresent && Array.isArray(parsed.headings)) {
        anchorPresent = parsed.headings.some(h => h && h.includes(anchor));
      }
      // Inject anchor if missing
      if (!anchorPresent && Array.isArray(parsed.sections) && parsed.sections.length > 0) {
        parsed.sections[0].body = `${anchor} ${parsed.sections[0].body || ''}`;
      }
    }
    return parsed;
  } catch (err) {
    // Attempt fallback: strip any leading/trailing junk
    const safeText = jsonText.replace(/^[^{]*|[^}]*$/g, '');
    try {
      return JSON.parse(safeText);
    } catch (secondErr) {
      throw new Error('Invalid JSON from GPT: ' + secondErr.message);
    }
  }
}
