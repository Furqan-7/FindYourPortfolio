"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Portfolio } from "@/lib/types";
import { PreviewImage } from "../PreviewImage";
import { LiveFrame } from "./LiveFrame";

/** How long the pointer must rest on a card before the page starts scrolling. */
export const HOVER_DELAY_MS = 3000;
/** Scroll speed through the full-page screenshot, in on-screen pixels per second. */
const SCROLL_SPEED = 140;
const RETURN_MS = 700;

type Phase = "idle" | "waiting" | "scrolling" | "returning";

/**
 * Full-page screenshot that pans from top to bottom while the card is
 * hovered. Browsers don't allow a page to scroll a cross-origin iframe, so
 * the scroll runs on a tall screenshot layered over the live site.
 */
function HoverScroll({ src, active, onScrollingChange }: { src: string; active: boolean; onScrollingChange: (v: boolean) => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [requested, setRequested] = useState(false); // start downloading on first hover
  const [ready, setReady] = useState(false);
  const [armed, setArmed] = useState(false);
  const [distance, setDistance] = useState(0);

  // Hover state machine: wait 3s → scroll down → on leave, glide back up.
  useEffect(() => {
    if (active) {
      setRequested(true);
      setArmed(false);
      setPhase("waiting");
      const t = setTimeout(() => setArmed(true), HOVER_DELAY_MS);
      return () => clearTimeout(t);
    }
    setArmed(false);
    setPhase((p) => (p === "scrolling" ? "returning" : "idle"));
  }, [active]);

  useEffect(() => {
    if (phase === "waiting" && armed && ready) setPhase("scrolling");
  }, [phase, armed, ready]);

  useEffect(() => {
    if (phase !== "returning") return;
    const t = setTimeout(() => setPhase("idle"), RETURN_MS);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    onScrollingChange(phase === "scrolling" || phase === "returning");
  }, [phase, onScrollingChange]);

  const measure = () => {
    const box = boxRef.current;
    const img = imgRef.current;
    if (box && img) setDistance(Math.max(0, img.getBoundingClientRect().height - box.getBoundingClientRect().height));
  };
  useLayoutEffect(() => {
    if (phase === "scrolling") measure();
  }, [phase]);

  const scrolling = phase === "scrolling";
  const style: React.CSSProperties = scrolling
    ? { transform: `translateY(${-distance}px)`, transition: `transform ${Math.max(2, distance / SCROLL_SPEED)}s linear` }
    : { transform: "translateY(0)", transition: phase === "returning" ? `transform ${RETURN_MS}ms ease-out` : "none" };

  return (
    <div
      ref={boxRef}
      className={`scroll-layer${scrolling || phase === "returning" ? " on" : ""}`}
      aria-hidden="true"
    >
      {requested && (
        <div className="scroll-pane">
          <img
            ref={imgRef}
            src={src}
            alt=""
            decoding="async"
            style={style}
            onLoad={() => {
              setReady(true);
              measure();
            }}
          />
        </div>
      )}
      {phase === "waiting" && <span className="scroll-progress" style={{ animationDuration: `${HOVER_DELAY_MS}ms` }} />}
    </div>
  );
}

/**
 * Card preview: screenshot (instant) → live website (once on screen) →
 * smooth full-page scroll after hovering for 3 seconds.
 */
export function SitePreview({
  portfolio,
  hovered,
  priority = false,
  onLiveChange,
}: {
  portfolio: Portfolio;
  hovered: boolean;
  priority?: boolean;
  onLiveChange?: (live: boolean) => void;
}) {
  const [scrolling, setScrolling] = useState(false);
  return (
    <PreviewImage
      name={portfolio.name}
      url={portfolio.url}
      preview={portfolio.preview}
      priority={priority}
      className={scrolling ? "is-scrolling" : ""}
    >
      <LiveFrame portfolio={portfolio} onLiveChange={onLiveChange} />
      {portfolio.fullPreview && (
        <HoverScroll src={portfolio.fullPreview} active={hovered} onScrollingChange={setScrolling} />
      )}
    </PreviewImage>
  );
}
