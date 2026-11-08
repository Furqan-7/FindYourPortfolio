import { NextResponse } from "next/server";
import { countSubmissionsSince, createPortfolio, findByUrl, listPortfolios } from "@/lib/portfolios";
import { normalizePublicUrl } from "@/lib/url";
import { ensureVoterId } from "@/lib/voter";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/** GET /api/portfolios — every approved portfolio with like counts. */
export async function GET() {
  const portfolios = await listPortfolios();
  return NextResponse.json(
    { portfolios },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300" } },
  );
}

const DAY = 24 * 60 * 60 * 1000;
const MAX_PER_DAY = 5;

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** POST /api/portfolios — submit a new portfolio. */
export async function POST(request: Request) {
  const ip = await clientIp();
  const limit = rateLimit(`submit:${ip}`, 10, 60 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Honeypot: real users never see or fill this field.
  if (clean(body.website, 200)) {
    return NextResponse.json({ ok: true, status: "pending" }, { status: 202 });
  }

  const name = clean(body.name, 80);
  const tagline = clean(body.tagline, 120);
  const fieldErrors: Record<string, string> = {};
  if (name.length < 2) fieldErrors.name = "Please enter your name (at least 2 characters).";
  const url = normalizePublicUrl(typeof body.url === "string" ? body.url : "");
  if (!url.ok) fieldErrors.url = url.error;
  if (Object.keys(fieldErrors).length > 0 || !url.ok) {
    return NextResponse.json({ error: "Please fix the highlighted fields.", fieldErrors }, { status: 422 });
  }

  const existing = await findByUrl(url.url);
  if (existing) {
    return NextResponse.json(
      {
        error: `This portfolio is already listed as “${existing.name}”.`,
        fieldErrors: { url: "This URL is already in the directory." },
        existingId: existing.id,
      },
      { status: 409 },
    );
  }

  const voterId = await ensureVoterId();
  if ((await countSubmissionsSince(voterId, Date.now() - DAY)) >= MAX_PER_DAY) {
    return NextResponse.json({ error: "You've reached today's submission limit. Try again tomorrow." }, { status: 429 });
  }

  try {
    const { portfolio, status } = await createPortfolio({ name, url: url.url, tagline, submittedBy: voterId });
    return NextResponse.json({ ok: true, status, portfolio }, { status: 201 });
  } catch (err) {
    if (String(err).includes("UNIQUE")) {
      return NextResponse.json(
        { error: "This portfolio was just added.", fieldErrors: { url: "This URL is already in the directory." } },
        { status: 409 },
      );
    }
    throw err;
  }
}
