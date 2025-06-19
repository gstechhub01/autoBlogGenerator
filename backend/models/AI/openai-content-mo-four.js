import { OpenAI } from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateBlogJSON({ title, keyword, link, inArticleKeyword = '', extraPrompt = '' }) {
  // Ensure inArticleKeyword is an array of up to 3 keywords
  let anchorKeywords = [];
  if (Array.isArray(inArticleKeyword)) {
    anchorKeywords = inArticleKeyword.slice(0, 3);
  } else if (typeof inArticleKeyword === 'string' && inArticleKeyword.trim() !== '') {
    anchorKeywords = [inArticleKeyword];
  } else {
    anchorKeywords = [keyword];
  }

  // Prepare anchor tags for each keyword
  const anchorTags = anchorKeywords.map(kw => `<a href="${link}" target="_blank" rel="noopener noreferrer">${kw}</a>`);

  // Build prompt instructions for multiple anchors
  const anchorInstructions = anchorKeywords.length > 1
    ? `- For anchor/hyperlink injections, use each of these keywords once: ${anchorKeywords.map(kw => `"${kw}"`).join(', ')} (max 3 anchors in total), each with the link: "${link}".
- Replace every full occurrence of each keyword with its corresponding anchor tag:
${anchorKeywords.map((kw, i) => `  "${kw}" → ${anchorTags[i]}`).join('\n')}
- Ensure each anchor appears in a different paragraph or section where natural.`
    : `- For all anchor/hyperlink injections, use the keyword: "${anchorKeywords[0]}" and the link: "${link}"
- Replace every full occurrence of "${anchorKeywords[0]}" with this exact HTML anchor tag:
  ${anchorTags[0]}
- Ensure at least one hyperlink appears in 3 paragraphs where natural.`;

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
${anchorInstructions}
${extraPrompt}
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

    // Ensure each anchor is present at least once (max 3 anchors)
    if (anchorKeywords.length && link) {
      anchorTags.forEach((anchor, idx) => {
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
        if (!anchorPresent && Array.isArray(parsed.sections) && parsed.sections.length > idx) {
          parsed.sections[idx].body = `${anchor} ${parsed.sections[idx].body || ''}`;
        }
      });
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
