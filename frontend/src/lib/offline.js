// Offline queue helpers - localStorage-based transaction fallback

const QUEUE_KEY = "kp_offline_tx_queue";
const CACHE_PRODUCTS_KEY = "kp_cache_products";
const CACHE_STORE_KEY = "kp_cache_store";

export const isOnline = () => typeof navigator !== "undefined" ? navigator.onLine : true;

export function queueTransaction(tx) {
  const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  q.push({ ...tx, _queued_at: new Date().toISOString(), _local_id: crypto.randomUUID() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  return q.length;
}

export function getQueue() {
  return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
}

export function clearQueue() {
  localStorage.setItem(QUEUE_KEY, "[]");
}

export function removeFromQueue(localId) {
  const q = getQueue().filter(t => t._local_id !== localId);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function cacheProducts(products) {
  try { localStorage.setItem(CACHE_PRODUCTS_KEY, JSON.stringify(products)); } catch {}
}
export function readCachedProducts() {
  try { return JSON.parse(localStorage.getItem(CACHE_PRODUCTS_KEY) || "[]"); } catch { return []; }
}
export function cacheStore(store) {
  try { localStorage.setItem(CACHE_STORE_KEY, JSON.stringify(store)); } catch {}
}
export function readCachedStore() {
  try { return JSON.parse(localStorage.getItem(CACHE_STORE_KEY) || "{}"); } catch { return {}; }
}

export async function syncQueue(api) {
  const q = getQueue();
  if (q.length === 0) return { synced: 0, failed: 0 };
  let synced = 0, failed = 0;
  for (const tx of q) {
    try {
      const { _queued_at, _local_id, ...body } = tx;
      await api.post("/transactions", body);
      removeFromQueue(_local_id);
      synced += 1;
    } catch { failed += 1; }
  }
  return { synced, failed };
}
