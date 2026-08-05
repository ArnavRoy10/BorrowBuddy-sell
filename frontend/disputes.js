/**
 * BorrowBuddy — Dispute centre
 * Report damaged / lost items and request refunds.
 */

const DISPUTE_TYPES = [
    { value: 'damaged',          label: 'Item came back damaged' },
    { value: 'lost',             label: 'Item was lost' },
    { value: 'not_returned',     label: 'Item was never returned' },
    { value: 'late_return',      label: 'Returned late' },
    { value: 'not_as_described', label: 'Item was not as described' },
    { value: 'refund',           label: 'Refund request (payment / deposit)' },
    { value: 'other',            label: 'Something else' }
];

const TYPE_LABEL = Object.fromEntries(DISPUTE_TYPES.map(t => [t.value, t.label]));
const STATUS_LABEL = {
    open: 'Open',
    under_review: 'Under review',
    resolved: 'Resolved',
    rejected: 'Rejected',
    withdrawn: 'Withdrawn'
};

let allDisputes = [];
let activeFilter = 'all';
let pendingEvidence = [];

const $ = (sel) => document.querySelector(sel);
const backdrop = () => $('#disputeModalBackdrop');

function escapeHtml(str = '') {
    return String(str).replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

function formatDate(value) {
    if (!value) return '';
    return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function requireLogin() {
    if (localStorage.getItem('authToken') || localStorage.getItem('token')) return true;
    window.location.href = `login.html?redirect=${encodeURIComponent('disputes.html')}`;
    return false;
}

// ── Loading ───────────────────────────────────────────────────────
async function loadDisputes() {
    Skeleton.show('#disputeList', 'list', 4);
    try {
        const res = await api.getMyDisputes();
        allDisputes = res.disputes || [];
        renderDisputes();
    } catch (error) {
        console.error(error);
        EmptyState.render('#disputeList', 'error', {
            text: error.message || 'We couldn’t load your disputes. Check your connection and try again.'
        });
    }
}

function renderDisputes() {
    const list = $('#disputeList');
    const queued = (window.OfflineQueue ? OfflineQueue.pending() : []);
    const items = activeFilter === 'all'
        ? allDisputes
        : allDisputes.filter(d => d.status === activeFilter);

    const showQueued = activeFilter === 'all' || activeFilter === 'open';
    const queuedMarkup = showQueued ? queued.map(renderQueuedCard).join('') : '';

    if (!items.length && !queuedMarkup) {
        if (activeFilter === 'all') {
            EmptyState.render(list, 'noDisputes');
        } else {
            EmptyState.render(list, 'noDisputes', {
                art: 'inbox',
                title: `No ${STATUS_LABEL[activeFilter].toLowerCase()} disputes`,
                text: 'Nothing in this category right now. Switch tabs to see your other reports.',
                action: { label: 'Show all disputes', onclick: "setDisputeFilter('all')", icon: 'fa-list' }
            });
        }
        return;
    }

    list.innerHTML = queuedMarkup + items.map(d => `
        <article class="dispute-card" data-status="${d.status}" onclick="openDisputeDetail('${d._id}')">
            <img class="dispute-thumb" src="${escapeHtml(d.itemImage || 'https://placehold.co/128x128?text=Item')}" alt="${escapeHtml(d.itemName)}">
            <div class="dispute-body">
                <h3>${escapeHtml(d.itemName)}</h3>
                <div class="dispute-meta">
                    Reported ${formatDate(d.createdAt)}${d.against ? ` · against ${escapeHtml(d.against)}` : ''}
                </div>
                <p class="dispute-desc">${escapeHtml((d.description || '').slice(0, 160))}${(d.description || '').length > 160 ? '…' : ''}</p>
                <div class="dispute-badges">
                    <span class="d-badge ${d.status}">${STATUS_LABEL[d.status] || d.status}</span>
                    <span class="d-badge type">${escapeHtml(TYPE_LABEL[d.type] || d.type)}</span>
                    ${d.refundRequested ? `<span class="d-badge refund">Refund ₹${d.amountRequested || 0}</span>` : ''}
                    ${d.messages?.length ? `<span class="d-badge type"><i class="fas fa-comment"></i> ${d.messages.length}</span>` : ''}
                </div>
            </div>
        </article>
    `).join('');
}

function renderQueuedCard(entry) {
    const p = entry.payload || {};
    const failed = entry.permanent;
    const attachments = entry.attachments || [];
    const hasStuckPhoto = attachments.some(a => a.status === 'error');

    const statusBadge = failed
        ? `<span class="d-badge failed"><i class="fas fa-triangle-exclamation"></i> Couldn’t send</span>`
        : `<span class="d-badge queued"><i class="fas fa-clock"></i> Waiting to send</span>`;

    const attachmentMarkup = attachments.length ? `
        <div class="queued-evidence">
            ${attachments.map((a, i) => {
                const src = a.url || a.dataUrl || '';
                const pct = Math.max(0, Math.min(100, a.progress || 0));
                return `
                <div class="queued-evidence-item" data-status="${a.status}" title="${escapeHtml(a.name || `Photo ${i + 1}`)}">
                    ${src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(a.name || `Photo ${i + 1}`)}">` : '<div class="qe-placeholder"></div>'}
                    <span class="qe-check"><i class="fas fa-check"></i></span>
                    <span class="qe-spinner"></span>
                    <span class="qe-progress" style="width:${pct}%"></span>
                    <div class="qe-error-actions">
                        <button type="button" title="Retry this photo" onclick="event.stopPropagation(); OfflineQueue.retryAttachment('${entry.id}', ${i})"><i class="fas fa-rotate-right"></i></button>
                        <button type="button" title="Skip this photo" onclick="event.stopPropagation(); OfflineQueue.skipAttachment('${entry.id}', ${i})"><i class="fas fa-xmark"></i></button>
                    </div>
                </div>`;
            }).join('')}
        </div>
        ${hasStuckPhoto ? '<div class="hint error">Some photos couldn’t upload — retry or skip them so the report can still send.</div>' : ''}` : '';

    const errorLine = (entry.lastError && !hasStuckPhoto) ? `
        <div class="hint ${failed ? 'error' : ''}">
            ${failed ? 'Couldn’t send' : `Attempt ${entry.attempts || 1} didn’t go through`}: ${escapeHtml(entry.lastError)}
        </div>` : '';

    return `
        <article class="dispute-card queued" data-status="queued" data-queue-id="${entry.id}">
            <img class="dispute-thumb" src="${escapeHtml(p.itemImage || 'https://placehold.co/128x128?text=Item')}" alt="${escapeHtml(p.itemName || 'Item')}">
            <div class="dispute-body">
                <h3>${escapeHtml(p.itemName || 'Untitled report')}</h3>
                <div class="dispute-meta">Saved on this device ${formatDate(entry.queuedAt)}${p.against ? ` · against ${escapeHtml(p.against)}` : ''}</div>
                <p class="dispute-desc">${escapeHtml((p.description || '').slice(0, 160))}</p>
                <div class="dispute-badges">
                    ${statusBadge}
                    <span class="d-badge type">${escapeHtml(TYPE_LABEL[p.type] || p.type || '')}</span>
                    ${p.refundRequested ? `<span class="d-badge refund">Refund ₹${p.amountRequested || 0}</span>` : ''}
                    ${entry.evidenceDropped ? '<span class="d-badge type">Photos not saved</span>' : ''}
                </div>
                ${attachmentMarkup}
                ${errorLine}
                <div class="queued-actions">
                    <button type="button" onclick="event.stopPropagation(); OfflineQueue.retryNow()"><i class="fas fa-rotate-right"></i> Retry now</button>
                    <button type="button" onclick="event.stopPropagation(); discardQueuedDispute('${entry.id}')"><i class="fas fa-trash"></i> Discard</button>
                </div>
            </div>
        </article>`;
}

// Live per-attachment progress while a queued dispute is actively uploading.
// offline-queue.js emits the whole decorated pending list on every tick, so
// we find each card by id and patch its DOM directly rather than
// re-rendering the whole list — keeps progress bars animating smoothly.
document.addEventListener('bb:queue-progress', (e) => {
    const list = (e.detail && e.detail.pending) || [];
    list.forEach(entry => {
        const card = document.querySelector(`[data-queue-id="${entry.id}"]`);
        if (!card) return;
        const items = card.querySelectorAll('.queued-evidence-item');
        (entry.attachments || []).forEach((a, i) => {
            const item = items[i];
            if (!item) return;
            item.dataset.status = a.status;
            const bar = item.querySelector('.qe-progress');
            if (bar) bar.style.width = `${Math.max(0, Math.min(100, a.progress || 0))}%`;
        });
    });
});

function discardQueuedDispute(id) {
    if (!confirm('Discard this saved report? It hasn’t been sent yet.')) return;
    OfflineQueue.remove(id);
    renderDisputes();
}

function setDisputeFilter(status) {
    activeFilter = status;
    document.querySelectorAll('.dispute-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.status === status);
    });
    renderDisputes();
}

// ── Report modal ──────────────────────────────────────────────────
function closeDisputeModal() {
    backdrop().classList.remove('open');
    pendingEvidence = [];
}

/**
 * Opens the report form. Optional prefill:
 *   openDisputeModal({ itemName, itemId, itemImage, against, requestId })
 */
function openDisputeModal(prefill = {}) {
    if (!requireLogin()) return;
    pendingEvidence = [];

    $('#disputeModal').innerHTML = `
        <h2>Report an issue</h2>
        <p class="sub">Tell us what went wrong. The other member and our team can see this report.</p>

        <form id="disputeForm">
            <div class="d-field">
                <label for="dItemName">Item</label>
                <input type="text" id="dItemName" required placeholder="e.g. Bosch cordless drill"
                       value="${escapeHtml(prefill.itemName || '')}">
            </div>

            <div class="d-field">
                <label for="dAgainst">Other member (optional)</label>
                <input type="text" id="dAgainst" placeholder="Username of the lender or borrower"
                       value="${escapeHtml(prefill.against || '')}">
            </div>

            <div class="d-field">
                <label for="dType">What happened?</label>
                <select id="dType" required>
                    ${DISPUTE_TYPES.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
                </select>
            </div>

            <div class="d-field">
                <label for="dDescription">Describe the issue</label>
                <textarea id="dDescription" required placeholder="Include when you noticed it, the condition of the item, and anything you've already agreed with the other member."></textarea>
                <div class="hint">The more detail you give, the faster we can resolve it.</div>
            </div>

            <div class="d-field">
                <label class="d-checkbox">
                    <input type="checkbox" id="dRefund"> I'm requesting a refund
                </label>
            </div>

            <div class="d-field" id="dAmountField" style="display:none;">
                <label for="dAmount">Refund amount (₹)</label>
                <input type="number" id="dAmount" min="0" step="1" placeholder="0">
                <div class="hint">Enter the rental fee, deposit or repair cost you'd like back.</div>
            </div>

            <div class="d-field">
                <label for="dEvidence">Photo evidence (up to 5)</label>
                <input type="file" id="dEvidence" accept="image/*" multiple>
                <div class="d-evidence" id="dEvidencePreview"></div>
            </div>

            <div class="d-modal-actions">
                <button type="button" class="d-btn ghost" onclick="closeDisputeModal()">Cancel</button>
                <button type="submit" class="d-btn primary" id="dSubmit">Submit report</button>
            </div>
        </form>`;

    backdrop().classList.add('open');

    $('#dRefund').addEventListener('change', (e) => {
        $('#dAmountField').style.display = e.target.checked ? 'block' : 'none';
    });

    $('#dEvidence').addEventListener('change', async (e) => {
        const files = Array.from(e.target.files).slice(0, 5);
        pendingEvidence = await Promise.all(files.map(readAsDataURL));
        $('#dEvidencePreview').innerHTML = pendingEvidence
            .map(src => `<img src="${src}" alt="Evidence photo">`).join('');
    });

    $('#disputeForm').addEventListener('submit', (e) => submitDispute(e, prefill));
}

function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function submitDispute(event, prefill) {
    event.preventDefault();
    const btn = $('#dSubmit');
    btn.disabled = true;
    btn.textContent = 'Submitting…';

    const payload = {
        requestId:       prefill.requestId,
        itemId:          prefill.itemId,
        itemImage:       prefill.itemImage,
        itemName:        $('#dItemName').value.trim(),
        against:         $('#dAgainst').value.trim(),
        type:            $('#dType').value,
        description:     $('#dDescription').value.trim(),
        refundRequested: $('#dRefund').checked,
        amountRequested: Number($('#dAmount')?.value || 0),
        evidence:        pendingEvidence
    };

    // Offline: save locally and let the queue retry automatically.
    if (!navigator.onLine) {
        queueDispute(payload);
        return;
    }

    try {
        await api.createDispute(payload);

        closeDisputeModal();
        if (window.showToast) showToast('Report submitted — we’ll review it shortly.', 'success');
        if (location.pathname.endsWith('disputes.html')) {
            await loadDisputes();
        } else {
            window.location.href = 'disputes.html';
        }
    } catch (error) {
        const networkIssue = !navigator.onLine ||
            /Failed to fetch|NetworkError|Load failed|network/i.test(error.message || '');
        if (networkIssue && window.OfflineQueue) {
            queueDispute(payload);
            return;
        }
        alert(error.message || 'Could not submit the report. Please try again.');
        btn.disabled = false;
        btn.textContent = 'Submit report';
    }
}

function queueDispute(payload) {
    OfflineQueue.enqueue(payload);
    closeDisputeModal();
    alert('You’re offline, so we saved this report on your device. It will be sent automatically as soon as you’re back online.');
    if (location.pathname.endsWith('disputes.html')) {
        renderDisputes();
    } else {
        window.location.href = 'disputes.html';
    }
}

// ── Detail view ───────────────────────────────────────────────────
async function openDisputeDetail(id) {
    backdrop().classList.add('open');
    $('#disputeModal').innerHTML = Skeleton.markup('text', 5);

    try {
        const { dispute: d } = await api.getDispute(id);
        const me = localStorage.getItem('username');
        const closed = ['resolved', 'rejected', 'withdrawn'].includes(d.status);

        $('#disputeModal').innerHTML = `
            <h2>${escapeHtml(d.itemName)}</h2>
            <p class="sub">
                ${escapeHtml(TYPE_LABEL[d.type] || d.type)} · reported ${formatDate(d.createdAt)}
                ${d.against ? ` · against ${escapeHtml(d.against)}` : ''}
            </p>

            <div class="dispute-badges">
                <span class="d-badge ${d.status}">${STATUS_LABEL[d.status] || d.status}</span>
                ${d.refundRequested ? `<span class="d-badge refund">Refund requested ₹${d.amountRequested || 0}</span>` : ''}
            </div>

            <div class="d-field" style="margin-top:1.1rem;">
                <label>Description</label>
                <p class="dispute-desc">${escapeHtml(d.description)}</p>
            </div>

            ${d.evidence?.length ? `
                <div class="d-field">
                    <label>Evidence</label>
                    <div class="d-evidence">${d.evidence.map(src => `<img src="${escapeHtml(src)}" alt="Evidence photo">`).join('')}</div>
                </div>` : ''}

            ${d.resolution?.resolvedAt ? `
                <div class="d-resolution ${d.status === 'rejected' ? 'rejected' : ''}">
                    <strong>Resolution:</strong> ${escapeHtml(d.resolution.outcome || '')}
                    ${d.resolution.refundAmount ? ` — ₹${d.resolution.refundAmount} refunded` : ''}
                    ${d.resolution.note ? `<br>${escapeHtml(d.resolution.note)}` : ''}
                </div>` : ''}

            <div class="d-field" style="margin-top:1.2rem;">
                <label>Conversation</label>
                <div class="d-thread" id="dThread">
                    ${d.messages?.length
                        ? d.messages.map(m => `
                            <div class="d-msg ${m.isStaff ? 'staff' : (m.sender === me ? 'mine' : '')}">
                                <span class="who">${escapeHtml(m.sender)}${m.isStaff ? ' · Support' : ''}</span>
                                ${escapeHtml(m.text)}
                            </div>`).join('')
                        : '<p class="dispute-desc">No replies yet.</p>'}
                </div>
            </div>

            ${closed ? '' : `
                <div class="d-field" style="margin-top:1rem;">
                    <textarea id="dReply" placeholder="Add a reply…"></textarea>
                </div>`}

            <div class="d-modal-actions">
                <button type="button" class="d-btn ghost" onclick="closeDisputeModal()">Close</button>
                ${closed ? '' : `
                    ${d.raisedBy === me ? `<button type="button" class="d-btn danger" onclick="withdrawDispute('${d._id}')">Withdraw</button>` : ''}
                    <button type="button" class="d-btn primary" onclick="sendDisputeReply('${d._id}')">Send reply</button>`}
            </div>`;
    } catch (error) {
        $('#disputeModal').innerHTML = EmptyState.markup('error', {
            text: error.message || 'Could not load this dispute.',
            action: { label: 'Close', onclick: 'closeDisputeModal()', icon: 'fa-xmark' }
        });
    }
}

async function sendDisputeReply(id) {
    const text = $('#dReply')?.value.trim();
    if (!text) return;
    try {
        await api.addDisputeMessage(id, text);
        await openDisputeDetail(id);
        await loadDisputes();
    } catch (error) {
        alert(error.message || 'Could not send your reply.');
    }
}

async function withdrawDispute(id) {
    if (!confirm('Withdraw this dispute? You can always report the issue again later.')) return;
    try {
        await api.withdrawDispute(id);
        closeDisputeModal();
        await loadDisputes();
    } catch (error) {
        alert(error.message || 'Could not withdraw the dispute.');
    }
}

// ── Init ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('disputeList')) return; // shared script on other pages
    if (!requireLogin()) return;

    document.querySelectorAll('.dispute-tab').forEach(tab => {
        tab.addEventListener('click', () => setDisputeFilter(tab.dataset.status));
    });

    backdrop().addEventListener('click', (e) => {
        if (e.target === backdrop()) closeDisputeModal();
    });

    // Deep link: disputes.html?report=1&item=Drill&against=alex
    const params = new URLSearchParams(location.search);
    loadDisputes().then(() => {
        if (params.get('report')) {
            openDisputeModal({
                itemName:  params.get('item') || '',
                itemId:    params.get('itemId') || '',
                against:   params.get('against') || '',
                requestId: params.get('requestId') || ''
            });
        }
    });
});

window.openDisputeModal = openDisputeModal;
window.closeDisputeModal = closeDisputeModal;
window.openDisputeDetail = openDisputeDetail;
window.setDisputeFilter = setDisputeFilter;
window.withdrawDispute = withdrawDispute;
window.sendDisputeReply = sendDisputeReply;
window.discardQueuedDispute = discardQueuedDispute;
window.loadDisputes = loadDisputes;

// Keep the list in sync when the queue drains in the background.
document.addEventListener('bb:queue-changed', () => {
    if (document.getElementById('disputeList') && allDisputes) renderDisputes();
});