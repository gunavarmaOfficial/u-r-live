import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import App from './App';
import { getSeoMeta, PRERENDER_PATHS, renderHeadTags, SITE } from './lib/seo';

export interface RenderedPage {
  html: string;
  head: string;
}

export function render(url: string): RenderedPage {
  const html = renderToString(
    <StaticRouter location={url}>
      <App />
    </StaticRouter>
  );
  return { html, head: renderHeadTags(getSeoMeta(url)) };
}

export function renderHead(url: string): string {
  return renderHeadTags(getSeoMeta(url));
}

export function renderSitemap(lastmod = new Date().toISOString().slice(0, 10)): string {
  const urls = PRERENDER_PATHS.map((path) => {
    const loc = `${SITE.url}${path === '/' ? '/' : path}`;
    const priority = path === '/' ? '1.0' : path === '/safety' ? '0.8' : '0.6';
    return [
      '  <url>',
      `    <loc>${loc}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      '    <changefreq>weekly</changefreq>',
      `    <priority>${priority}</priority>`,
      '  </url>',
    ].join('\n');
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

export { PRERENDER_PATHS, SITE };
