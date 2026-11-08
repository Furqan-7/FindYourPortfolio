"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Portfolio } from "@/lib/types";
import { originOf } from "@/lib/format";
import { LivePreviewModal } from "./LivePreviewModal";
import { getEmbedStatus } from "./live/embedStatus";
import { liveSlots } from "./live/liveSlots";

type PreviewApi = {
  open: (portfolio: Portfolio, list?: Portfolio[]) => void;
  /** Warm up the live preview (DNS/TLS + embed check) on hover/focus. */
  prefetch: (portfolio: Portfolio) => void;
  embedStatus: (portfolio: Portfolio) => Promise<boolean | null>;
};

const PreviewContext = createContext<PreviewApi | null>(null);

export function PreviewProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ list: Portfolio[]; index: number } | null>(null);
  const warmed = useRef(new Set<string>());

  const embedStatus = useCallback((p: Portfolio) => getEmbedStatus(p.id, p.frameable), []);

  // Card iframes pause while the full-screen preview is open, so the site
  // being previewed gets the whole CPU and network.
  const isOpen = state !== null;
  useEffect(() => {
    liveSlots.setPaused(isOpen);
  }, [isOpen]);

  const prefetch = useCallback(
    (portfolio: Portfolio) => {
      const origin = originOf(portfolio.url);
      if (origin && !warmed.current.has(origin)) {
        warmed.current.add(origin);
        const link = document.createElement("link");
        link.rel = "preconnect";
        link.href = origin;
        document.head.appendChild(link);
      }
      void embedStatus(portfolio);
    },
    [embedStatus],
  );

  const open = useCallback((portfolio: Portfolio, list?: Portfolio[]) => {
    const items = list && list.length ? list : [portfolio];
    const index = Math.max(0, items.findIndex((p) => p.id === portfolio.id));
    setState({ list: items, index });
  }, []);

  const api = useMemo(() => ({ open, prefetch, embedStatus }), [open, prefetch, embedStatus]);

  return (
    <PreviewContext.Provider value={api}>
      {children}
      {state && (
        <LivePreviewModal
          portfolio={state.list[state.index]}
          position={{ index: state.index, total: state.list.length }}
          onNavigate={(delta) =>
            setState((s) => {
              if (!s) return s;
              const index = (s.index + delta + s.list.length) % s.list.length;
              prefetch(s.list[(index + delta + s.list.length) % s.list.length]);
              return { ...s, index };
            })
          }
          onClose={() => setState(null)}
        />
      )}
    </PreviewContext.Provider>
  );
}

export function usePreview(): PreviewApi {
  const ctx = useContext(PreviewContext);
  if (!ctx) throw new Error("usePreview must be used inside <PreviewProvider>");
  return ctx;
}
