// Yahoo extraction logic
export default async function extractYahooQA(page, maxPAA = 20, visited = new Set()) {
  // Helper to extract Q/A from the current page
  async function extractCurrentPageQA() {
    return await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.bb-1.bingrelqa .itm'));
      let qa = [];
      for (let itm of items) {
        let question = '';
        const qSpan = itm.querySelector('.ttl-l .compText p span');
        if (qSpan) question = qSpan.innerText.trim();
        if (!question) {
          const qp = itm.querySelector('.ttl-l .compText p');
          if (qp) question = qp.innerText.trim();
        }
        let answer = '';
        const compTextList = itm.querySelector('.compTextList');
        if (compTextList) {
          const lis = Array.from(compTextList.querySelectorAll('li'));
          if (lis.length > 0) {
            answer = lis.map(li => li.innerText.trim()).join('\n');
          } else {
            answer = compTextList.innerText.trim();
          }
        }
        if (!answer) {
          const expCompText = itm.querySelector('.exp .compText');
          if (expCompText) answer = expCompText.innerText.trim();
        }
        if (question && answer && answer.length > 10) {
          qa.push({ question, answer });
        }
      }
      // Find all 'See all results for this question' links
      const seeAllLinks = Array.from(document.querySelectorAll('a, span, div')).filter(el => {
        return /see all results for this question/i.test(el.innerText || '') && el.href;
      }).map(el => el.href);
      return { qa, seeAllLinks };
    });
  }

  let allQA = [];
  let toVisit = [];
  // Only extract from the current page if not visited
  const url = await page.url();
  if (!visited.has(url)) {
    visited.add(url);
    const { qa, seeAllLinks } = await extractCurrentPageQA();
    allQA.push(...qa);
    toVisit.push(...seeAllLinks.filter(link => !visited.has(link)));
  }

  // Recursively visit 'See all results for this question' links until maxPAA is reached
  while (allQA.length < maxPAA && toVisit.length > 0) {
    const nextUrl = toVisit.shift();
    if (!nextUrl || visited.has(nextUrl)) continue;
    visited.add(nextUrl);
    try {
      await page.goto(nextUrl, { waitUntil: 'domcontentloaded' });
      const { qa, seeAllLinks } = await extractCurrentPageQA();
      // Avoid duplicates by question text
      for (const item of qa) {
        if (!allQA.some(existing => existing.question === item.question)) {
          allQA.push(item);
        }
      }
      toVisit.push(...seeAllLinks.filter(link => !visited.has(link)));
    } catch (e) {
      // Ignore navigation errors
    }
  }

  // Limit to maxPAA
  return allQA.slice(0, maxPAA);
}
