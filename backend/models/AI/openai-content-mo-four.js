import { OpenAI } from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateBlogJSON({ title, keyword, link, extraPrompt = '' }) {
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
- If no title is provided, generate a compelling, SEO-friendly blog title based on the "${keyword}".
- Use the title: "${title}"
${extraPrompt}
- Replace every full occurrence of "${keyword}" with this exact HTML anchor tag:
  <a href="${link}" target="_blank" rel="noopener noreferrer">${keyword}</a>
- Ensure at least one hyperlink appears in each paragraph where natural.
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
    return JSON.parse(jsonText);
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
