// KasirPintar AI - Offline-first data layer
// Uses IndexedDB for large data (products, offline_orders_queue) with localStorage fallback

const DB_NAME = "kasirpintar";
const DB_VERSION = 1;
const STORE_PRODUCTS = "products";
const STORE_QUEUE = "offline_orders_queue";
const STORE_META = "meta";

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) return reject(new Error("IDB unsupported"));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PRODUCTS)) db.createObjectStore(STORE_PRODUCTS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(STORE_QUEUE)) db.createObjectStore(STORE_QUEUE, { keyPath: "_local_id" });
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(store, mode = "readonly") {
  const db = await openDB();
  return db.transaction(store, mode).objectStore(store);
}

async function idbAll(store) {
  try {
    const s = await tx(store);
    return await new Promise((res, rej) => {
      const r = s.getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
  } catch { return []; }
}
async function idbPut(store, obj) {
  try {
    const s = await tx(store, "readwrite");
    return await new Promise((res, rej) => {
      const r = s.put(obj);
      r.onsuccess = () => res(true);
      r.onerror = () => rej(r.error);
    });
  } catch { return false; }
}
async function idbDelete(store, key) {
  try {
    const s = await tx(store, "readwrite");
    return await new Promise((res) => {
      const r = s.delete(key);
      r.onsuccess = () => res(true);
      r.onerror = () => res(false);
    });
  } catch { return false; }
}
async function idbClear(store) {
  try {
    const s = await tx(store, "readwrite");
    return await new Promise((res) => { const r = s.clear(); r.onsuccess = () => res(true); r.onerror = () => res(false); });
  } catch { return false; }
}
async function idbGet(store, key) {
  try {
    const s = await tx(store);
    return await new Promise((res) => {
      const r = s.get(key);
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    });
  } catch { return null; }
}

export const isOnline = () => (typeof navigator !== "undefined" ? navigator.onLine : true);

// --- Products cache ---
export async function cacheProducts(products) {
  try {
    const db = await openDB();
    const t = db.transaction(STORE_PRODUCTS, "readwrite");
    t.objectStore(STORE_PRODUCTS).clear();
    for (const p of products) t.objectStore(STORE_PRODUCTS).put(p);
    await new Promise((res) => (t.oncomplete = res));
  } catch {
    localStorage.setItem("kp_cache_products", JSON.stringify(products));
  }
}
export async function readCachedProducts() {
  const list = await idbAll(STORE_PRODUCTS);
  if (list.length) return list;
  try { return JSON.parse(localStorage.getItem("kp_cache_products") || "[]"); } catch { return []; }
}
export async function updateLocalStock(productId, deltaQty) {
  const p = await idbGet(STORE_PRODUCTS, productId);
  if (!p) return null;
  p.stock = Math.max(0, (p.stock || 0) + deltaQty);
  await idbPut(STORE_PRODUCTS, p);
  return p;
}

// --- Store profile cache ---
export async function cacheStore(store) {
  await idbPut(STORE_META, { key: "store", value: store });
  try { localStorage.setItem("kp_cache_store", JSON.stringify(store)); } catch {}
}
export async function readCachedStore() {
  const m = await idbGet(STORE_META, "store");
  if (m) return m.value;
  try { return JSON.parse(localStorage.getItem("kp_cache_store") || "{}"); } catch { return {}; }
}

// --- Offline transaction queue ---
export async function queueTransaction(txPayload) {
  const entry = {
    ...txPayload,
    _local_id: (crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2)),
    _queued_at: new Date().toISOString(),
  };
  await idbPut(STORE_QUEUE, entry);
  // Deduct local stock immediately
  for (const it of (txPayload.items || [])) {
    await updateLocalStock(it.product_id, -it.qty);
  }
  return entry;
}
export async function getQueue() {
  return await idbAll(STORE_QUEUE);
}
export async function queueSize() {
  return (await idbAll(STORE_QUEUE)).length;
}
export async function removeFromQueue(localId) {
  await idbDelete(STORE_QUEUE, localId);
}
export async function clearQueue() {
  await idbClear(STORE_QUEUE);
}

// --- Full local cache reset (called on login/logout to prevent tenant leakage) ---
export async function clearAllLocalData() {
  try {
    await idbClear(STORE_PRODUCTS);
    await idbClear(STORE_QUEUE);
    await idbClear(STORE_META);
  } catch {}
  try {
    const keys = Object.keys(localStorage);
    for (const k of keys) {
      if (k.startsWith("kp_cache_") || k.startsWith("kp_last_")) {
        localStorage.removeItem(k);
      }
    }
  } catch {}
  try {
    const keys = Object.keys(sessionStorage);
    for (const k of keys) {
      if (k.startsWith("kp_")) sessionStorage.removeItem(k);
    }
  } catch {}
}

export async function syncQueue(api) {
  const q = await getQueue();
  if (!q.length) return { synced: 0, failed: 0 };
  let synced = 0, failed = 0;
  for (const t of q) {
    try {
      const { _local_id, _queued_at, ...body } = t;
      await api.post("/transactions", body);
      await removeFromQueue(_local_id);
      synced += 1;
    } catch { failed += 1; }
  }
  return { synced, failed };
}
