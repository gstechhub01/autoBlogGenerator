// Google extraction logic
export default async function extractGoogleQA(page, paaSelector, maxPAA = 20) {
  // Helper to expand PAA by clicking all expanders, including 'see all results for this question'
  async function expandPAAUntilLimit() {
    let prevCount = 0;
    let tries = 0;
    while (tries < 15) {
      // Find all expanders (PAA buttons and 'see all results for this question')
      const expanders = await page.evaluateHandle((paaSelector) => {
        const paaButtons = Array.from(document.querySelectorAll(`${paaSelector} div[role="button"]`));
        // Find all 'see all results for this question' links/buttons
        const seeAlls = Array.from(document.querySelectorAll('a, span, div')).filter(el => {
          return /see all results for this question/i.test(el.innerText || '');
        });
        return [...paaButtons, ...seeAlls];
      }, paaSelector);
      const expanderElements = await expanders.getProperties();
      let clicked = 0;
      for (const expander of expanderElements.values()) {
        try {
          await expander.click();
          clicked++;
          await page.waitForTimeout(400 + Math.random() * 300); // Wait for new PAA to load
        } catch {}
      }
      // Count Q/A pairs
      const count = await page.evaluate(sel => document.querySelectorAll(sel).length, paaSelector);
      if (count >= maxPAA || count === prevCount || clicked === 0) break;
      prevCount = count;
      tries++;
    }
  }

  await expandPAAUntilLimit();

  // Now extract up to maxPAA Q/A pairs
  return await page.evaluate((paaSelector, maxPAA) => {
    const pairs = Array.from(document.querySelectorAll(paaSelector)).slice(0, maxPAA);
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
  }, paaSelector, maxPAA);
}
