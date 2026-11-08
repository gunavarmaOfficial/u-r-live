/**
 * Single source of truth for legal identity and policy versioning.
 * Replace every [PLACEHOLDER] value with your registered company details
 * before launch. Bumping termsVersion forces existing users to re-accept.
 */
export const LEGAL = {
  productName: 'U-R-LIVE',
  entityName: '[LEGAL_ENTITY_NAME]',
  registeredAddress: '[REGISTERED_ADDRESS]',
  jurisdiction: '[JURISDICTION_CITY], [JURISDICTION_COUNTRY]',
  grievanceOfficer: '[GRIEVANCE_OFFICER_NAME]',
  grievanceEmail: 'grievance@u-r-live.com',
  supportEmail: 'support@u-r-live.com',
  effectiveDate: '28 October 2026',
  termsVersion: '2026-10-28',
  minimumAge: 18,
  refundWindowDays: 7,
} as const;

export const LEGAL_DOCS = ['terms', 'privacy', 'cookies', 'community-rules'] as const;
export type LegalDocSlug = (typeof LEGAL_DOCS)[number];

export const LEGAL_PATHS: Record<LegalDocSlug, string> = {
  terms: '/terms',
  privacy: '/privacy',
  cookies: '/cookies',
  'community-rules': '/community-rules',
};

export function isLegalDocSlug(value: string): value is LegalDocSlug {
  return (LEGAL_DOCS as readonly string[]).includes(value);
}
