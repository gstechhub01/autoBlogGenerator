export function convertBlogJSONToMarkdown(blog) {
    // Defensive: ensure category is a string if present
    let category = '';
    if (typeof blog.category === 'string') {
      category = blog.category;
    } else if (Array.isArray(blog.category) && blog.category.length > 0) {
      category = blog.category[0];
    }
  
    const { title, sections, conclusion, targetKeyword, targetLink } = blog;
  
    let markdown = `# ${title}\n\n`;
  
    for (const section of sections) {
      markdown += `## ${section.heading}\n\n`;
      markdown += `${section.body}\n\n`;
  
    //   if (section.image) {
    //     markdown += `![${section.heading}](${section.image})\n\n`;
    //   }
  
      if (targetKeyword && targetLink && section.body.includes(targetKeyword)) {
        markdown += `**Learn more:** [${targetKeyword}](${targetLink})\n\n`;
      }
    }
  
    markdown += `## Conclusion\n\n${conclusion}\n`;
  
    return markdown;
  }
