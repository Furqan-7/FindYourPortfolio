"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { Portfolio } from "@/lib/types";
import { getEmbedStatus, peekEmbedStatus } from "./embedStatus";
import { useLivePreviewsEnabled, useLiveSlot } from "./liveSlots";

const SITE_WIDTH = 1280;
const SITE_HEIGHT = 800;

/** On-screen state with a short dwell (skip fast scroll-bys) and a grace period before unloading. */
function useOnScreen(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  const [onScreen, setOnScreen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !active) {
      setOnScreen(false);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        clearTimeout(timer);
        const visible = entry.isIntersecting;
        timer = setTimeout(() => setOnScreen(visible), visible ? 200 : 1500);
      },
      { rootMargin: "80px 0px", threshold: 0.2 },
    );
    io.observe(el);
    return () => {
      clearTimeout(timer);
      io.disconnect();
    };
  }, [ref, active]);
  return onScreen;
}

function useWidth(ref: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

/**
 * Renders the real website, scaled down to fit the card, on top of the
 * screenshot. The screenshot stays visible until the site has painted, and
 * remains as the preview for sites that refuse to be embedded.
 */
export function LiveFrame({
  portfolio,
  onLiveChange,
}: {
  portfolio: Portfolio;
  onLiveChange?: (live: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const key = useId();
  const enabled = useLivePreviewsEnabled();
  const onScreen = useOnScreen(ref, enabled);
  const width = useWidth(ref);
  const [status, setStatus] = useState(() => peekEmbedStatus(portfolio.id, portfolio.frameable));
  const [loaded, setLoaded] = useState(false);
  // Bumped whenever the iframe is unmounted, so a late load timer from an
  // old iframe can't mark a new one as painted.
  const generation = useRef(0);

  useEffect(() => {
    if (!enabled || !onScreen || status !== undefined) return;
    let cancelled = false;
    getEmbedStatus(portfolio.id, portfolio.frameable).then((s) => {
      if (!cancelled) setStatus(s);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, onScreen, status, portfolio.id, portfolio.frameable]);

  const granted = useLiveSlot(key, enabled && onScreen && status === true);

  useEffect(() => {
    if (granted) return;
    generation.current++;
    setLoaded(false);
  }, [granted]);

  useEffect(() => {
    onLiveChange?.(granted && loaded);
  }, [granted, loaded, onLiveChange]);

  useEffect(() => {
    if (!granted || loaded) return;
    // Some sites never fire `load` (long-polling, streaming); show them anyway.
    const t = setTimeout(() => setLoaded(true), 12000);
    return () => clearTimeout(t);
  }, [granted, loaded]);

  return (
    <div ref={ref} className="live-layer" aria-hidden="true">
      {granted && width > 0 && (
        <iframe
          src={portfolio.url}
          title={`${portfolio.name} (live)`}
          tabIndex={-1}
          loading="eager"
          scrolling="no"
          sandbox="allow-scripts allow-same-origin"
          allow="autoplay 'none'; camera 'none'; microphone 'none'; geolocation 'none'"
          referrerPolicy="strict-origin-when-cross-origin"
          className={loaded ? "on" : ""}
          style={{ width: SITE_WIDTH, height: SITE_HEIGHT, transform: `scale(${width / SITE_WIDTH})` }}
          onLoad={() => {
            const g = generation.current;
            setTimeout(() => g === generation.current && setLoaded(true), 350);
          }}
        />
      )}
    </div>
  );
}
