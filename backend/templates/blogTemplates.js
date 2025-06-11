export const formatScrapperQAAsBlog = ({ title, qa, targetKeyword = '', targetLink = '', conclusion = '' }) => {
    // Helper to format heading: first letter uppercase, rest lowercase
    function formatHeading(str) {
      if (!str) return '';
      str = str.trim().replace(/\s+/g, ' ');
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }
    const intro = `Here are the most relevant questions and answers for your topic.\n`;
    const sections = qa.map(item => {
      let heading = formatHeading(item.question);
      let answer = item.answer || '';
      let linkHTML = targetKeyword && targetLink ? `[${targetKeyword}](${targetLink})` : '';
      return `## ${heading}\n${answer}\n${linkHTML ? `\nFor more, see ${linkHTML}.` : ''}`;
    });
    const closing = conclusion ? `\n## Final Thoughts\n${conclusion.replace(targetKeyword, `[${targetKeyword}](${targetLink})`)}` : '';
    return `# ${title}\n\n${intro}\n${sections.join('\n\n')}\n${closing}`;
  };
  
  export const formatScrapperQAAsHTMLBlog = ({ title, qa, targetKeyword = '', targetLink = '', conclusion = '' }) => {
    // Helper to format heading: first letter uppercase, rest lowercase
    function formatHeading(str) {
      if (!str) return '';
      str = str.trim().replace(/\s+/g, ' ');
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }
    const intro = `<p>Here are the most relevant questions and answers for your topic.</p>`;
    const sections = qa.map(item => {
      let heading = formatHeading(item.question);
      let answer = item.answer || '';
      let linkHTML = targetKeyword && targetLink ? `<a href="${targetLink}" target="_blank" rel="noopener noreferrer">${targetKeyword}</a>` : '';
      // Only add link if not already present in answer
      let answerWithLink = answer;
      if (linkHTML && !answer.includes(targetLink)) {
        answerWithLink += `<br/>For more, see ${linkHTML}.`;
      }
      return `<h2>${heading}</h2><p>${answerWithLink}</p>`;
    });
    const closing = conclusion ? `<h2>Final Thoughts</h2><p>${conclusion.replace(targetKeyword, `<a href=\"${targetLink}\" target=\"_blank\" rel=\"noopener noreferrer\">${targetKeyword}</a>`)}</p>` : '';
    return `<h1>${title}</h1>${intro}${sections.join('')}${closing}`;
  };
