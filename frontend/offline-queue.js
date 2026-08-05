/**
 * BorrowBuddy — Offline dispute queue.
 * Stores dispute reports submitted while offline (or when the API is
 * unreachable) and retries them automatically once the connection returns.
 * Photo evidence is uploaded attachment-by-attachment so each one reports
 * its own progress and its own error message.
 */
(function () {
    const STORAGE_KEY = 'bb_dispute_queue';
    const MAX_ATTEMPTS = 8;
    const RETRY_MS = 30000;
    const UPLOAD_URL = self.BORROWBUDDY_CONFIG.API_BASE_URL + '/api/upload/images';
    const SYNC_TAG = 'bb-dispute-sync';

    let flushing = false;
    let timer = null;
    // id -> { index: percent } live progress (not persisted)
    const liveProgress = {};

    // ── Storage ───────────────────────────────────────────────────
    function read() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const list = raw ? JSON.parse(raw) : [];
            return Array.isArray(list) ? list : [];
        } catch (e) {
            return [];
        }
    }

    // ── Background sync mirror ────────────────────────────────────
    // The service worker can't read localStorage, so every change is
    // mirrored into IndexedDB. That lets queued reports keep uploading
    // through Background Sync after the tab is closed.
    function mirror(list) {
        if (!window.QueueDB) return;
        QueueDB.replaceAll(list).catch(() => {});
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        QueueDB.setMeta('token', token || null).catch(() => {});
    }

    async function requestSync() {
        if (!('serviceWorker' in navigator)) return false;
        try {
            const reg = await navigator.serviceWorker.ready;
            if (reg.sync) {
                await reg.sync.register(SYNC_TAG);
                return true;
            }
            if (reg.periodicSync && navigator.permissions) {
                const status = await navigator.permissions.query({ name: 'periodic-background-sync' }).catch(() => null);
                if (status && status.state === 'granted') {
                    await reg.periodicSync.register(SYNC_TAG, { minInterval: 15 * 60 * 1000 }).catch(() => {});
                }
            }
            if (reg.active) reg.active.postMessage('BB_SYNC_NOW');
            return true;
        } catch (e) {
            return false;
        }
    }

    /** Pick up anything the service worker sent or updated while we were away. */
    async function adoptFromDB() {
        if (!window.QueueDB) return;
        try {
            const stored = await QueueDB.all();
            const local = read();
            const same = stored.length === local.length &&
                stored.every((e, i) => local[i] && local[i].id === e.id &&
                    JSON.stringify((e.attachments || []).map(a => a.status)) ===
                    JSON.stringify((local[i].attachments || []).map(a => a.status)));
            if (same) return;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
            emit();
            if (typeof window.loadDisputes === 'function') window.loadDisputes();
        } catch (e) { /* ignore */ }
    }

    function write(list) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
            mirror(list);
            return true;
        } catch (e) {
            // Most likely the quota was hit by photo evidence — drop photos
            // from the oldest entries rather than losing the report itself.
            try {
                const slim = list.map(entry => ({
                    ...entry,
                    payload: { ...entry.payload, evidence: [] },
                    attachments: (entry.attachments || []).map(a => ({ ...a, status: a.status === 'done' ? 'done' : 'dropped' })),
                    evidenceDropped: true
                }));
                localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
                mirror(slim);
                return true;
            } catch (err) {
                console.warn('Offline queue: could not persist queue', err);
                return false;
            }
        }
    }

    function decorate(entry) {
        const live = liveProgress[entry.id] || {};
        return {
            ...entry,
            attachments: (entry.attachments || []).map((a, i) => ({
                ...a,
                progress: live[i] != null ? live[i] : (a.status === 'done' ? 100 : a.progress || 0)
            }))
        };
    }

    function emit() {
        document.dispatchEvent(new CustomEvent('bb:queue-changed', { detail: { pending: pending() } }));
        renderBanner();
    }

    function emitProgress() {
        document.dispatchEvent(new CustomEvent('bb:queue-progress', { detail: { pending: pending() } }));
    }

    // ── Sync history log ──────────────────────────────────────────
    function logEvent(entry, event) {
        if (!window.QueueDB) return;
        QueueDB.log({
            source: 'page',
            entryId: entry && entry.id,
            item: (entry && entry.payload && entry.payload.itemName) || 'Dispute report',
            attempt: entry ? (entry.attempts || 0) + 1 : undefined,
            ...event
        }).then(() => {
            document.dispatchEvent(new CustomEvent('bb:history-changed'));
        }).catch(() => {});
    }

    // ── Error messages ────────────────────────────────────────────
    function describeError(error, context) {
        const raw = (error && error.message) || String(error || '');
        const what = context === 'photo' ? 'photo' : 'report';

        if (!navigator.onLine) {
            return `You're offline — this ${what} is still saved on your device and will send automatically.`;
        }
        if (/Failed to fetch|NetworkError|Load failed|network/i.test(raw)) {
            return `We couldn't reach BorrowBuddy. The connection dropped while sending this ${what}.`;
        }
        if (/timed out|timeout/i.test(raw)) {
            return `Sending this ${what} took too long. We'll try again shortly.`;
        }
        if (/\b401\b|Unauthorized|token/i.test(raw)) {
            return 'Your session expired. Sign in again and press Retry to send this report.';
        }
        if (/\b403\b|Forbidden/i.test(raw)) {
            return 'You don\'t have permission to file this report anymore.';
        }
        if (/\b413\b|too large|File too large|LIMIT_FILE_SIZE/i.test(raw)) {
            return context === 'photo'
                ? 'This photo is too large to upload. Remove it or attach a smaller image.'
                : 'This report is too large to send. Try removing a photo.';
        }
        if (/\b429\b|Too Many/i.test(raw)) {
            return 'Too many attempts right now. We\'ll retry automatically in a moment.';
        }
        if (/\b5\d\d\b|Internal Server/i.test(raw)) {
            return `BorrowBuddy's server had a problem with this ${what}. We'll keep retrying.`;
        }
        if (/\b400\b|required|validation|invalid/i.test(raw)) {
            return `Some details of this ${what} were rejected: ${raw}`;
        }
        return raw || `We couldn't send this ${what}.`;
    }

    // ── Attachment upload ─────────────────────────────────────────
    function dataUrlToBlob(dataUrl) {
        const [meta, b64] = String(dataUrl).split(',');
        const mime = (meta.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
        const bin = atob(b64 || '');
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new Blob([bytes], { type: mime });
    }

    // The upload endpoint returns `images` as an array of plain URL
    // strings (see backend routes/upload.js), but also tolerates
    // `urls` or an array of {url|secure_url} objects — handle all three
    // so a shape change on either side doesn't silently fall back to
    // re-sending the original base64 photo.
    function extractUploadUrl(body) {
        if (body.urls && body.urls[0]) return body.urls[0];
        const img = body.images && body.images[0];
        if (typeof img === 'string') return img;
        if (img && (img.url || img.secure_url)) return img.url || img.secure_url;
        if (typeof body.url === 'string') return body.url;
        return null;
    }

    function uploadOne(entry, index, dataUrl) {
        return new Promise((resolve, reject) => {
            let blob;
            try {
                blob = dataUrlToBlob(dataUrl);
            } catch (e) {
                reject(new Error('This photo could not be read from your device.'));
                return;
            }

            const form = new FormData();
            form.append('images', blob, `evidence-${index + 1}.jpg`);

            const xhr = new XMLHttpRequest();
            xhr.open('POST', UPLOAD_URL);
            const token = localStorage.getItem('authToken') || localStorage.getItem('token');
            if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

            xhr.upload.onprogress = (e) => {
                if (!e.lengthComputable) return;
                liveProgress[entry.id] = liveProgress[entry.id] || {};
                liveProgress[entry.id][index] = Math.round((e.loaded / e.total) * 100);
                emitProgress();
            };
            xhr.onload = () => {
                let body = {};
                try { body = JSON.parse(xhr.responseText || '{}'); } catch (e) { /* ignore */ }
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(extractUploadUrl(body) || dataUrl);
                } else {
                    reject(new Error(body.message || `HTTP ${xhr.status}`));
                }
            };
            xhr.onerror = () => reject(new Error('Failed to fetch'));
            xhr.ontimeout = () => reject(new Error('timed out'));
            xhr.send(form);
        });
    }

    /** Upload every not-yet-uploaded attachment for an entry. */
    async function uploadAttachments(entry) {
        const list = read();
        const target = list.find(e => e.id === entry.id);
        if (!target || !target.attachments || !target.attachments.length) return true;

        let allOk = true;

        for (let i = 0; i < target.attachments.length; i++) {
            const att = target.attachments[i];
            if (att.status === 'done' || att.status === 'dropped') continue;

            att.status = 'uploading';
            att.error = null;
            write(list);
            emitProgress();

            try {
                const url = await uploadOne(target, i, att.dataUrl || (target.payload.evidence || [])[i]);
                const fresh = read();
                const t = fresh.find(e => e.id === entry.id);
                if (t) {
                    t.attachments[i].status = 'done';
                    t.attachments[i].progress = 100;
                    t.attachments[i].url = url;
                    t.attachments[i].error = null;
                    t.attachments[i].dataUrl = null; // free space once uploaded
                    write(fresh);
                    logEvent(t, {
                        kind: 'attachment',
                        level: 'success',
                        attachmentIndex: i,
                        message: `Photo ${i + 1} uploaded`
                    });
                }
                liveProgress[entry.id] = liveProgress[entry.id] || {};
                liveProgress[entry.id][i] = 100;
            } catch (error) {
                allOk = false;
                const offline = !navigator.onLine || /Failed to fetch|NetworkError|Load failed/i.test(error.message || '');
                const fresh = read();
                const t = fresh.find(e => e.id === entry.id);
                if (t) {
                    t.attachments[i].status = 'error';
                    t.attachments[i].attempts = (t.attachments[i].attempts || 0) + 1;
                    t.attachments[i].error = describeError(error, 'photo');
                    write(fresh);
                    logEvent(t, {
                        kind: 'attachment',
                        level: 'error',
                        attachmentIndex: i,
                        message: `Photo ${i + 1} failed: ${t.attachments[i].error}`
                    });
                }
                if (liveProgress[entry.id]) delete liveProgress[entry.id][i];
                emitProgress();
                if (offline) break;
            }
            emitProgress();
        }

        emit();
        return allOk;
    }

    // ── Public API ────────────────────────────────────────────────
    function enqueue(payload) {
        const list = read();
        const evidence = Array.isArray(payload.evidence) ? payload.evidence : [];
        const entry = {
            id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            payload,
            attachments: evidence.map((dataUrl, i) => ({
                name: `Photo ${i + 1}`,
                size: Math.round((String(dataUrl).length * 3) / 4),
                dataUrl,
                status: 'pending',
                progress: 0,
                attempts: 0,
                error: null,
                url: null
            })),
            queuedAt: new Date().toISOString(),
            attempts: 0,
            lastError: null
        };
        list.push(entry);
        write(list);
        emit();
        logEvent(entry, { kind: 'queued', level: 'info', attempt: 0, message: navigator.onLine ? 'Saved to the send queue' : 'Saved on your device while offline' });
        schedule();
        requestSync(); // keeps uploading even if this tab is closed
        return entry;
    }

    function pending() {
        return read().map(decorate);
    }

    function remove(id) {
        const entry = read().find(e => e.id === id);
        if (entry) logEvent(entry, { kind: 'discarded', level: 'warn', message: 'Report discarded before it was sent' });
        write(read().filter(e => e.id !== id));
        delete liveProgress[id];
        emit();
    }

    function clear() {
        write([]);
        for (const k of Object.keys(liveProgress)) delete liveProgress[k];
        emit();
    }

    /** Retry a single attachment that previously failed. */
    async function retryAttachment(entryId, index) {
        const list = read();
        const entry = list.find(e => e.id === entryId);
        if (!entry || !entry.attachments || !entry.attachments[index]) return;
        entry.attachments[index].status = 'pending';
        entry.attachments[index].error = null;
        write(list);
        logEvent(entry, { kind: 'attachment', level: 'info', attachmentIndex: index, message: `Retrying photo ${index + 1}` });
        emit();
        await flush({ silent: false });
    }

    /** Give up on one attachment so the report itself can still be sent. */
    function skipAttachment(entryId, index) {
        const list = read();
        const entry = list.find(e => e.id === entryId);
        if (!entry || !entry.attachments || !entry.attachments[index]) return;
        entry.attachments[index].status = 'dropped';
        entry.attachments[index].dataUrl = null;
        entry.attachments[index].error = null;
        write(list);
        logEvent(entry, { kind: 'attachment', level: 'warn', attachmentIndex: index, message: `Photo ${index + 1} skipped by you` });
        emit();
    }

    /** Try to send everything in the queue. Safe to call at any time. */
    async function flush({ silent = true } = {}) {
        if (flushing) return;
        if (!navigator.onLine) return;
        if (!window.api || typeof api.createDispute !== 'function') return;
        if (!localStorage.getItem('authToken') && !localStorage.getItem('token')) return; // needs auth

        let list = read();
        if (!list.length) return;

        flushing = true;
        let sent = 0;
        renderBanner();

        try {
            for (const entry of list) {
                if (entry.permanent) continue; // needs a person to retry/discard, not another automatic attempt
                logEvent(entry, { kind: 'attempt', level: 'info', message: 'Send attempt started' });
                // 1) Attachments first, each with its own progress + error.
                await uploadAttachments(entry);

                const current = read();
                const target = current.find(e => e.id === entry.id);
                if (!target) continue;

                const stuck = (target.attachments || []).some(a => a.status === 'error');
                if (stuck) {
                    target.lastError = 'Some photos couldn\'t be uploaded. Retry or skip them to send this report.';
                    write(current);
                    logEvent(target, { kind: 'blocked', level: 'warn', message: target.lastError });
                    if (!navigator.onLine) break;
                    continue;
                }

                const evidence = (target.attachments || [])
                    .filter(a => a.status === 'done' && a.url)
                    .map(a => a.url);

                // 2) Then the report itself.
                try {
                    await api.createDispute({ ...target.payload, evidence });
                    sent += 1;
                    delete liveProgress[entry.id];
                    logEvent(target, { kind: 'sent', level: 'success', message: `Report submitted successfully${evidence.length ? ` with ${evidence.length} photo${evidence.length > 1 ? 's' : ''}` : ''}` });
                    write(read().filter(e => e.id !== entry.id));
                } catch (error) {
                    const offline = !navigator.onLine || /Failed to fetch|NetworkError|Load failed/i.test(error.message || '');
                    const fresh = read();
                    const t = fresh.find(e => e.id === entry.id);
                    if (t) {
                        t.attempts += 1;
                        t.lastError = describeError(error, 'report');
                        t.permanent = !offline && t.attempts >= 2;
                        if (t.attempts >= MAX_ATTEMPTS) t.permanent = true;
                        write(fresh);
                        logEvent(t, { kind: 'failed', level: 'error', attempt: t.attempts, message: t.lastError + (t.permanent ? ' (given up — manual retry needed)' : '') });
                    }
                    if (offline) break; // connection went away again — retry later
                }
            }
        } finally {
            flushing = false;
            emit();
        }

        if (sent && silent === false) {
            notify(`${sent} queued report${sent > 1 ? 's' : ''} submitted.`);
        }
        if (sent && typeof window.loadDisputes === 'function') {
            window.loadDisputes();
        }
        return sent;
    }

    function notify(message) {
        const el = document.createElement('div');
        el.className = 'oq-toast';
        el.innerHTML = `<i class="fas fa-cloud-arrow-up"></i> ${message}`;
        document.body.appendChild(el);
        setTimeout(() => el.classList.add('show'), 10);
        setTimeout(() => {
            el.classList.remove('show');
            setTimeout(() => el.remove(), 300);
        }, 4000);
    }

    // ── Status banner ─────────────────────────────────────────────
    function renderBanner() {
        const list = read();
        let bar = document.getElementById('oqBanner');

        if (!list.length && navigator.onLine) {
            if (bar) bar.remove();
            return;
        }

        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'oqBanner';
            bar.className = 'oq-banner';
            document.body.appendChild(bar);
        }

        const failed = list.filter(e => e.permanent).length;
        const photoIssues = list.reduce((n, e) => n + (e.attachments || []).filter(a => a.status === 'error').length, 0);
        const waiting = list.length - failed;

        if (!navigator.onLine) {
            bar.className = 'oq-banner offline';
            bar.innerHTML = `
                <i class="fas fa-wifi"></i>
                <span>You're offline${list.length ? ` — ${list.length} report${list.length > 1 ? 's' : ''} saved on this device` : ''}. We'll send everything automatically when you're back.</span>`;
            return;
        }

        bar.className = 'oq-banner syncing';
        const parts = [];
        if (waiting) parts.push(`${waiting} report${waiting > 1 ? 's' : ''} waiting to send`);
        if (photoIssues) parts.push(`${photoIssues} photo${photoIssues > 1 ? 's' : ''} need attention`);
        if (failed) parts.push(`${failed} couldn't be sent`);
        bar.innerHTML = `
            <i class="fas fa-cloud-arrow-up ${flushing ? 'spin' : ''}"></i>
            <span>${parts.join(' · ')}</span>
            <button type="button" onclick="OfflineQueue.retryNow()">Retry now</button>`;
    }

    async function retryNow() {
        const list = read();
        list.forEach(e => logEvent(e, { kind: 'attempt', level: 'info', message: 'Manual "Retry now" requested' }));
        list.forEach(e => {
            e.permanent = false;
            e.attempts = 0;
            (e.attachments || []).forEach(a => {
                if (a.status === 'error') { a.status = 'pending'; a.error = null; }
            });
        });
        write(list);
        renderBanner();
        const sent = await flush({ silent: false });
        if (!sent) notify('Still no luck — we’ll keep trying in the background.');
    }

    function schedule() {
        if (timer) return;
        timer = setInterval(() => {
            if (read().length && navigator.onLine) flush();
            if (!read().length) { clearInterval(timer); timer = null; }
        }, RETRY_MS);
    }

    // ── Wiring ────────────────────────────────────────────────────
    window.addEventListener('online', () => { renderBanner(); requestSync(); flush({ silent: false }); });
    window.addEventListener('offline', renderBanner);

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
            const data = event.data || {};
            if (data.type === 'bb:queue-updated') {
                adoptFromDB();
            } else if (data.type === 'bb:queue-synced') {
                adoptFromDB().then(() => {
                    if (data.sent) notify(`${data.sent} queued report${data.sent > 1 ? 's' : ''} sent in the background.`);
                });
            }
        });
    }

    document.addEventListener('DOMContentLoaded', async () => {
        await adoptFromDB();
        renderBanner();
        if (read().length) {
            mirror(read());        // make sure the worker has the latest copy + token
            schedule();
            requestSync();
            flush({ silent: false });
        }
    });

    window.OfflineQueue = {
        enqueue, pending, remove, clear, flush, retryNow, renderBanner,
        retryAttachment, skipAttachment, describeError, requestSync, adoptFromDB,
        history: () => (window.QueueDB ? QueueDB.history() : Promise.resolve([])),
        clearHistory: () => (window.QueueDB ? QueueDB.clearHistory() : Promise.resolve())
    };
})();