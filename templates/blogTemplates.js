export const generateBlog = ({ title, headings, targetKeyword, targetLink, conclusion }) => {
    const intro = `Becoming a professional blogger is more achievable than ever. Here's how to do it right.\n`;
  
    const sections = headings.map((heading, index) => {
      const linkHTML = `[${targetKeyword}](${targetLink})`;
      return `## ${heading}\nLorem ipsum dolor sit amet, consectetur adipiscing elit. For more guidance, check out ${linkHTML}.\n`;
    });
  
    const closing = `## Final Thoughts\n${conclusion.replace(targetKeyword, `[${targetKeyword}](${targetLink})`)}`;
  
    return `# ${title}\n\n${intro}\n${sections.join('\n')}\n\n${closing}`;
  };
  