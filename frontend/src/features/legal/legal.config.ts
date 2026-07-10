/**
 * Single source for the legal-document identity fields shared by the Terms of
 * Service and Privacy Policy pages.
 *
 * ⚠️ REVIEW BEFORE LAUNCH: replace the placeholders below with your real
 * registered entity, contact address and governing law, and have the final
 * text reviewed by a lawyer. These pages are a solid, accurate-to-the-product
 * starting draft — not legal advice.
 */
export const LEGAL = {
  /** Product / brand name shown throughout the documents. */
  productName: 'CloudNSofts',
  /** TODO: your registered legal entity (e.g. "CloudNSofts Pvt. Ltd."). */
  legalEntity: 'CloudNSofts',
  /** TODO: a monitored contact inbox for privacy/legal requests. */
  contactEmail: 'support@cloudnsofts.com',
  /** TODO: confirm the governing jurisdiction with counsel. */
  governingLaw: 'India',
  /** Update whenever the documents materially change. */
  effectiveDate: 'July 10, 2026',
} as const;
