const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const px = mm => mm*96/25.4;
  const p = await b.newPage({ viewport: { width: Math.ceil(px(192)), height: Math.ceil(px(142)) }, deviceScaleFactor: 600/96 });
  await p.goto('file://' + __dirname + '/fondo.html', { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: './master.pdf', preferCSSPageSize: true, printBackground: true });
  for (const [n, m] of [['exacto',6],['sangrado',3]])
    await p.screenshot({ path: `./${n}-raw.png`, clip: { x: px(m), y: px(m), width: px(192-2*m), height: px(142-2*m) } });
  await b.close();
})();
