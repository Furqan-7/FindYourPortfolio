/**
 * Public address of the site, used for absolute URLs in link previews
 * (Open Graph / X cards need absolute image URLs on the real domain).
 *
 * 1. NEXT_PUBLIC_SITE_URL, if set (use this for a custom domain).
 * 2. On Vercel production: the project's production domain, which Vercel
 *    provides automatically as VERCEL_PROJECT_PRODUCTION_URL.
 * 3. On Vercel preview deployments: that deployment's own URL.
 * 4. Locally: http://localhost:<PORT>.
 */
export function siteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return new URL(/^https?:\/\//.test(explicit) ? explicit : `https://${explicit}`);

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (process.env.VERCEL_ENV === "production" && production) return new URL(`https://${production}`);

  const preview = process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;
  if (preview) return new URL(`https://${preview}`);
  if (production) return new URL(`https://${production}`);

  return new URL(`http://localhost:${process.env.PORT || 3000}`);
}
