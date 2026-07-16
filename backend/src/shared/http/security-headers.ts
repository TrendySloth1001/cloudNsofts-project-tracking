import type { NextFunction, Request, Response } from 'express';
import { env } from '../../infra/env';

/**
 * Baseline security response headers for the API. Kept dependency-free (a small,
 * explicit set beats pulling in a whole framework for a JSON API that sits
 * behind nginx/Cloudflare). No Content-Security-Policy here — this server
 * returns JSON, images and a download, not HTML documents; the frontend owns
 * its own CSP.
 */
export function securityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Don't let browsers MIME-sniff responses into a different content type.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // This API is never meant to be framed.
  res.setHeader('X-Frame-Options', 'DENY');
  // Don't leak URLs (which can carry ids) to other origins via the Referer.
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  // Force HTTPS for a year (incl. subdomains) — only in production, so local
  // http:// development isn't pinned to TLS.
  if (env.NODE_ENV === 'production') {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );
  }
  next();
}
