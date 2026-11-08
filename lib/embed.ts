import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isPrivateAddress } from "./url";

const TIMEOUT_MS = 4500;
const MAX_REDIRECTS = 4;

async function assertPublicHost(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new Error("non-public host");
  }
}

function blocksFraming(headers: Headers): boolean {
  const xfo = headers.get("x-frame-options")?.toLowerCase() ?? "";
  if (xfo.includes("deny") || xfo.includes("sameorigin")) return true;
  const csp = headers.get("content-security-policy")?.toLowerCase() ?? "";
  const directive = csp
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith("frame-ancestors"));
  if (!directive) return false;
  const sources = directive.split(/\s+/).slice(1);
  return !sources.some((s) => s === "*" || s === "https:" || s === "http:");
}

/**
 * Checks whether a site can be shown inside an iframe by inspecting its
 * X-Frame-Options / CSP headers. Every hop is resolved and verified to be a
 * public address so user-submitted URLs cannot be used to probe internal
 * networks.
 */
export async function checkFrameable(url: string): Promise<boolean> {
  let current = new URL(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (current.protocol !== "https:" && current.protocol !== "http:") return false;
      await assertPublicHost(current.hostname);
      const res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; FindYourPortfolioBot/1.0; +https://github.com/Furqan-7/FindYourPortfolio)",
          accept: "text/html,application/xhtml+xml",
        },
        cache: "no-store",
      });
      res.body?.cancel().catch(() => {});
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) return false;
        current = new URL(location, current);
        continue;
      }
      // A plain-http page cannot be embedded in an https site (mixed content).
      if (current.protocol === "http:") return false;
      // Error pages (often bot protection) still carry the site's framing
      // policy, and a real browser may get the full page, so judge by headers.
      return !blocksFraming(res.headers);
    }
    return false;
  } finally {
    clearTimeout(timer);
  }
}
