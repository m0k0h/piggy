const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 680, height: 491 }, deviceScaleFactor: 300/96 });
  await p.goto('file://' + __dirname + '/final.html', { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.locator('.lienzo').screenshot({ path: 'hucha-tigresas-18x13.png' });
  await p.pdf({ path: 'hucha-tigresas-18x13.pdf', width: '18cm', height: '13cm', printBackground: true });
  await b.close();
})();
