import { LEGAL, LEGAL_DOCS, LEGAL_PATHS, isLegalDocSlug } from '../legal/config';
import { LEGAL_CONTENT } from '../legal/content';
import { FAQ_ITEMS } from '../data/faq';

export const SITE = {
  name: 'U-R-LIVE',
  url: ((import.meta as any).env?.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '') || 'https://u-r-live.com',
  defaultTitle: 'U-R-LIVE — Live Random Video Chat for Adults (18+)',
  defaultDescription:
    'Meet someone new face to face. U-R-LIVE is an 18+ live random video chat with instant server-side matching, encrypted peer-to-peer video and zero recordings.',
  ogImage: '/og/default.jpg',
  twitterHandle: '@urlive',
};

export interface SeoMeta {
  path: string;
  title: string;
  description: string;
  robots: string;
  image: string;
  jsonLd: Record<string, unknown>[];
}

const ORGANIZATION_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE.name,
  url: SITE.url,
  logo: `${SITE.url}/logo.png`,
  email: LEGAL.supportEmail,
  contactPoint: [
    {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: LEGAL.supportEmail,
      availableLanguage: ['English', 'Hindi'],
    },
  ],
};

const WEBSITE_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE.name,
  url: SITE.url,
  inLanguage: 'en',
  description: SITE.defaultDescription,
};

const FAQ_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: { '@type': 'Answer', text: item.answer },
  })),
};

const PUBLIC_ROUTES = new Set<string>([
  '/',
  '/safety',
  ...LEGAL_DOCS.map((slug) => LEGAL_PATHS[slug]),
]);

export const PRERENDER_PATHS: string[] = ['/', '/safety', ...LEGAL_DOCS.map((slug) => LEGAL_PATHS[slug])];

export function normalizePath(pathname: string): string {
  if (!pathname) return '/';
  const clean = pathname.split('?')[0].split('#')[0];
  if (clean.length > 1 && clean.endsWith('/')) return clean.slice(0, -1);
  return clean || '/';
}

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.has(normalizePath(pathname));
}

export function getSeoMeta(pathname: string): SeoMeta {
  const path = normalizePath(pathname);
  const base = { path, robots: 'index, follow', image: `${SITE.url}${SITE.ogImage}`, jsonLd: [] as Record<string, unknown>[] };

  if (path === '/') {
    return {
      ...base,
      title: SITE.defaultTitle,
      description: SITE.defaultDescription,
      jsonLd: [ORGANIZATION_LD, WEBSITE_LD],
    };
  }

  if (path === '/safety') {
    return {
      ...base,
      title: 'Safety Centre — reporting, blocking and 18+ policy | U-R-LIVE',
      description:
        'How U-R-LIVE keeps live video chat safe: 18+ age assurance, one-tap reporting and blocking, moderation, zero recordings and clear enforcement.',
      jsonLd: [FAQ_LD, ORGANIZATION_LD],
    };
  }

  const legalSlug = path.slice(1);
  if (isLegalDocSlug(legalSlug)) {
    const doc = LEGAL_CONTENT[legalSlug];
    return {
      ...base,
      title: `${doc.title} | U-R-LIVE`,
      description: doc.description,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url },
            { '@type': 'ListItem', position: 2, name: doc.title, item: `${SITE.url}${LEGAL_PATHS[legalSlug]}` },
          ],
        },
        {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: doc.title,
          url: `${SITE.url}${LEGAL_PATHS[legalSlug]}`,
          datePublished: LEGAL.termsVersion,
          dateModified: LEGAL.termsVersion,
        },
      ],
    };
  }

  if (path === '/live' || path === '/admin') {
    return {
      ...base,
      title: path === '/live' ? 'Live video chat | U-R-LIVE' : 'Staff portal | U-R-LIVE',
      description: 'This page requires a live session and is not indexed.',
      robots: 'noindex, nofollow',
    };
  }

  return {
    ...base,
    title: 'Page not found | U-R-LIVE',
    description: 'The page you requested could not be found.',
    robots: 'noindex, follow',
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function serializeJsonLd(value: Record<string, unknown>): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function renderHeadTags(meta: SeoMeta): string {
  const canonical = `${SITE.url}${meta.path === '/' ? '/' : meta.path}`;
  const isIndexable = !meta.robots.startsWith('noindex');
  const tags = [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    `<meta name="robots" content="${escapeHtml(meta.robots)}" />`,
    ...(isIndexable
      ? [
          `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
          `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
        ]
      : []),
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE.name}" />`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:image" content="${escapeHtml(meta.image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="U-R-LIVE live random video chat" />`,
    `<meta property="og:locale" content="en_US" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(meta.image)}" />`,
    ...meta.jsonLd.map(
      (entry) =>
        `<script type="application/ld+json" data-seo-jsonld="true">${serializeJsonLd(entry)}</script>`
    ),
  ];
  return tags.join('\n    ');
}
