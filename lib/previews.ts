import { createHash } from "node:crypto";
import manifest from "@/data/preview-manifest.json";

const available = new Set<string>(manifest as string[]);

/** Pre-generated screenshots are named md5(lowercased url).webp. */
export function previewHash(url: string): string {
  return createHash("md5").update(url.trim().toLowerCase()).digest("hex");
}

/** Path of the bundled WebP screenshot for a URL, or null if none exists yet. */
export function localPreviewFor(url: string): string | null {
  const hash = previewHash(url);
  return available.has(hash) ? `/previews/${hash}.webp` : null;
}
