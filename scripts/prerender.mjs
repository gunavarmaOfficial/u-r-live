/**
 * Prerenders public routes into dist/<route>/index.html and emits sitemap.xml.
 * Runs after `vite build` and `vite build --ssr src/entry-server.tsx`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const ssrEntry = path.join(root, 'dist-ssr', 'entry-server.js');
const HEAD_START = '<!--app-head-->';
const HEAD_END = '<!--/app-head-->';
const CLIENT_ONLY_PATHS = ['/live', '/admin'];

if (!fs.existsSync(ssrEntry)) {
  console.error(`[prerender] SSR bundle missing at ${ssrEntry}. Run the SSR build first.`);
  process.exit(1);
}

const templateUrl = path.join(distDir, 'index.html');
if (!fs.existsSync(templateUrl)) {
  console.error(`[prerender] dist/index.html missing at ${templateUrl}. Run the client build first.`);
  process.exit(1);
}

const template = fs.readFileSync(templateUrl, 'utf-8');
if (!template.includes(HEAD_START) || !template.includes(HEAD_END)) {
  console.error('[prerender] dist/index.html is missing <!--app-head--> markers.');
  process.exit(1);
}

const ssr = await import(pathToFileURL(ssrEntry).href);
const { render, renderHead, renderSitemap, PRERENDER_PATHS } = ssr;

function buildPage({ head, html }) {
  const [beforeHead, rest] = template.split(HEAD_START);
  const [, afterHead] = rest.split(HEAD_END);
  const withHead = `${beforeHead}${head}${afterHead}`;
  return withHead.replace('<div id="root"></div>', `<div id="root">${html}</div>`);
}

function writeRoute(routePath, contents) {
  const targetDir = routePath === '/' ? distDir : path.join(distDir, routePath.replace(/^\//, ''));
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'index.html'), contents, 'utf-8');
}

let written = 0;

for (const routePath of PRERENDER_PATHS) {
  const page = render(routePath);
  writeRoute(routePath, buildPage(page));
  written += 1;
}

// Client-only routes get real HTML documents with noindex head tags and an
// empty root so the SPA boots with createRoot instead of hydrating.
for (const routePath of CLIENT_ONLY_PATHS) {
  writeRoute(routePath, buildPage({ head: renderHead(routePath), html: '' }));
  written += 1;
}

// Prerender the 404 page once; the server returns it with an HTTP 404 status.
fs.writeFileSync(path.join(distDir, '404.html'), buildPage(render('/404')), 'utf-8');
written += 1;

fs.writeFileSync(path.join(distDir, 'sitemap.xml'), renderSitemap(), 'utf-8');

console.log(`[prerender] Wrote ${written} HTML documents plus sitemap.xml.`);
