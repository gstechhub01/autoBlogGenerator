
export function convertBlogJSONToMarkdown(blog) {
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
  