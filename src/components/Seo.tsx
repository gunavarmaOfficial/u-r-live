import { useEffect } from 'react';
import { SITE, getSeoMeta, SeoMeta } from '../lib/seo';

function upsertMeta(selector: string, attribute: 'name' | 'property', key: string, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function upsertLink(rel: string, href: string): void {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

export function applySeo(meta: SeoMeta): void {
  document.title = meta.title;

  const canonical = `${SITE.url}${meta.path === '/' ? '/' : meta.path}`;
  const isIndexable = !meta.robots.startsWith('noindex');

  upsertMeta('meta[name="description"]', 'name', 'description', meta.description);
  upsertMeta('meta[name="robots"]', 'name', 'robots', meta.robots);
  upsertMeta('meta[property="og:title"]', 'property', 'og:title', meta.title);
  upsertMeta('meta[property="og:description"]', 'property', 'og:description', meta.description);
  upsertMeta('meta[property="og:image"]', 'property', 'og:image', meta.image);
  upsertMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
  upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', meta.title);
  upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', meta.description);
  upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', meta.image);

  if (isIndexable) {
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', canonical);
    upsertLink('canonical', canonical);
  } else {
    document.head.querySelector('meta[property="og:url"]')?.remove();
    document.head.querySelector('link[rel="canonical"]')?.remove();
  }

  document.head.querySelectorAll('script[data-seo-jsonld="true"]').forEach((node) => node.remove());
  for (const entry of meta.jsonLd) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.dataset.seoJsonld = 'true';
    script.textContent = JSON.stringify(entry);
    document.head.appendChild(script);
  }
}

interface SeoProps {
  path: string;
}

export const Seo: React.FC<SeoProps> = ({ path }) => {
  useEffect(() => {
    applySeo(getSeoMeta(path));
  }, [path]);

  return null;
};
