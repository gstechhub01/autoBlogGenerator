// scrapperFormatter.js
// Formats and prepares scrapper output for publishing (not saving to markdown or JSON)

/**
 * Prepare a blog object from scrapper output, ready for publishing or DB save.
 * @param {Object} params
 *   - scrapperResult: { query, engine, title, firstHeading, qa, keywords, links, ... }
 *   - targetKeyword: string (for anchor injection)
 *   - targetLink: string (for anchor injection)
 *   - conclusion: string (optional)
 *   - featuredImage: string (optional)
 *   - tags: array (optional)
 *   - extra: object (optional, for extensibility)
 * @returns {Object} blog object ready for publishing
 */
export function prepareBlogFromScrapper({
  scrapperResult,
  targetKeyword = '',
  targetLink = '',
  conclusion = '',
  featuredImage = '',
  tags = [],
  extra = {},
}) {
  if (!scrapperResult || !Array.isArray(scrapperResult.qa)) {
    throw new Error('Invalid scrapper result');
  }

  // Helper: format heading
  function formatHeading(str) {
    if (!str) return '';
    str = str.trim().replace(/\s+/g, ' ');
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  // Helper: inject anchor for keyword
  function injectAnchor(text, keyword, link) {
    if (!keyword || !link || !text) return text;
    const anchor = `<a href="${link}" target="_blank" rel="noopener noreferrer">${keyword}</a>`;
    // Replace only first occurrence (case-insensitive)
    return text.replace(new RegExp(keyword, 'i'), anchor);
  }

  // Prepare sections (rich object, not markdown)
  let sections = scrapperResult.qa.map(item => {
    let heading = formatHeading(item.question);
    let body = item.answer || '';
    if (targetKeyword && targetLink) {
      body = injectAnchor(body, targetKeyword, targetLink);
    }
    let image = '';
    const imgMatch = body.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch) image = imgMatch[1];
    return { heading, body, image };
  });

  // Ensure the anchor is present at least once in the blog
  if (targetKeyword && targetLink) {
    const anchor = `<a href="${targetLink}" target="_blank" rel="noopener noreferrer">${targetKeyword}</a>`;
    const anchorPresent = sections.some(sec => sec.body && sec.body.includes(anchor));
    if (!anchorPresent && sections.length > 0) {
      // Insert anchor at the start of the first section's body
      sections[0].body = `${anchor} ${sections[0].body}`;
    }
  }

  // Collect all headings
  const headings = sections.map(s => s.heading);

  // Collect all images
  const images = sections.map(s => s.image).filter(Boolean);

  // Collect all links (from answers and scrapperResult.links)
  const links = [
    ...(scrapperResult.links || []),
    ...sections.flatMap(s => {
      const matches = s.body.match(/https?:\/\/[^\s"'>)]+/g);
      return matches || [];
    })
  ];

  // Generate excerpt (first answer or heading)
  let excerpt = '';
  if (sections.length > 0) {
    excerpt = sections[0].body.length > 160 ? sections[0].body.slice(0, 157) + '...' : sections[0].body;
  } else if (scrapperResult.firstHeading) {
    excerpt = scrapperResult.firstHeading;
  }

  // Prepare final blog object (generateBlogJSON compatible)
  const blog = {
    title: scrapperResult.query || scrapperResult.title || headings[0] || '',
    targetKeyword,
    targetLink,
    excerpt,
    tags,
    headings,
    sections,
    images,
    links,
    featuredImage: featuredImage || images[0] || '',
    conclusion,
    engine: scrapperResult.engine,
    keywords: scrapperResult.keywords || [],
    ...extra,
  };
  return blog;
}
