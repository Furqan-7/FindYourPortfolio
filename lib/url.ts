import { isIP } from "node:net";

/** Canonical key used to detect duplicate portfolio URLs. */
export function urlKey(raw: string): string {
  const trimmed = raw.trim();
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const pathname = u.pathname.replace(/\/+$/, "");
    return `${host}${u.port ? `:${u.port}` : ""}${pathname}${u.search}`.toLowerCase();
  } catch {
    return trimmed.toLowerCase().replace(/^https?:\/*/, "").replace(/^www\./, "").replace(/\/+$/, "");
  }
}

const PRIVATE_V4: Array<[number, number]> = [
  [0x00000000, 8], // 0.0.0.0/8
  [0x0a000000, 8], // 10/8
  [0x64400000, 10], // 100.64/10 (CGNAT)
  [0x7f000000, 8], // 127/8
  [0xa9fe0000, 16], // 169.254/16 (link-local, cloud metadata)
  [0xac100000, 12], // 172.16/12
  [0xc0a80000, 16], // 192.168/16
  [0xc6120000, 15], // 198.18/15
  [0xe0000000, 3], // multicast + reserved
];

/** True for loopback, private, link-local and other non-public addresses. */
export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const n = ip.split(".").reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
    return PRIVATE_V4.some(([base, bits]) => (n >>> (32 - bits)) === (base >>> (32 - bits)));
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(lower);
  }
  return true;
}

export type UrlCheck = { ok: true; url: string } | { ok: false; error: string };

/** Validates and normalises a user-provided public website URL. */
export function normalizePublicUrl(raw: string): UrlCheck {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "Please enter your portfolio URL." };
  if (trimmed.length > 300) return { ok: false, error: "That URL is too long." };
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/+/, "")}`);
  } catch {
    return { ok: false, error: "That doesn't look like a valid URL." };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    return { ok: false, error: "Only http(s) URLs are supported." };
  }
  if (u.username || u.password) return { ok: false, error: "URLs with credentials are not allowed." };
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (isPrivateAddress(host)) return { ok: false, error: "Please use a public website address." };
  } else if (!host.includes(".") || host.endsWith(".local") || host.endsWith(".internal") || host === "localhost") {
    return { ok: false, error: "Please use a public website address." };
  }
  u.hash = "";
  let out = u.toString();
  if (u.pathname === "/" && !u.search) out = out.replace(/\/$/, "");
  return { ok: true, url: out };
}
