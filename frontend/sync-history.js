/**
 * BorrowBuddy — Sync history.
 * Reads the append-only event log written by offline-queue.js (page) and
 * sw.js (background sync) and groups it per queued dispute so you can see
 * every attempt, every failure and the final outcome over time.
 */
(function () {
    let filter = 'all';
    let events = [];

    const ICONS = {
        queued:     'fa-inbox',
        attempt:    'fa-rotate',
        attachment: 'fa-image',
        blocked:    'fa-triangle-exclamation',
        sent:       'fa-check',
        failed:     'fa-xmark',
        discarded:  'fa-trash'
    };

    function when(iso) {
        const d = new Date(iso);
        if (isNaN(d)) return '';
        const diff = (Date.now() - d.getTime()) / 1000;
        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
        return d.toLocaleString();
    }

    function groupEvents(list) {
        const map = new Map();
        list.forEach(ev => {
            const key = ev.entryId || 'unknown';
            if (!map.has(key)) map.set(key, { id: key, item: ev.item || 'Dispute report', events: [] });
            const g = map.get(key);
            g.events.push(ev);
            if (ev.item) g.item = ev.item;
        });
        const groups = [...map.values()];
        groups.forEach(g => {
            g.events.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
            g.last = g.events[0];
            g.first = g.events[g.events.length - 1];
            g.attempts = g.events.filter(e => e.kind === 'attempt').length;
            g.failures = g.events.filter(e => e.level === 'error').length;
            if (g.events.some(e => e.kind === 'sent')) g.status = 'sent';
            else if (g.events.some(e => e.kind === 'discarded')) g.status = 'discarded';
            else if (g.last && g.last.level === 'error') g.status = 'failed';
            else g.status = 'pending';
        });
        return groups.sort((a, b) => String(b.last.ts).localeCompare(String(a.last.ts)));
    }

    function statusLabel(s) {
        return { sent: 'Sent', failed: 'Failed', pending: 'Waiting', discarded: 'Discarded' }[s] || s;
    }

    function renderStats(groups) {
        const el = document.getElementById('shStats');
        if (!el) return;
        const count = s => groups.filter(g => g.status === s).length;
        el.innerHTML = `
            <div class="sh-stat"><b>${groups.length}</b><span>Reports tracked</span></div>
            <div class="sh-stat ok"><b>${count('sent')}</b><span>Successfully sent</span></div>
            <div class="sh-stat wait"><b>${count('pending')}</b><span>Still waiting</span></div>
            <div class="sh-stat err"><b>${count('failed')}</b><span>Failed attempts</span></div>`;
    }

    function renderGroups(groups) {
        const list = document.getElementById('shList');
        if (!list) return;
        const visible = filter === 'all' ? groups : groups.filter(g => g.status === filter);

        if (!visible.length) {
            list.innerHTML = window.EmptyState
                ? EmptyState.markup('noResults', {
                      art: 'shield',
                      title: filter === 'all' ? 'No sync activity yet' : 'Nothing with that status',
                      text: 'Once you file a dispute report — especially while offline — every send attempt, photo upload and failure appears here.',
                      action: { label: 'Go to disputes', href: 'disputes.html', icon: 'fa-shield-halved' }
                  })
                : '<p style="text-align:center;color:#64748b;padding:40px 0">No sync activity yet.</p>';
            return;
        }

        list.innerHTML = visible.map((g, i) => `
            <section class="sh-group ${i === 0 ? '' : 'collapsed'}" id="g_${g.id}">
                <div class="sh-group-head" onclick="toggleGroup('${g.id}')">
                    <div class="sh-title">
                        <h3>${g.item}</h3>
                        <small>${g.attempts} attempt${g.attempts === 1 ? '' : 's'} · ${g.failures} failure${g.failures === 1 ? '' : 's'} · last activity ${when(g.last.ts)}</small>
                    </div>
                    <span class="sh-badge ${g.status}">${statusLabel(g.status)}</span>
                    <button type="button" class="sh-btn danger small" title="Clear history for just this report" onclick="event.stopPropagation(); clearReportHistory('${g.id}')"><i class="fas fa-trash"></i></button>
                    <i class="fas fa-chevron-down"></i>
                </div>
                <div class="sh-timeline">
                    ${g.events.map(ev => `
                        <div class="sh-event ${ev.level || 'info'}">
                            <span class="sh-dot"><i class="fas ${ICONS[ev.kind] || 'fa-circle-info'}"></i></span>
                            <span class="sh-msg">
                                ${ev.message || ev.kind}
                                <span class="sh-meta">
                                    ${new Date(ev.ts).toLocaleString()} · ${when(ev.ts)}
                                    ${ev.attempt ? ` · attempt ${ev.attempt}` : ''}
                                    <span class="sh-src">${ev.source === 'background' ? 'background sync' : 'in app'}</span>
                                </span>
                            </span>
                        </div>`).join('')}
                </div>
            </section>`).join('');
    }

    async function load() {
        const list = document.getElementById('shList');
        if (list && window.Skeleton) list.innerHTML = Skeleton.markup('list', 3);
        events = window.QueueDB ? await QueueDB.history().catch(() => []) : [];
        const groups = groupEvents(events);
        renderStats(groups);
        renderGroups(groups);
    }

    window.toggleGroup = function (id) {
        const el = document.getElementById(`g_${id}`);
        if (el) el.classList.toggle('collapsed');
    };

    window.setHistoryFilter = function (value, btn) {
        filter = value;
        document.querySelectorAll('.sh-filter').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        renderGroups(groupEvents(events));
    };

    window.clearSyncHistory = async function () {
        if (!confirm('Clear the sync history? Queued reports themselves are not affected.')) return;
        if (window.QueueDB) await QueueDB.clearHistory().catch(() => {});
        load();
    };

    window.clearReportHistory = async function (id) {
        const match = events.find(ev => ev.entryId === id);
        const item = (match && match.item) || 'this report';
        if (!confirm(`Clear the sync history for “${item}”? This only removes its attempt history — the report itself, if still queued, is not affected.`)) return;
        if (window.QueueDB) await QueueDB.clearHistoryFor(id).catch(() => {});
        load();
    };

    window.exportSyncHistory = function () {
        const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `borrowbuddy-sync-history-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };

    window.reloadSyncHistory = load;

    document.addEventListener('DOMContentLoaded', load);
    document.addEventListener('bb:history-changed', load);
    document.addEventListener('bb:queue-changed', load);
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (e) => {
            const t = (e.data || {}).type;
            if (t === 'bb:history-changed' || t === 'bb:queue-synced' || t === 'bb:queue-updated') load();
        });
    }
})();