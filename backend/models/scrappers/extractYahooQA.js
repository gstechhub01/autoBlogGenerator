// Yahoo extraction logic
export default async function extractYahooQA(page) {
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
    return qa;
  });
}
