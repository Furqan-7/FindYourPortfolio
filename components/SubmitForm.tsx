"use client";

import Link from "next/link";
import { useState } from "react";
import { displayUrl, initials, remoteScreenshot } from "@/lib/format";
import type { Portfolio } from "@/lib/types";

type FieldErrors = Partial<Record<"name" | "url" | "tagline", string>>;
type Result =
  | { kind: "idle" }
  | { kind: "success"; portfolio: Portfolio; status: string }
  | { kind: "error"; message: string; existingName?: string };

function previewUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
}

export function SubmitForm() {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [tagline, setTagline] = useState("");
  const [shotFor, setShotFor] = useState<string | null>(null);
  const [shotState, setShotState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result>({ kind: "idle" });

  function refreshPreview() {
    const next = previewUrl(url);
    if (next !== shotFor) {
      setShotFor(next);
      setShotState(next ? "loading" : "idle");
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const clientErrors: FieldErrors = {};
    if (name.trim().length < 2) clientErrors.name = "Please enter your name (at least 2 characters).";
    if (!previewUrl(url)) clientErrors.url = "Please enter a valid website URL.";
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;

    setSubmitting(true);
    setResult({ kind: "idle" });
    try {
      const res = await fetch("/api/portfolios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, url, tagline, website: form.get("website") }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(data.fieldErrors ?? {});
        setResult({ kind: "error", message: data.error ?? "Something went wrong. Please try again." });
        return;
      }
      setResult({ kind: "success", portfolio: data.portfolio, status: data.status });
    } catch {
      setResult({ kind: "error", message: "Network error — please check your connection and try again." });
    } finally {
      setSubmitting(false);
    }
  }

  if (result.kind === "success") {
    const p = result.portfolio;
    const pending = result.status !== "approved";
    return (
      <div className="submit-success" role="status">
        <span className="success-mark" aria-hidden="true">✓</span>
        <h2>{pending ? "Thanks — your portfolio is in the review queue." : "You're in the directory!"}</h2>
        <p>
          <strong>{p?.name ?? name}</strong> · {displayUrl(p?.url ?? url)}
        </p>
        <div className="hero-ctas">
          {!pending && (
            <Link className="btn btn-primary" href={`/?sort=newest&q=${encodeURIComponent(p?.name ?? name)}#browse`}>
              View your listing
            </Link>
          )}
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              setName("");
              setUrl("");
              setTagline("");
              setShotFor(null);
              setShotState("idle");
              setResult({ kind: "idle" });
            }}
          >
            Add another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="submit-layout">
      <form className="submit-form" onSubmit={onSubmit} noValidate>
        <div className={`field${errors.name ? " invalid" : ""}`}>
          <label htmlFor="name">Your name</label>
          <input
            id="name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            autoComplete="name"
            placeholder="Ada Lovelace"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "name-error" : undefined}
            required
          />
          {errors.name && <span className="field-error" id="name-error">{errors.name}</span>}
        </div>

        <div className={`field${errors.url ? " invalid" : ""}`}>
          <label htmlFor="url">Portfolio URL</label>
          <input
            id="url"
            name="url"
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={refreshPreview}
            maxLength={300}
            autoComplete="url"
            placeholder="https://yourname.dev"
            aria-invalid={Boolean(errors.url)}
            aria-describedby={errors.url ? "url-error" : "url-hint"}
            required
          />
          {errors.url ? (
            <span className="field-error" id="url-error">{errors.url}</span>
          ) : (
            <span className="field-hint" id="url-hint">Must be a public website. We&apos;ll grab a preview automatically.</span>
          )}
        </div>

        <div className={`field${errors.tagline ? " invalid" : ""}`}>
          <label htmlFor="tagline">
            Role / tagline <span className="optional">optional</span>
          </label>
          <input
            id="tagline"
            name="tagline"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            maxLength={120}
            placeholder="Full Stack Developer · Design Engineer"
          />
          <span className="field-hint">{tagline.length}/120</span>
        </div>

        {/* Honeypot field for bots — hidden from people and assistive tech. */}
        <div className="hp" aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input id="website" name="website" tabIndex={-1} autoComplete="off" />
        </div>

        {result.kind === "error" && (
          <div className="form-error" role="alert">
            {result.message}
          </div>
        )}

        <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
          {submitting ? "Submitting…" : "Add my portfolio"}
        </button>
        <p className="field-hint">
          By submitting you confirm this is your own portfolio. Up to 5 submissions per day.
        </p>
      </form>

      <aside className="submit-preview" aria-label="Card preview">
        <p className="eyebrow">Card preview</p>
        <article className="card card-static">
          <div className="card-preview">
            <div className="preview-chrome" aria-hidden="true">
              <span className="ide-dot" />
              <span className="ide-dot" />
              <span className="ide-dot" />
            </div>
            <div className={`preview-img-wrap${shotState === "loading" ? " skeleton" : ""}`}>
              <div className="preview-fallback">{initials(name || "Your Name")}</div>
              {shotFor && shotState !== "error" && (
                <img
                  key={shotFor}
                  src={remoteScreenshot(shotFor)}
                  alt="Screenshot preview of your portfolio"
                  referrerPolicy="no-referrer"
                  className={shotState === "ok" ? "loaded" : ""}
                  onLoad={(e) => setShotState(e.currentTarget.naturalWidth > 50 ? "ok" : "error")}
                  onError={() => setShotState("error")}
                />
              )}
            </div>
          </div>
          <div className="card-body">
            <p className="card-name">{name || "Your Name"}</p>
            <p className="card-tagline">{tagline || "Your role or tagline"}</p>
            <div className="card-footer-row">
              <span className="card-url">{displayUrl(previewUrl(url) ?? "yourname.dev")}</span>
            </div>
          </div>
        </article>
        <p className="field-hint">
          {shotState === "error"
            ? "We couldn't capture a screenshot yet — your card will show your initials until one is generated."
            : "Previews are generated from your live site."}
        </p>
      </aside>
    </div>
  );
}
