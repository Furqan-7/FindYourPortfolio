"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Portfolio } from "@/lib/types";
import { displayUrl } from "@/lib/format";
import { usePreview } from "./PreviewProvider";
import { LikeButton } from "./LikeButton";
import { PreviewImage } from "./PreviewImage";
import { ChevronIcon, CloseIcon, ExternalIcon, ReloadIcon } from "./Icons";

const DEVICES = {
  desktop: { label: "Desktop", width: 1280, height: 800 },
  tablet: { label: "Tablet", width: 820, height: 1180 },
  mobile: { label: "Mobile", width: 390, height: 844 },
} as const;
type Device = keyof typeof DEVICES;

type Phase = "loading" | "live" | "blocked";

export function LivePreviewModal({
  portfolio,
  position,
  onNavigate,
  onClose,
}: {
  portfolio: Portfolio;
  position: { index: number; total: number };
  onNavigate: (delta: number) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const { embedStatus } = usePreview();
  const [device, setDevice] = useState<Device>(() =>
    typeof window !== "undefined" && window.innerWidth < 700 ? "mobile" : "desktop",
  );
  const [phase, setPhase] = useState<Phase>("loading");
  // The iframe is revealed only once it has loaded AND the embed check has
  // settled, so sites that refuse framing never flash a blank/error page.
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [checked, setChecked] = useState(false);
  const [slow, setSlow] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [stage, setStage] = useState({ w: 0, h: 0 });

  // Open as a native modal dialog (focus trap + Esc for free) and lock scroll.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = prev;
    };
  }, []);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setStage({ w: rect.width, h: rect.height });
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setStage({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Start the iframe and the embed check in parallel for each portfolio.
  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    setFrameLoaded(false);
    setChecked(false);
    setSlow(false);
    embedStatus(portfolio.id).then((frameable) => {
      if (cancelled) return;
      setChecked(true);
      if (frameable === false) setPhase("blocked");
    });
    const t = setTimeout(() => !cancelled && setSlow(true), 8000);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [portfolio.id, reloadKey, embedStatus]);

  useEffect(() => {
    if (frameLoaded && checked) setPhase((p) => (p === "loading" ? "live" : p));
  }, [frameLoaded, checked]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (position.total < 2) return;
      if (e.key === "ArrowRight") onNavigate(1);
      if (e.key === "ArrowLeft") onNavigate(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNavigate, position.total]);

  const d = DEVICES[device];
  const pad = device === "desktop" ? 0 : 24;
  const scale =
    stage.w === 0
      ? 0
      : device === "desktop"
        ? Math.min(1, stage.w / d.width)
        : Math.min(1, (stage.h - pad * 2) / d.height, (stage.w - pad * 2) / d.width);
  // Desktop fills the whole stage (wider screens see more of the layout).
  const frameW = device === "desktop" && scale > 0 ? stage.w / scale : d.width;
  const frameH = device === "desktop" && scale > 0 ? stage.h / scale : d.height;

  return (
    <dialog
      ref={dialogRef}
      className="preview-dialog"
      aria-label={`Live preview of ${portfolio.name}'s portfolio`}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
    >
      <div className="preview-shell">
        <header className="preview-header">
          <div className="preview-title">
            <strong>{portfolio.name}</strong>
            <a href={portfolio.url} target="_blank" rel="noopener noreferrer">
              {displayUrl(portfolio.url)}
            </a>
          </div>

          <div className="device-toggle" role="group" aria-label="Preview size">
            {(Object.keys(DEVICES) as Device[]).map((key) => (
              <button
                key={key}
                type="button"
                className={device === key ? "active" : ""}
                aria-pressed={device === key}
                onClick={() => setDevice(key)}
              >
                {DEVICES[key].label}
              </button>
            ))}
          </div>

          <div className="preview-actions">
            {position.total > 1 && (
              <>
                <button type="button" className="icon-btn" onClick={() => onNavigate(-1)} aria-label="Previous portfolio">
                  <ChevronIcon dir="left" />
                </button>
                <span className="preview-pos">
                  {position.index + 1}/{position.total}
                </span>
                <button type="button" className="icon-btn" onClick={() => onNavigate(1)} aria-label="Next portfolio">
                  <ChevronIcon />
                </button>
              </>
            )}
            <button type="button" className="icon-btn" onClick={() => setReloadKey((k) => k + 1)} aria-label="Reload preview">
              <ReloadIcon />
            </button>
            <LikeButton id={portfolio.id} name={portfolio.name} size="md" />
            <a className="btn btn-primary btn-sm" href={portfolio.url} target="_blank" rel="noopener noreferrer">
              Visit <ExternalIcon width={14} height={14} />
            </a>
            <button type="button" className="icon-btn" onClick={() => dialogRef.current?.close()} aria-label="Close preview">
              <CloseIcon />
            </button>
          </div>
        </header>

        <div className={`preview-stage device-${device}`} ref={stageRef}>
          {scale > 0 && (
            <div
              className="device-frame"
              style={{
                width: frameW * scale,
                height: frameH * scale,
              }}
            >
              <PreviewImage
                key={`shot-${portfolio.id}`}
                name={portfolio.name}
                url={portfolio.url}
                preview={portfolio.preview}
                priority
                className={`stage-shot${phase === "live" ? " hidden" : ""}`}
              />
              {phase !== "blocked" && (
                <iframe
                  key={`${portfolio.id}-${reloadKey}`}
                  src={portfolio.url}
                  title={`${portfolio.name}'s portfolio`}
                  className={phase === "live" ? "live" : ""}
                  style={{
                    width: frameW,
                    height: frameH,
                    transform: `scale(${scale})`,
                  }}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                  referrerPolicy="strict-origin-when-cross-origin"
                  loading="eager"
                  onLoad={() => setFrameLoaded(true)}
                />
              )}
            </div>
          )}

          {phase === "loading" && (
            <div className="stage-status">
              <span className="spinner" aria-hidden="true" />
              {slow ? "Still loading — this site is slow. You can open it in a new tab." : "Loading live site…"}
            </div>
          )}
          {phase === "blocked" && (
            <div className="stage-blocked">
              <strong>This site doesn&apos;t allow embedded previews.</strong>
              <span>You&apos;re looking at a saved screenshot. Open the live site in a new tab instead.</span>
              <a className="btn btn-primary" href={portfolio.url} target="_blank" rel="noopener noreferrer">
                Open {displayUrl(portfolio.url)} <ExternalIcon width={14} height={14} />
              </a>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
