// BorrowBuddy — Requests Management
const currentUser = localStorage.getItem('username');
let requestToCancel = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!currentUser) { window.location.href = 'login.html'; return; }
    loadRequests();
});

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.closest('.tab-btn').classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(tab + 'Tab').classList.add('active');
}

function loadRequests() {
    // ALL requests stored under requests_${username}
    // type: 'incoming' means someone wants to borrow YOUR item
    // type: 'outgoing' means YOU sent a request to someone
    const all      = JSON.parse(localStorage.getItem(`requests_${currentUser}`) || '[]');
    const incoming = all.filter(r => r.type === 'incoming');
    const outgoing = all.filter(r => r.type === 'outgoing');

    console.log('[Requests] User:', currentUser);
    console.log('[Requests] All:', all);
    console.log('[Requests] Incoming:', incoming);
    console.log('[Requests] Outgoing:', outgoing);

    renderIncoming(incoming);
    renderOutgoing(outgoing);

    const inEl = document.getElementById('incomingCount');
    const outEl = document.getElementById('outgoingCount');
    if (inEl)  inEl.textContent  = incoming.length;
    if (outEl) outEl.textContent = outgoing.length;
}

// ── OUTGOING (requests I sent) ──────────────────────────────────
function renderOutgoing(requests) {
    const container = document.getElementById('outgoingRequests');
    if (!container) return;

    if (requests.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-paper-plane"></i>
                <h3>No Outgoing Requests</h3>
                <p>You haven't requested to borrow any items yet</p>
                <a href="browse.html" style="margin-top:1rem;display:inline-block;padding:.6rem 1.4rem;background:#2563eb;color:white;border-radius:8px;text-decoration:none">Browse Items</a>
            </div>`;
        return;
    }
    container.innerHTML = requests.map(req => createOutgoingCard(req)).join('');
}

function createOutgoingCard(req) {
    const statusMap = {
        pending:         { text: 'Pending',           color: '#f59e0b' },
        approved:        { text: 'Approved — Pay Now',color: '#10b981' },
        payment_pending: { text: 'Payment Pending',   color: '#3b82f6' },
        confirmed:       { text: 'Confirmed ✓',       color: '#10b981' },
        rejected:        { text: 'Rejected',          color: '#ef4444' },
        completed:       { text: 'Completed',         color: '#6b7280' },
        cancelled:       { text: 'Cancelled',         color: '#6b7280' }
    };
    const { text: statusText, color: statusColor } = statusMap[req.status] || { text: req.status, color: '#6b7280' };
    const isPaid = req.paymentStatus === 'paid' || req.status === 'confirmed' || req.status === 'completed';

    return `
        <div class="request-card" style="${req.status === 'approved' && !isPaid ? 'border:2px solid #10b981;' : ''}">
            <div class="request-header">
                <div class="request-info">
                    <div class="request-item-name">${req.itemName}</div>
                    <div class="request-meta">
                        <span class="request-meta-item"><i class="fas fa-user"></i> Owner: ${req.itemOwner}</span>
                        <span class="request-meta-item"><i class="fas fa-clock"></i> ${req.duration} days</span>
                        <span class="request-meta-item"><i class="fas fa-calendar"></i> ${formatDate(req.requestedAt)}</span>
                        ${req.transactionId ? `<span class="request-meta-item" style="color:#10b981"><i class="fas fa-check-circle"></i> Paid · ${req.transactionId.slice(0,16)}…</span>` : ''}
                    </div>
                </div>
                <span class="status-badge" style="background:${statusColor}20;color:${statusColor};padding:.3rem .8rem;border-radius:20px;font-size:.8rem;font-weight:600">${statusText}</span>
            </div>

            ${req.status === 'pending' ? `
            <div class="request-actions">
                <button class="btn-cancel" onclick="cancelRequest('${req.id}', '${req.itemOwner}')">
                    <i class="fas fa-times-circle"></i> Cancel Request
                </button>
            </div>` : ''}

            ${(req.status === 'approved' || req.status === 'payment_pending') && !isPaid ? `
            <div class="request-actions" style="background:#ecfdf5;border-top:1px solid #6ee7b7;padding:14px 16px;">
                <div style="font-size:.8rem;color:#065f46;margin-bottom:8px">
                    <i class="fas fa-check-circle"></i>
                    <strong>Owner approved your request!</strong> Pay the service fee to unlock their contact details.
                </div>
                <button onclick="goToPayment('${req.id}')"
                    style="background:linear-gradient(135deg,#FF9900,#e68a00);color:#fff;border:none;padding:11px 24px;border-radius:8px;font-weight:700;cursor:pointer;font-size:.9rem;display:flex;align-items:center;gap:8px">
                    <i class="fas fa-lock-open"></i> Pay & Unlock Contact Details
                </button>
            </div>` : ''}

            ${isPaid ? `
            <div class="request-actions" style="background:#ecfdf5;border-top:1px solid #6ee7b7;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;">
                <span style="font-size:.82rem;color:#065f46;font-weight:600"><i class="fas fa-check-circle"></i> Payment complete — contact details unlocked</span>
                <button onclick="viewUnlockedContact('${req.id}')"
                    style="background:#10b981;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-size:.8rem;font-weight:600;cursor:pointer">
                    View Contact
                </button>
            </div>` : ''}
        </div>`;
}

// ── INCOMING (requests for MY items) ───────────────────────────
function renderIncoming(requests) {
    const container = document.getElementById('incomingRequests');
    if (!container) return;

    if (requests.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <h3>No Incoming Requests</h3>
                <p>No one has requested to borrow your items yet</p>
            </div>`;
        return;
    }
    container.innerHTML = requests.map(req => createIncomingCard(req)).join('');
}

function createIncomingCard(req) {
    const statusText  = { pending: 'Awaiting Your Response', approved: 'Approved', rejected: 'Rejected', completed: 'Completed' }[req.status] || 'Pending';
    const statusColor = { pending: '#f59e0b', approved: '#10b981', rejected: '#ef4444', completed: '#6b7280' }[req.status] || '#f59e0b';
    return `
        <div class="request-card">
            <div class="request-header">
                <div class="request-info">
                    <div class="request-item-name">${req.itemName}</div>
                    <div class="request-meta">
                        <span class="request-meta-item"><i class="fas fa-user"></i> From: ${req.requestedBy}</span>
                        <span class="request-meta-item"><i class="fas fa-clock"></i> ${req.duration} days</span>
                        <span class="request-meta-item"><i class="fas fa-calendar"></i> ${formatDate(req.requestedAt)}</span>
                    </div>
                </div>
                <span class="status-badge" style="background:${statusColor}20;color:${statusColor};padding:.3rem .8rem;border-radius:20px;font-size:.8rem;font-weight:600">${statusText}</span>
            </div>
            ${req.status === 'pending' ? `
            <div class="request-actions">
                <button class="btn-approve" onclick="approveRequest('${req.id}', '${req.requestedBy}')">
                    <i class="fas fa-check-circle"></i> Approve
                </button>
                <button class="btn-reject" onclick="rejectRequest('${req.id}')">
                    <i class="fas fa-times-circle"></i> Reject
                </button>
            </div>` : ''}
        </div>`;
}

// ── Actions ─────────────────────────────────────────────────────

function cancelRequest(requestId, itemOwner) {
    if (!confirm('Cancel this request?')) return;

    // Remove from my outgoing
    const myAll     = JSON.parse(localStorage.getItem(`requests_${currentUser}`) || '[]');
    const myUpdated = myAll.filter(r => r.id !== requestId);
    localStorage.setItem(`requests_${currentUser}`, JSON.stringify(myUpdated));

    // Remove from owner's incoming
    const ownerAll     = JSON.parse(localStorage.getItem(`requests_${itemOwner}`) || '[]');
    const ownerUpdated = ownerAll.filter(r => r.id !== requestId);
    localStorage.setItem(`requests_${itemOwner}`, JSON.stringify(ownerUpdated));

    loadRequests();
    alert('Request cancelled.');
}

function approveRequest(requestId, requestedBy) {
    // Update in my incoming list
    const myAll     = JSON.parse(localStorage.getItem(`requests_${currentUser}`) || '[]');
    const myUpdated = myAll.map(r => r.id === requestId ? { ...r, status: 'approved' } : r);
    localStorage.setItem(`requests_${currentUser}`, JSON.stringify(myUpdated));

    // Update in requester's outgoing list
    const theirAll     = JSON.parse(localStorage.getItem(`requests_${requestedBy}`) || '[]');
    const theirUpdated = theirAll.map(r => r.id === requestId ? { ...r, status: 'approved' } : r);
    localStorage.setItem(`requests_${requestedBy}`, JSON.stringify(theirUpdated));

    loadRequests();
    alert('✅ Request approved!');
}

function rejectRequest(requestId) {
    if (!confirm('Reject this request?')) return;

    const myAll     = JSON.parse(localStorage.getItem(`requests_${currentUser}`) || '[]');
    const rejected  = myAll.find(r => r.id === requestId);
    const myUpdated = myAll.map(r => r.id === requestId ? { ...r, status: 'rejected' } : r);
    localStorage.setItem(`requests_${currentUser}`, JSON.stringify(myUpdated));

    if (rejected?.requestedBy) {
        const theirAll     = JSON.parse(localStorage.getItem(`requests_${rejected.requestedBy}`) || '[]');
        const theirUpdated = theirAll.map(r => r.id === requestId ? { ...r, status: 'rejected' } : r);
        localStorage.setItem(`requests_${rejected.requestedBy}`, JSON.stringify(theirUpdated));
    }

    loadRequests();
    alert('Request rejected.');
}

function goToPayment(requestId) {
    window.location.href = `secure-payment.html?requestId=${requestId}`;
}

function viewUnlockedContact(requestId) {
    const user    = localStorage.getItem('username');
    const contact = JSON.parse(localStorage.getItem(`unlocked_${user}_${requestId}`) || 'null');
    if (!contact) {
        alert('Contact details not found. Please contact support.');
        return;
    }
    alert(
        `📞 Owner Contact Details\n\n` +
        `Phone:    ${contact.phone}\n` +
        `Address:  ${contact.address}\n` +
        `Instructions: ${contact.instructions}`
    );
}

function formatDate(str) {
    if (!str) return '';
    const d    = new Date(str);
    const diff = Date.now() - d;
    if (diff < 60000)    return 'Just now';
    if (diff < 3600000)  return Math.floor(diff / 60000) + ' min ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return d.toLocaleDateString();
}

// Expose to HTML onclick
window.switchTab          = switchTab;
window.cancelRequest      = cancelRequest;
window.approveRequest     = approveRequest;
window.rejectRequest      = rejectRequest;
window.goToPayment        = goToPayment;
window.viewUnlockedContact = viewUnlockedContact;