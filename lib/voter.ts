import "server-only";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

export const VOTER_COOKIE = "fyp_vid";
const ONE_YEAR = 60 * 60 * 24 * 365;
const VALID = /^[0-9a-f-]{36}$/;

/** Anonymous visitor id stored in an httpOnly cookie (no sign-up needed). */
export async function readVoterId(): Promise<string | null> {
  const value = (await cookies()).get(VOTER_COOKIE)?.value;
  return value && VALID.test(value) ? value : null;
}

/** Returns the visitor id, issuing a new cookie when the visitor has none. */
export async function ensureVoterId(): Promise<string> {
  const existing = await readVoterId();
  if (existing) return existing;
  const id = randomUUID();
  (await cookies()).set(VOTER_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR * 2,
  });
  return id;
}
