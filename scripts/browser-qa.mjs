import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer-core';

const require = createRequire(import.meta.url);
const root = resolve('dist');
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf', '.odt': 'application/vnd.oasis.opendocument.text',
};
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = resolve(root, `.${pathname}`);
    if (!file.startsWith(root)) throw new Error('path traversal');
    if (pathname.endsWith('/')) file = join(file, 'index.html');
    else {
      try { await readFile(file); }
      catch { if (await exists(join(file, 'index.html'))) file = join(file, 'index.html'); }
    }
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

async function exists(file) {
  try { await readFile(file); return true; } catch { return false; }
}

await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const address = server.address();
const origin = `http://127.0.0.1:${address.port}`;
const executablePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await puppeteer.launch({ headless: true, executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const routes = [
  '/', '/how-it-works/', '/clocking/', '/specification/', '/specification/full/', '/explore/', '/build-and-test/',
  '/contribute/', '/about/', '/journal/', '/journal/why-o2at/', '/journal/whose-clock/', '/journal/why-1g-sfp/', '/privacy/', '/terms/',
];
const errors = [];
const results = [];
try {
  for (const width of [375, 768, 1440, 1920]) {
    for (const route of routes) {
      const page = await browser.newPage();
      await page.setViewport({ width, height: 900 });
      page.on('pageerror', error => errors.push(`${route} @ ${width}px: ${error.message}`));
      await page.goto(`${origin}${route}`, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach(image => image.loading = 'eager'));
      await new Promise(resolveWait => setTimeout(resolveWait, 60));
      const state = await page.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        title: document.title,
        headings: document.querySelectorAll('h1').length,
        brokenImages: [...document.images].filter(image => !image.complete || image.naturalWidth === 0).map(image => image.src),
      }));
      if (state.scrollWidth > state.width + 1) errors.push(`${route} @ ${width}px: horizontal page overflow ${state.scrollWidth}/${state.width}`);
      if (state.headings !== 1) errors.push(`${route} @ ${width}px: expected one h1, got ${state.headings}`);
      if (state.brokenImages.length) errors.push(`${route} @ ${width}px: broken images ${state.brokenImages.join(', ')}`);
      results.push({ route, width, scrollWidth: state.scrollWidth });
      await page.close();
    }
  }

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  for (const route of ['/', '/how-it-works/', '/clocking/', '/specification/', '/specification/full/', '/explore/', '/build-and-test/', '/contribute/', '/about/']) {
    await page.goto(`${origin}${route}`, { waitUntil: 'load' });
    await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
    const audit = await page.evaluate(async () => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }));
    for (const violation of audit.violations) errors.push(`${route}: axe ${violation.id} (${violation.impact}) ${violation.nodes.map(node => node.target.join(',')).join('; ')}`);
  }

  await page.setViewport({ width: 375, height: 844 });
  await page.goto(`${origin}/`, { waitUntil: 'load' });
  await page.keyboard.press('Tab');
  const skipFocused = await page.evaluate(() => document.activeElement?.classList.contains('skip-link'));
  if (!skipFocused) errors.push('Keyboard: skip link is not first focus target.');
  await page.click('.nav-toggle');
  const navOpen = await page.evaluate(() => document.querySelector('.nav-toggle')?.getAttribute('aria-expanded') === 'true' && getComputedStyle(document.querySelector('#primary-nav')).display !== 'none');
  if (!navOpen) errors.push('Keyboard: mobile navigation button did not open the menu.');
  await page.click('#primary-nav a');
  const navClosed = await page.evaluate(() => document.querySelector('.nav-toggle')?.getAttribute('aria-expanded') === 'false');
  if (!navClosed) errors.push('Keyboard: selecting a mobile navigation link did not close the menu.');

  await page.setJavaScriptEnabled(false);
  await page.goto(`${origin}/`, { waitUntil: 'load' });
  const noJsNavigationVisible = await page.evaluate(() => getComputedStyle(document.querySelector('#primary-nav')).display !== 'none' && document.querySelectorAll('#primary-nav a').length >= 5);
  if (!noJsNavigationVisible) errors.push('No-JavaScript mode: primary navigation is unavailable.');
  await page.setJavaScriptEnabled(true);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(`${origin}/`, { waitUntil: 'load' });
  const reducedMotion = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior === 'auto');
  if (!reducedMotion) errors.push('Reduced-motion preference is not respected by page scrolling.');

  await page.goto(`${origin}/explore/`, { waitUntil: 'load' });
  const initialRate = await page.$eval('#wire-rate', node => node.textContent.trim());
  await page.$eval('#rate', node => { node.value = '3072000'; node.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.$eval('#channels', node => { node.value = '8'; node.dispatchEvent(new Event('input', { bubbles: true })); });
  const highRate = await page.$eval('#wire-rate', node => node.textContent.trim());
  const highPolicy = await page.$eval('#admission-result', node => node.textContent.trim());
  await page.$eval('#admission', node => { node.value = '80'; node.dispatchEvent(new Event('input', { bubbles: true })); });
  const lowPolicy = await page.$eval('#admission-result', node => node.textContent.trim());
  if (initialRate !== '6.528 Mb/s' || highRate !== '815.9232 Mb/s' || !highPolicy.includes('Within') || !lowPolicy.includes('Exceeds')) errors.push('Bandwidth calculator: interactive required-value or admission case failed.');
  await page.$eval('#source-mode', node => { node.value = 'common-reference'; node.dispatchEvent(new Event('input', { bubbles: true })); });
  const commonReferenceMargin = await page.$eval('#time-to-margin', node => node.textContent.trim());
  if (!commonReferenceMargin.includes('No sustained mismatch')) errors.push('Clock laboratory: common-reference mode displayed a sustained mismatch margin.');
  await browser.close();
} finally {
  server.close();
}

console.log(`Browser checks: ${results.length} route/viewport renders; nine axe route audits; keyboard nav and calculator interaction checks.`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('PASS: no overflow, page errors, missing images, axe violations, keyboard navigation faults or failed interactive assertions.');
}
