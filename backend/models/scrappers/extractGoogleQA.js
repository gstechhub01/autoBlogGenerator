// Google extraction logic
export default async function extractGoogleQA(page, paaSelector) {
  return await page.evaluate((paaSelector) => {
    const pairs = Array.from(document.querySelectorAll(paaSelector));
    let qa = [];
    for (let i = 0; i < pairs.length; i++) {
      const el = pairs[i];
      const button = el.querySelector('div[role="button"]');
      if (button) button.click();
      const question = el.innerText.split('\n')[0] || 'No question found';
      let answer = '';
      const answerEl = el.querySelector('.s75CSd') || el.querySelector('.b_paragraph') || el.querySelector('.compText') || null;
      answer = answerEl ? answerEl.innerText : '';
      qa.push({ question, answer });
    }
    return qa;
  }, paaSelector);
}
