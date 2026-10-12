// Offline support: the last loaded notebook is cached in IndexedDB so the app opens without the
// network; writes made while offline are queued and replayed when a connection is back.
const DB = "notebooks";
const STORE = "cache";

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest): Promise<unknown> {
  try {
    const db = await open();
    return await new Promise((res, rej) => {
      const r = f(db.transaction(STORE, mode).objectStore(STORE));
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  } catch {
    return undefined;
  }
}
export const cacheGet = <T>(key: string) => tx("readonly", (s) => s.get(key)) as Promise<T | undefined>;
export const cacheSet = (key: string, value: unknown) => tx("readwrite", (s) => s.put(value, key));
export const cacheDel = (key: string) => tx("readwrite", (s) => s.delete(key));

/** `base` is the server's `modified` when the first offline edit was made ("0" for a note made offline);
 *  on sync, a server copy newer than that is a conflict instead of being overwritten. */
export type Queued = { canister: string; path: string; content: string; at: number; base?: string };
export async function queueWrite(q: Queued) {
  const prev = ((await cacheGet<Queued[]>("queue")) ?? []);
  const old = prev.find((x) => x.canister === q.canister && x.path === q.path);
  const all = prev.filter((x) => x !== old);
  all.push(old?.base !== undefined ? { ...q, base: old.base } : q);
  await cacheSet("queue", all);
}
export const queued = async () => (await cacheGet<Queued[]>("queue")) ?? [];
export const clearQueue = () => cacheSet("queue", []);
