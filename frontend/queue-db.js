/**
 * BorrowBuddy — shared dispute queue storage (IndexedDB).
 * Loaded both in the page (script tag) and inside the service worker
 * (importScripts) so queued reports survive tab closes and can be sent
 * by Background Sync while the app isn't open.
 */
(function (scope) {
    const DB_NAME = 'bb-dispute-queue';
    const DB_VERSION = 2;
    const STORE = 'reports';
    const META = 'meta';
    const HISTORY = 'history';
    const HISTORY_LIMIT = 500;

    function open() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
                if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
                if (!db.objectStoreNames.contains(HISTORY)) {
                    const h = db.createObjectStore(HISTORY, { keyPath: 'eventId', autoIncrement: true });
                    h.createIndex('entryId', 'entryId');
                    h.createIndex('ts', 'ts');
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    function tx(storeName, mode, fn) {
        return open().then(db => new Promise((resolve, reject) => {
            const t = db.transaction(storeName, mode);
            const store = t.objectStore(storeName);
            let result;
            try { result = fn(store); } catch (e) { reject(e); return; }
            t.oncomplete = () => resolve(result && result.result !== undefined ? result.result : result);
            t.onerror = () => reject(t.error);
            t.onabort = () => reject(t.error);
        }));
    }

    const QueueDB = {
        async all() {
            const list = await tx(STORE, 'readonly', s => s.getAll());
            return (list || []).sort((a, b) => String(a.queuedAt).localeCompare(String(b.queuedAt)));
        },
        put(entry) {
            return tx(STORE, 'readwrite', s => s.put(entry));
        },
        async replaceAll(entries) {
            await tx(STORE, 'readwrite', s => {
                s.clear();
                (entries || []).forEach(e => s.put(e));
            });
        },
        remove(id) {
            return tx(STORE, 'readwrite', s => s.delete(id));
        },
        clear() {
            return tx(STORE, 'readwrite', s => s.clear());
        },
        setMeta(key, value) {
            return tx(META, 'readwrite', s => s.put(value, key));
        },
        getMeta(key) {
            return tx(META, 'readonly', s => s.get(key));
        },

        /* ── Sync history ─────────────────────────────────────────
           Append-only log of everything that happens to a queued
           dispute: queued, each upload attempt, each failure and the
           final outcome. Readable from the page and the worker. */
        async log(event) {
            const record = {
                ts: new Date().toISOString(),
                source: 'page',
                level: 'info',
                ...event
            };
            try {
                await tx(HISTORY, 'readwrite', s => s.add(record));
                await trim();
            } catch (e) { /* history is best-effort */ }
            return record;
        },
        async history() {
            const list = await tx(HISTORY, 'readonly', s => s.getAll());
            return (list || []).sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
        },
        clearHistory() {
            return tx(HISTORY, 'readwrite', s => s.clear());
        },
        // Removes only the events for one dispute (grouped by entryId in
        // the UI), leaving every other report's history untouched.
        clearHistoryFor(entryId) {
            return tx(HISTORY, 'readwrite', s => {
                const req = s.index('entryId').openCursor(IDBKeyRange.only(entryId));
                req.onsuccess = () => {
                    const cursor = req.result;
                    if (cursor) { cursor.delete(); cursor.continue(); }
                };
            });
        }
    };

    async function trim() {
        const all = await tx(HISTORY, 'readonly', s => s.getAll());
        if (!all || all.length <= HISTORY_LIMIT) return;
        const drop = all
            .sort((a, b) => String(a.ts).localeCompare(String(b.ts)))
            .slice(0, all.length - HISTORY_LIMIT)
            .map(r => r.eventId);
        await tx(HISTORY, 'readwrite', s => drop.forEach(id => s.delete(id)));
    }

    scope.QueueDB = QueueDB;
})(typeof self !== 'undefined' ? self : window);