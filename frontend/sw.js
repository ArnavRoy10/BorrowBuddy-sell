/* BorrowBuddy service worker — app shell cache + offline fallback.
   Scope is limited to /app/. API calls are never cached. */

// Service workers can't read <script> tags from the page, so config.js
// is loaded directly here to get BORROWBUDDY_CONFIG.API_BASE_URL.
importScripts('./config.js');

const VERSION    = 'bb-v10';
const SHELL      = `${VERSION}-shell`;
const RUNTIME    = `${VERSION}-runtime`;
const OFFLINE_URL = 'offline.html';

importScripts('queue-db.js');

const SHELL_ASSETS = [
    'index.html',
    'browse.html',
    'disputes.html',
    'sync-history.html',
    'offline.html',
    'styles.css',
    'dark-mode.css',
    'bottom-nav.css',
    'skeletons.css',
    'empty-states.css',
    'onboarding.css',
    'disputes.css',
    'offline-queue.css',
    'sync-history.css',
    'skeletons.js',
    'empty-states.js',
    'onboarding.js',
    'bottom-nav.js',
    'disputes.js',
    'offline-queue.js',
    'sync-history.js',
    'queue-db.js',
    'utils.js',
    'api-service.js',
    'manifest.json',
    'icons/icon-192.png',
    'icons/icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(SHELL)
            .then(cache => cache.addAll(SHELL_ASSETS.map(a => new Request(a, { cache: 'reload' }))))
            .catch(() => {})
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(
            keys.filter(k => k.startsWith('bb-') && !k.startsWith(VERSION))
                .map(k => caches.delete(k))
        );
        await self.clients.claim();
    })());
});

self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') self.skipWaiting();
    if (event.data === 'BB_SYNC_NOW') event.waitUntil(syncDisputes());
});

/* ── Background sync: send queued disputes even with no tab open ── */
const SYNC_TAG = 'bb-dispute-sync';
const API_BASE = self.BORROWBUDDY_CONFIG.API_BASE_URL + '/api';
const UPLOAD_URL = `${API_BASE}/upload/images`;
const MAX_ATTEMPTS = 8; // matches offline-queue.js — stop retrying forever in the background

self.addEventListener('sync', (event) => {
    if (event.tag === SYNC_TAG) event.waitUntil(syncDisputes());
});

self.addEventListener('periodicsync', (event) => {
    if (event.tag === SYNC_TAG) event.waitUntil(syncDisputes());
});

async function notifyClients(payload) {
    const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    clients.forEach(c => c.postMessage(payload));
}

async function logHistory(entry, event) {
    try {
        await self.QueueDB.log({
            source: 'background',
            entryId: entry && entry.id,
            item: (entry && entry.payload && entry.payload.itemName) || 'Dispute report',
            ...event
        });
        await notifyClients({ type: 'bb:history-changed' });
    } catch (e) { /* best effort */ }
}

function dataUrlToBlob(dataUrl) {
    const [meta, b64] = String(dataUrl).split(',');
    const mime = (meta.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
    const bin = atob(b64 || '');
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
}

function authHeaders(token) {
    return token ? { Authorization: `Bearer ${token}` } : {};
}

// Same reasoning as offline-queue.js's copy: the endpoint returns
// `images` as plain URL strings, so keep both shapes tolerated here too.
function extractUploadUrl(body) {
    if (body.urls && body.urls[0]) return body.urls[0];
    const img = body.images && body.images[0];
    if (typeof img === 'string') return img;
    if (img && (img.url || img.secure_url)) return img.url || img.secure_url;
    if (typeof body.url === 'string') return body.url;
    return null;
}

let syncing = false;

async function syncDisputes() {
    if (syncing) return;
    syncing = true;
    let sent = 0;
    try {
        const token = await self.QueueDB.getMeta('token');
        if (!token) return;

        const entries = await self.QueueDB.all();
        for (const entry of entries) {
            if (entry.permanent) continue; // needs a person to retry/discard, not another automatic attempt
            await logHistory(entry, { kind: 'attempt', level: 'info', attempt: (entry.attempts || 0) + 1, message: 'Background sync attempt started' });
            // 1) attachments, one at a time
            const attachments = entry.attachments || [];
            let blocked = false;

            for (let i = 0; i < attachments.length; i++) {
                const att = attachments[i];
                if (att.status === 'done' || att.status === 'dropped') continue;
                try {
                    const form = new FormData();
                    form.append('images', dataUrlToBlob(att.dataUrl), `evidence-${i + 1}.jpg`);
                    const res = await fetch(UPLOAD_URL, { method: 'POST', headers: authHeaders(token), body: form });
                    const body = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(body.message || `HTTP ${res.status}`);
                    att.status = 'done';
                    att.progress = 100;
                    att.url = extractUploadUrl(body) || att.dataUrl;
                    att.dataUrl = null;
                    att.error = null;
                    await logHistory(entry, { kind: 'attachment', level: 'success', attachmentIndex: i, message: `Photo ${i + 1} uploaded in the background` });
                } catch (err) {
                    blocked = true;
                    att.status = 'error';
                    att.attempts = (att.attempts || 0) + 1;
                    att.error = `Background upload failed: ${err.message}. We'll try again.`;
                    await logHistory(entry, { kind: 'attachment', level: 'error', attachmentIndex: i, message: att.error });
                }
                await self.QueueDB.put(entry);
                await notifyClients({ type: 'bb:queue-updated' });
            }

            if (blocked) {
                entry.lastError = 'Some photos couldn\'t be uploaded in the background. Open BorrowBuddy to retry or skip them.';
                await self.QueueDB.put(entry);
                await logHistory(entry, { kind: 'blocked', level: 'warn', message: entry.lastError });
                continue;
            }

            // 2) the report itself
            const evidence = attachments.filter(a => a.status === 'done' && a.url).map(a => a.url);
            try {
                const res = await fetch(`${API_BASE}/disputes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
                    body: JSON.stringify({ ...entry.payload, evidence })
                });
                const body = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(body.message || `HTTP ${res.status}`);
                await self.QueueDB.remove(entry.id);
                sent += 1;
                await logHistory(entry, { kind: 'sent', level: 'success', message: 'Report submitted in the background' });
            } catch (err) {
                entry.attempts = (entry.attempts || 0) + 1;
                entry.lastError = `Background send failed: ${err.message}`;
                // A 401/403 might just mean this worker's mirrored token is
                // stale (e.g. re-logged-in on another tab) — leave it for
                // the foreground to resolve definitively. A clear 4xx
                // (bad data) or too many attempts means retrying forever
                // in the background won't help; surface it instead.
                const authIssue = /\b40[13]\b/.test(err.message || '');
                const clientRejected = /\b4\d\d\b/.test(err.message || '') && !authIssue;
                if (clientRejected || entry.attempts >= MAX_ATTEMPTS) entry.permanent = true;
                await self.QueueDB.put(entry);
                await logHistory(entry, { kind: 'failed', level: 'error', attempt: entry.attempts, message: entry.lastError });
                if (!self.navigator.onLine) break;
            }
            await notifyClients({ type: 'bb:queue-updated' });
        }
    } finally {
        syncing = false;
        await notifyClients({ type: 'bb:queue-synced', sent });
    }

    if (sent && self.registration.showNotification && Notification.permission === 'granted') {
        self.registration.showNotification('BorrowBuddy', {
            body: `${sent} queued report${sent > 1 ? 's were' : ' was'} sent in the background.`,
            icon: 'icons/icon-192.png',
            tag: 'bb-queue-sync'
        });
    }

    // Ask the browser to retry later only if something retryable is left —
    // a permanently-failed entry shouldn't keep this sync rescheduling forever.
    const left = await self.QueueDB.all();
    const retryable = left.filter(e => !e.permanent);
    if (retryable.length) throw new Error('Queue not empty — retry later');
}

function isApiRequest(url) {
    return url.pathname.includes('/api/') || url.port === '5000';
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (isApiRequest(url)) return; // always hit the network for data

    // HTML navigations: network first, offline page as fallback
    if (request.mode === 'navigate') {
        event.respondWith((async () => {
            try {
                const fresh = await fetch(request);
                const cache = await caches.open(RUNTIME);
                cache.put(request, fresh.clone());
                return fresh;
            } catch {
                return (await caches.match(request)) ||
                       (await caches.match(OFFLINE_URL)) ||
                       new Response('Offline', { status: 503 });
            }
        })());
        return;
    }

    // Static same-origin assets: cache first, refresh in background
    if (url.origin === self.location.origin) {
        event.respondWith((async () => {
            const cached = await caches.match(request);
            const network = fetch(request).then(res => {
                if (res && res.status === 200) {
                    // Clone synchronously, right away — if we wait until the
                    // caches.open() promise resolves, the browser may already
                    // be streaming/consuming res's body by then, and calling
                    // .clone() on an already-read body throws.
                    const resToCache = res.clone();
                    caches.open(RUNTIME)
                        .then((c) => c.put(request, resToCache))
                        .catch(() => {});
                }
                return res;
            }).catch(() => cached);
            return cached || network;
        })());
    }
});
