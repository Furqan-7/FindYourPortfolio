/** Helpers shared by server and client components (no Node APIs). */

export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function firstLetter(name: string): string {
  const c = name.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : "#";
}

const SCREENSHOT_TEMPLATE =
  process.env.NEXT_PUBLIC_SCREENSHOT_URL || "https://image.thum.io/get/width/640/crop/800/noanimate/{url}";

/** Remote screenshot for portfolios that have no bundled WebP preview yet. */
export function remoteScreenshot(url: string): string {
  return SCREENSHOT_TEMPLATE.replace("{encodedUrl}", encodeURIComponent(url)).replace("{url}", url);
}

const nf = new Intl.NumberFormat("en-US");
export function formatCount(n: number): string {
  return nf.format(n);
}

export function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
