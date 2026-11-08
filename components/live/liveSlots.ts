"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Live iframes are expensive (each one runs a whole website), so only a few
 * cards play live at once. Cards ask for a slot while they are on screen and
 * give it back when they scroll away.
 */

type Grant = () => void;

class SlotManager {
  private active = new Set<string>();
  private waiting: Array<{ key: string; grant: Grant }> = [];
  private grants = new Map<string, Grant>();
  private revokers = new Map<string, Grant>();
  private paused = false;

  private get max() {
    if (typeof window === "undefined") return 0;
    const small = window.matchMedia("(max-width: 700px), (pointer: coarse)").matches;
    return small ? 2 : 6;
  }

  request(key: string, grant: Grant, revoke: Grant) {
    this.grants.set(key, grant);
    this.revokers.set(key, revoke);
    this.waiting.push({ key, grant });
    this.pump();
  }

  release(key: string) {
    this.active.delete(key);
    this.waiting = this.waiting.filter((w) => w.key !== key);
    this.grants.delete(key);
    this.revokers.delete(key);
    this.pump();
  }

  /** Pause every card iframe (e.g. while the full-screen preview is open). */
  setPaused(paused: boolean) {
    if (this.paused === paused) return;
    this.paused = paused;
    if (paused) {
      for (const key of [...this.active]) {
        this.active.delete(key);
        const grant = this.grants.get(key);
        if (grant) this.waiting.unshift({ key, grant });
        this.revokers.get(key)?.();
      }
    } else {
      this.pump();
    }
  }

  private pump() {
    while (!this.paused && this.active.size < this.max && this.waiting.length) {
      const next = this.waiting.shift()!;
      this.active.add(next.key);
      next.grant();
    }
  }
}

export const liveSlots = new SlotManager();

/** True while this card holds a live-iframe slot. */
export function useLiveSlot(key: string, want: boolean): boolean {
  const [granted, setGranted] = useState(false);
  useEffect(() => {
    if (!want) return;
    liveSlots.request(
      key,
      () => setGranted(true),
      () => setGranted(false),
    );
    return () => {
      liveSlots.release(key);
      setGranted(false);
    };
  }, [key, want]);
  return want && granted;
}

// ---------------------------------------------------------------------------
// "Live previews" on/off setting, remembered per browser.

const STORAGE_KEY = "fyp_live_previews";
const listeners = new Set<() => void>();
let enabled: boolean | null = null;

function readSetting(): boolean {
  if (enabled !== null) return enabled;
  let value = true;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) value = stored === "1";
    else {
      const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
      if (conn?.saveData) value = false;
    }
  } catch {
    // storage unavailable: keep default
  }
  enabled = value;
  return value;
}

export function setLivePreviews(value: boolean) {
  enabled = value;
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

export function useLivePreviewsEnabled(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    readSetting,
    () => false,
  );
}
