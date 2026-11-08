/**
 * Client-side cache of "can this portfolio be shown in an iframe?".
 * Lookups from many cards are batched into one /api/embed request.
 */

type Status = boolean | null;

const BATCH_SIZE = 12;
const RETRY_UNKNOWN_AFTER = 60_000;

const known = new Map<number, boolean>();
const unknownAt = new Map<number, number>();
const inflight = new Map<number, Promise<Status>>();
const resolvers = new Map<number, (s: Status) => void>();
let queue: number[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  timer = null;
  const batch = queue.splice(0, BATCH_SIZE);
  if (queue.length) timer = setTimeout(flush, 0);
  let statuses: Record<string, Status> = {};
  try {
    const res = await fetch(`/api/embed?ids=${batch.join(",")}`);
    if (res.ok) statuses = (await res.json()).statuses ?? {};
  } catch {
    // network error: treat as unknown
  }
  for (const id of batch) {
    const s = statuses[id] ?? null;
    if (s === null) unknownAt.set(id, Date.now());
    else known.set(id, s);
    inflight.delete(id);
    resolvers.get(id)?.(s);
    resolvers.delete(id);
  }
}

/** Synchronous answer if we already know it. */
export function peekEmbedStatus(id: number, hint: Status = null): Status | undefined {
  if (hint !== null) return hint;
  if (known.has(id)) return known.get(id)!;
  const at = unknownAt.get(id);
  if (at && Date.now() - at < RETRY_UNKNOWN_AFTER) return null;
  return undefined;
}

/** Resolves to true/false, or null when the site couldn't be checked. */
export function getEmbedStatus(id: number, hint: Status = null): Promise<Status> {
  const peeked = peekEmbedStatus(id, hint);
  if (peeked !== undefined) return Promise.resolve(peeked);
  let p = inflight.get(id);
  if (!p) {
    p = new Promise<Status>((resolve) => resolvers.set(id, resolve));
    inflight.set(id, p);
    queue.push(id);
    if (!timer) timer = setTimeout(flush, 30);
  }
  return p;
}
