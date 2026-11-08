"use client";

import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react";
import type { LikeCounts } from "@/lib/types";

type Snapshot = { liked: boolean; counts: LikeCounts; pending: boolean };
const ZERO: LikeCounts = { total: 0, week: 0, year: 0 };

/**
 * Client store for like state. Each card subscribes to its own portfolio id,
 * so toggling one like re-renders only the buttons for that portfolio
 * (grid card, ranking row and preview modal stay in sync).
 */
class LikeStore {
  private counts = new Map<number, LikeCounts>();
  private liked = new Set<number>();
  private seq = new Map<number, number>();
  private snapshots = new Map<number, Snapshot>();
  private listeners = new Map<number, Set<() => void>>();
  private errorListener: ((msg: string) => void) | null = null;

  constructor(counts: Record<number, LikeCounts>, likedIds: number[]) {
    for (const [id, c] of Object.entries(counts)) this.counts.set(Number(id), c);
    for (const id of likedIds) this.liked.add(id);
  }

  onError(fn: (msg: string) => void) {
    this.errorListener = fn;
  }

  subscribe(id: number, fn: () => void) {
    let set = this.listeners.get(id);
    if (!set) this.listeners.set(id, (set = new Set()));
    set.add(fn);
    return () => {
      set!.delete(fn);
    };
  }

  get(id: number): Snapshot {
    let snap = this.snapshots.get(id);
    if (!snap) {
      snap = { liked: this.liked.has(id), counts: this.counts.get(id) ?? ZERO, pending: this.seq.has(id) };
      this.snapshots.set(id, snap);
    }
    return snap;
  }

  /** Current counts for sorting; read once when a sort is applied. */
  countsFor(id: number): LikeCounts {
    return this.counts.get(id) ?? ZERO;
  }

  private emit(id: number) {
    this.snapshots.delete(id);
    this.listeners.get(id)?.forEach((fn) => fn());
  }

  private apply(id: number, liked: boolean, counts: LikeCounts) {
    if (liked) this.liked.add(id);
    else this.liked.delete(id);
    this.counts.set(id, counts);
  }

  async toggle(id: number) {
    const prevLiked = this.liked.has(id);
    const prevCounts = this.counts.get(id) ?? ZERO;
    const next = !prevLiked;
    const d = next ? 1 : -1;

    // Optimistic update.
    this.apply(id, next, {
      total: Math.max(0, prevCounts.total + d),
      week: Math.max(0, prevCounts.week + d),
      year: Math.max(0, prevCounts.year + d),
    });
    const mySeq = (this.seq.get(id) ?? 0) + 1;
    this.seq.set(id, mySeq);
    this.emit(id);

    try {
      // Send the desired state (not "toggle") so rapid clicks and retries
      // are idempotent on the server.
      const res = await fetch(`/api/portfolios/${id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liked: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      if (this.seq.get(id) === mySeq) {
        this.apply(id, data.liked, data.likes);
        this.seq.delete(id);
        this.emit(id);
      }
    } catch (err) {
      if (this.seq.get(id) === mySeq) {
        this.apply(id, prevLiked, prevCounts);
        this.seq.delete(id);
        this.emit(id);
        this.errorListener?.(err instanceof Error ? err.message : "Couldn't save your like. Please try again.");
      }
    }
  }
}

const LikesContext = createContext<LikeStore | null>(null);

export function LikesProvider({
  counts,
  likedIds,
  children,
}: {
  counts: Record<number, LikeCounts>;
  likedIds: number[];
  children: React.ReactNode;
}) {
  const [store] = useState(() => new LikeStore(counts, likedIds));
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    store.onError(setToast);
  }, [store]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <LikesContext.Provider value={store}>
      {children}
      <div className={`toast${toast ? " show" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </LikesContext.Provider>
  );
}

export function useLikeStore(): LikeStore {
  const store = useContext(LikesContext);
  if (!store) throw new Error("useLikeStore must be used inside <LikesProvider>");
  return store;
}

export function useLike(id: number) {
  const store = useLikeStore();
  const subscribe = useCallback((fn: () => void) => store.subscribe(id, fn), [store, id]);
  const getSnapshot = useCallback(() => store.get(id), [store, id]);
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const toggle = useCallback(() => store.toggle(id), [store, id]);
  return { ...snap, toggle };
}
