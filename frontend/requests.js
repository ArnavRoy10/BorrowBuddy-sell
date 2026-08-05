// BorrowBuddy — Requests Page
const REQUESTS_API = self.BORROWBUDDY_CONFIG.API_BASE_URL;

class RequestsManager {
    constructor() {
        this.username = localStorage.getItem('username');
        this.token    = localStorage.getItem('authToken') || localStorage.getItem('token');
        if (!this.username) { window.location.href = 'login.html'; return; }
        this.init();
    }

    init() {
        this.loadAndRender();
        this.setupEventListeners();
    }

    async loadAndRender() {
        this.showLoading('incomingRequestsList');
        this.showLoading('outgoingRequestsList');

        let incoming = [], outgoing = [];

        // ── Backend fetch ────────────────────────────────────────────
        if (this.token) {
            try {
                const [inRes, outRes] = await Promise.all([
                    fetch(`${REQUESTS_API}/api/requests/incoming`, { headers: { 'Authorization': `Bearer ${this.token}` } }),
                    fetch(`${REQUESTS_API}/api/requests/outgoing`, { headers: { 'Authorization': `Bearer ${this.token}` } })
                ]);
                const inData  = await inRes.json();
                const outData = await outRes.json();
                if (inData.success)  incoming = inData.requests  || [];
                if (outData.success) outgoing = outData.requests || [];
            } catch (err) {
                console.warn('Backend fetch failed, using localStorage:', err.message);
            }
        }

        // ── Merge localStorage outgoing requests ─────────────────────
        // Filter backend outgoing to only active statuses too
        outgoing = outgoing.filter(r => ['pending', 'approved'].includes(r.status));

        const lsAll = JSON.parse(localStorage.getItem(`requests_${this.username}`) || '[]');
        const activeStatuses = ['pending', 'approved'];

        // Normalize fromDate to YYYY-MM-DD for comparison (backend returns ISO datetime)
        const normDate = d => d ? String(d).split('T')[0] : '';

        // Deduplicate by both ID and by itemId+fromDate combo (backend vs localStorage)
        const backendOutIds    = new Set(outgoing.map(r => r._id || r.id));
        const backendOutCombos = new Set(outgoing.map(r => `${r.itemId}_${normDate(r.fromDate)}`));

        const lsOutgoing = lsAll.filter(r =>
            activeStatuses.includes(r.status) &&
            !backendOutIds.has(r.id) &&
            !backendOutIds.has(r._id) &&
            !backendOutCombos.has(`${r.itemId}_${normDate(r.fromDate)}`) &&
            r.itemOwner !== this.username
        );
        outgoing = [...outgoing, ...lsOutgoing];

        // ── Merge localStorage incoming requests (for my items) ───────
        const myItems      = JSON.parse(localStorage.getItem(`items_${this.username}`) || '[]');
        const myItemIds    = new Set(myItems.map(i => i.id || i._id));
        const backendInIds    = new Set(incoming.map(r => r._id || r.id));
        const backendInCombos = new Set(incoming.map(r => `${r.itemId}_${normDate(r.fromDate)}`));

        // Global cancelled IDs — written by sender on cancel
        const cancelledIds = new Set(JSON.parse(localStorage.getItem('cancelled_request_ids') || '[]'));

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('requests_') && key !== `requests_${this.username}`) {
                try {
                    const reqs = JSON.parse(localStorage.getItem(key) || '[]');
                    reqs.forEach(r => {
                        const rid   = r.id || r._id;
                        const combo = `${r.itemId}_${normDate(r.fromDate)}`;
                        if (
                            activeStatuses.includes(r.status) &&
                            !cancelledIds.has(rid) &&
                            (myItemIds.has(r.itemId) || r.itemOwner === this.username) &&
                            r.requestedBy !== this.username &&
                            !backendInIds.has(rid) &&
                            !backendInCombos.has(combo)
                        ) {
                            incoming.push(r);
                            backendInIds.add(rid);
                            backendInCombos.add(combo);
                        }
                    });
                } catch(e) {}
            }
        }

        // ── Auto-clean localStorage: remove cancelled/rejected & entries already in backend ─
        if (lsAll.length > 0) {
            const cleaned = lsAll.filter(r =>
                ['pending', 'approved'].includes(r.status) &&
                !backendOutIds.has(r.id) &&
                !backendOutIds.has(r._id) &&
                !backendOutCombos.has(`${r.itemId}_${normDate(r.fromDate)}`)
            );
            if (cleaned.length !== lsAll.length) {
                localStorage.setItem(`requests_${this.username}`, JSON.stringify(cleaned));
            }
        }

        // Only show pending for incoming
        const pendingIncoming = incoming.filter(r => r.status === 'pending');

        // Only show active (pending/approved) for outgoing — hide cancelled/rejected
        const activeOutgoing = outgoing.filter(r => ['pending', 'approved'].includes(r.status));

        this.renderIncoming(pendingIncoming);
        this.renderOutgoing(activeOutgoing);
        this.updateCounts(pendingIncoming.length, activeOutgoing.filter(r => r.status === 'pending').length);
        this.updateTracker(lsAll, activeOutgoing);
    }

    // ── Tracker update ────────────────────────────────────────────
    updateTracker(lsAll, outgoing) {
        const username    = this.username;
        // Only count active (non-cancelled, non-rejected) requests
        const activeReqs  = [...lsAll, ...outgoing].filter(r => ['pending','approved'].includes(r.status));
        const hasPending  = activeReqs.some(r => r.status === 'pending');
        const hasApproved = activeReqs.some(r => r.status === 'approved');
        const borrowed    = JSON.parse(localStorage.getItem(`borrowed_${username}`) || '[]');
        const hasBorrowed  = borrowed.some(b => b.status === 'active');
        const hasCompleted = borrowed.some(b => b.status === 'completed');

        const activeStep = hasCompleted ? 4 : hasBorrowed ? 3 : hasApproved ? 2 : hasPending ? 1 : 0;

        const steps    = document.querySelectorAll('.tracker-step');
        const msgEl    = document.getElementById('trackerMessage');
        if (!steps.length || !msgEl) return;

        const colors  = ['#2563eb','#7c3aed','#10b981','#f59e0b','#ec4899'];
        const shadows = ['rgba(37,99,235,.4)','rgba(124,58,237,.4)','rgba(16,185,129,.4)','rgba(245,158,11,.4)','rgba(236,72,153,.4)'];

        steps.forEach((step, i) => {
            const dot   = step.querySelector('div');
            const label = step.querySelector('div:nth-child(2)');
            if (i <= activeStep) {
                dot.style.background = `linear-gradient(135deg,${colors[i]},${colors[Math.min(i+1,4)]})`;
                dot.style.border     = 'none';
                dot.style.color      = 'white';
                dot.style.boxShadow  = `0 4px 12px ${shadows[i]}`;
                if (label) label.style.color = colors[i];
            } else {
                dot.style.background = '#f3f4f6';
                dot.style.border     = '2px solid #e5e7eb';
                dot.style.color      = '#9ca3af';
                dot.style.boxShadow  = 'none';
                if (label) label.style.color = '#9ca3af';
            }
        });

        // Update connectors
        document.querySelectorAll('#requestTracker > div > div[style*="height:3px"]').forEach((c, i) => {
            c.style.background = i < activeStep
                ? `linear-gradient(90deg,${colors[i]},${colors[i+1]})`
                : i === activeStep
                ? `linear-gradient(90deg,${colors[i]},#e5e7eb)`
                : '#e5e7eb';
        });

        const pendingCount = activeReqs.filter(r => r.status === 'pending').length;
        const messages = [
            { bg:'#eff6ff', border:'#bfdbfe', color:'#1d4ed8', icon:'info-circle',
              text:'Send a borrow request from any item page to get started.' },
            { bg:'#fef3c7', border:'#fcd34d', color:'#92400e', icon:'clock',
              text:`You have ${pendingCount} pending request${pendingCount!==1?'s':''} waiting for owner response.` },
            { bg:'#d1fae5', border:'#6ee7b7', color:'#065f46', icon:'check-circle',
              text:'A request was approved! Visit the item page to get contact details and coordinate pickup.' },
            { bg:'#dbeafe', border:'#93c5fd', color:'#1e40af', icon:'handshake',
              text:"You're actively borrowing items. Enjoy and return them on time!" },
            { bg:'#fce7f3', border:'#f9a8d4', color:'#9d174d', icon:'star',
              text:'Item returned! Leave a review on the item page to help the community.' },
        ];

        const m = messages[activeStep];
        msgEl.style.background  = m.bg;
        msgEl.style.borderColor = m.border;
        msgEl.style.color       = m.color;
        msgEl.innerHTML         = `<i class="fas fa-${m.icon}"></i> <span>${m.text}</span>`;
    }

    showLoading(id) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = Skeleton.markup('list', 3);
    }

    showError(id, msg) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = EmptyState.markup('error', { text: msg });
    }

    renderIncoming(requests) {
        const container = document.getElementById('incomingRequestsList');
        if (!container) return;
        if (!requests.length) {
            container.innerHTML = EmptyState.markup('noRequests', {
                title: 'No incoming requests',
                text: 'Nobody has asked to borrow your items yet. Listing a few more items makes you easier to find.',
                action: { label: 'List an item', href: 'lend.html', icon: 'fa-plus' }
            });
            return;
        }
        container.innerHTML = requests.map(req => this.createIncomingCard(req)).join('');
    }

    renderOutgoing(requests) {
        const container = document.getElementById('outgoingRequestsList');
        if (!container) return;
        if (!requests.length) {
            container.innerHTML = EmptyState.markup('noRequests', {
                art: 'handshake',
                title: 'No outgoing requests',
                text: 'You haven’t asked to borrow anything yet. Find something nearby and send your first request.',
                action: { label: 'Browse items', href: 'browse.html', icon: 'fa-search' }
            });
            return;
        }
        container.innerHTML = requests.map(req => this.createOutgoingCard(req)).join('');
    }

    createIncomingCard(req) {
        const id   = req._id || req.id || '';
        const img  = req.itemImage || 'https://via.placeholder.com/120';
        const days = req.duration || this.getDays(req.fromDate, req.toDate);
        const reqJson = JSON.stringify(req).replace(/'/g,"&#39;").replace(/"/g,'&quot;');

        return `
        <div style="background:white;border-radius:16px;padding:1.25rem;margin-bottom:1rem;
                    display:flex;gap:1rem;align-items:flex-start;flex-wrap:wrap;
                    box-shadow:0 2px 12px rgba(0,0,0,.07);border:1px solid #e5e7eb">
            <img src="${img}" style="width:90px;height:90px;object-fit:cover;border-radius:10px;flex-shrink:0"
                 onerror="this.src='https://via.placeholder.com/90'">
            <div style="flex:1;min-width:200px">
                <div style="font-weight:700;font-size:1rem;color:#1f2937;margin-bottom:.3rem">${req.itemName||'Unknown Item'}</div>
                <div style="font-size:.82rem;color:#6b7280;margin-bottom:.75rem">
                    <i class="fas fa-user"></i> Requested by <strong>${req.requestedBy||'Unknown'}</strong>
                    &nbsp;·&nbsp; ${req.totalPrice||req.price||'Free'}
                </div>
                <div style="display:flex;gap:.6rem;flex-wrap:wrap;margin-bottom:.75rem">
                    <div style="background:#f9fafb;border-radius:8px;padding:.35rem .7rem;font-size:.8rem">
                        <span style="color:#6b7280;font-size:.7rem;display:block">FROM</span>
                        <strong>${this.formatDate(req.fromDate)}</strong>
                    </div>
                    <div style="background:#f9fafb;border-radius:8px;padding:.35rem .7rem;font-size:.8rem">
                        <span style="color:#6b7280;font-size:.7rem;display:block">TO</span>
                        <strong>${this.formatDate(req.toDate)}</strong>
                    </div>
                    <div style="background:#eff6ff;border-radius:8px;padding:.35rem .7rem;font-size:.8rem">
                        <span style="color:#6b7280;font-size:.7rem;display:block">DAYS</span>
                        <strong style="color:#2563eb">${days}</strong>
                    </div>
                </div>
                ${req.message ? `<div style="background:#f9fafb;border-radius:8px;padding:.5rem .75rem;font-size:.8rem;color:#6b7280">"${req.message}"</div>` : ''}
            </div>
            <div style="display:flex;flex-direction:column;gap:.5rem;flex-shrink:0;min-width:120px">
                <button class="btn-approve" data-id="${id}" data-req="${reqJson}"
                    style="padding:.6rem 1rem;background:#10b981;color:white;border:none;border-radius:10px;
                           font-weight:700;cursor:pointer;font-size:.875rem;display:flex;align-items:center;
                           gap:.4rem;justify-content:center;transition:background .15s"
                    onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'">
                    <i class="fas fa-check"></i> Approve
                </button>
                <button class="btn-reject" data-id="${id}"
                    style="padding:.6rem 1rem;background:#fee2e2;color:#ef4444;border:1px solid #fca5a5;
                           border-radius:10px;font-weight:700;cursor:pointer;font-size:.875rem;
                           display:flex;align-items:center;gap:.4rem;justify-content:center;transition:all .15s"
                    onmouseover="this.style.background='#ef4444';this.style.color='white'"
                    onmouseout="this.style.background='#fee2e2';this.style.color='#ef4444'">
                    <i class="fas fa-times"></i> Decline
                </button>
            </div>
        </div>`;
    }

    createOutgoingCard(req) {
        const id     = req._id || req.id || '';
        const img    = req.itemImage || 'https://via.placeholder.com/120';
        const s      = req.status || 'pending';
        const colors = { pending:'#f97316', approved:'#10b981', rejected:'#ef4444', cancelled:'#6b7280' };
        const icons  = { pending:'clock', approved:'check-circle', rejected:'times-circle', cancelled:'ban' };
        const labels = { pending:'Pending', approved:'Approved', rejected:'Declined', cancelled:'Cancelled' };
        const days   = req.duration || this.getDays(req.fromDate, req.toDate);

        return `
        <div style="background:white;border-radius:16px;padding:1.25rem;margin-bottom:1rem;
                    display:flex;gap:1rem;align-items:flex-start;flex-wrap:wrap;
                    box-shadow:0 2px 12px rgba(0,0,0,.07);border:1px solid #e5e7eb">
            <img src="${img}" style="width:90px;height:90px;object-fit:cover;border-radius:10px;flex-shrink:0"
                 onerror="this.src='https://via.placeholder.com/90'">
            <div style="flex:1;min-width:200px">
                <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:.5rem;margin-bottom:.3rem">
                    <div style="font-weight:700;font-size:1rem;color:#1f2937">${req.itemName||'Unknown Item'}</div>
                    <span style="background:${colors[s]};color:white;padding:.2rem .65rem;border-radius:20px;font-size:.75rem;font-weight:700">
                        <i class="fas fa-${icons[s]}"></i> ${labels[s]}
                    </span>
                </div>
                <div style="font-size:.82rem;color:#6b7280;margin-bottom:.75rem">
                    <i class="fas fa-user"></i> Owner: <strong>${req.itemOwner||'Unknown'}</strong>
                </div>
                <div style="display:flex;gap:.6rem;flex-wrap:wrap;margin-bottom:.75rem">
                    <div style="background:#f9fafb;border-radius:8px;padding:.35rem .7rem;font-size:.8rem">
                        <span style="color:#6b7280;font-size:.7rem;display:block">FROM</span>
                        <strong>${this.formatDate(req.fromDate)}</strong>
                    </div>
                    <div style="background:#f9fafb;border-radius:8px;padding:.35rem .7rem;font-size:.8rem">
                        <span style="color:#6b7280;font-size:.7rem;display:block">TO</span>
                        <strong>${this.formatDate(req.toDate)}</strong>
                    </div>
                    <div style="background:#f9fafb;border-radius:8px;padding:.35rem .7rem;font-size:.8rem">
                        <span style="color:#6b7280;font-size:.7rem;display:block">DAYS</span>
                        <strong>${days}</strong>
                    </div>
                </div>
                ${s === 'approved' ? `
                <div style="background:#d1fae5;border-radius:10px;padding:.75rem;font-size:.82rem;color:#065f46">
                    <i class="fas fa-check-circle"></i> <strong>Approved!</strong>
                    <a href="item-details.html?id=${req.itemId}" style="color:#059669;font-weight:700;text-decoration:none;margin-left:.5rem">
                        View Contact Details →
                    </a>
                </div>` : ''}
            </div>
            ${s === 'pending' ? `
            <div style="flex-shrink:0">
                <button class="btn-cancel" data-id="${id}"
                    style="padding:.6rem 1rem;background:#fee2e2;color:#ef4444;border:1px solid #fca5a5;
                           border-radius:10px;font-weight:700;cursor:pointer;font-size:.875rem;
                           display:flex;align-items:center;gap:.4rem;transition:all .15s"
                    onmouseover="this.style.background='#ef4444';this.style.color='white'"
                    onmouseout="this.style.background='#fee2e2';this.style.color='#ef4444'">
                    <i class="fas fa-times"></i> Cancel
                </button>
            </div>` : ''}
        </div>`;
    }

    setupEventListeners() {
        document.addEventListener('click', e => {
            const approveBtn = e.target.closest('.btn-approve');
            const rejectBtn  = e.target.closest('.btn-reject');
            const cancelBtn  = e.target.closest('.btn-cancel');

            if (approveBtn) {
                const req = JSON.parse(approveBtn.dataset.req.replace(/&#39;/g,"'"));
                this.approveRequest(approveBtn.dataset.id, req);
            }
            if (rejectBtn)  this.rejectRequest(rejectBtn.dataset.id);
            if (cancelBtn)  this.cancelRequest(cancelBtn.dataset.id);
        });
    }

    async approveRequest(id, req) {
        if (!confirm('Approve this borrow request?')) return;

        // Update backend if real MongoID
        if (this.isMongoId(id)) {
            await this.updateBackend(id, 'approve');
        }

        // Always update localStorage for the requester
        if (req && req.requestedBy) {
            const key  = `requests_${req.requestedBy}`;
            const list = JSON.parse(localStorage.getItem(key) || '[]');
            const idx  = list.findIndex(r => r.id === id || r._id === id);
            if (idx !== -1) { list[idx].status = 'approved'; localStorage.setItem(key, JSON.stringify(list)); }

            // Write to borrower's borrowed_ list
            const borrowedKey  = `borrowed_${req.requestedBy}`;
            const borrowedList = JSON.parse(localStorage.getItem(borrowedKey) || '[]');
            const exists = borrowedList.some(b => b.requestId === id);
            if (!exists) {
                borrowedList.push({
                    id:         req.itemId,
                    itemName:   req.itemName,
                    itemImage:  req.itemImage || '',
                    owner:      this.username,
                    status:     'active',
                    borrowFrom: req.fromDate,
                    borrowTo:   req.toDate,
                    totalPaid:  req.totalPrice || 'Free',
                    requestId:  id,
                    rentalDays: req.duration || this.getDays(req.fromDate, req.toDate)
                });
                localStorage.setItem(borrowedKey, JSON.stringify(borrowedList));
            }

            // Write to owner's lent_ list
            const lentKey  = `lent_${this.username}`;
            const lentList = JSON.parse(localStorage.getItem(lentKey) || '[]');
            if (!lentList.some(l => l.requestId === id)) {
                lentList.push({
                    id:          req.itemId,
                    itemName:    req.itemName,
                    itemImage:   req.itemImage || '',
                    borrower:    req.requestedBy,
                    status:      'active',
                    borrowFrom:  req.fromDate,
                    borrowTo:    req.toDate,
                    totalEarned: req.totalPrice || 'Free',
                    requestId:   id,
                    rentalDays:  req.duration || this.getDays(req.fromDate, req.toDate)
                });
                localStorage.setItem(lentKey, JSON.stringify(lentList));
            }
        }

        this.toast('✅ Request approved!', 'success');
        this.loadAndRender();
    }

    async rejectRequest(id) {
        if (!confirm('Decline this request?')) return;
        if (this.isMongoId(id)) await this.updateBackend(id, 'reject');

        // Update status in all localStorage request lists
        this.updateAllLocalStatus(id, 'rejected');
        this.toast('Request declined.', 'info');
        this.loadAndRender();
    }

    async cancelRequest(id) {
        if (!confirm('Cancel your request?')) return;

        // Try backend cancel — works for both MongoIds and by searching item+date
        await this.updateBackend(id, 'cancel');

        // Remove from sender's localStorage entirely
        const key  = `requests_${this.username}`;
        const list = JSON.parse(localStorage.getItem(key) || '[]');

        // Find the request so we can cancel by itemId+fromDate on backend too
        const req = list.find(r => r.id === id || r._id === id);
        if (req && !this.isMongoId(id) && this.token) {
            // Cancel in backend by itemId + requester
            try {
                await fetch(`${REQUESTS_API}/api/requests/cancel-by-item`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                    body: JSON.stringify({ itemId: req.itemId, fromDate: req.fromDate })
                });
            } catch(e) { console.warn('Backend cancel-by-item failed:', e.message); }
        }

        const filtered = list.filter(r => r.id !== id && r._id !== id);
        localStorage.setItem(key, JSON.stringify(filtered));

        // Write to global cancelled set so lender's incoming scan skips this ID
        const cancelledSet = JSON.parse(localStorage.getItem('cancelled_request_ids') || '[]');
        if (!cancelledSet.includes(id)) {
            cancelledSet.push(id);
            localStorage.setItem('cancelled_request_ids', JSON.stringify(cancelledSet));
        }

        this.toast('Request cancelled.', 'info');
        this.loadAndRender();
    }

    updateAllLocalStatus(id, status) {
        // Update across all users' request lists (for cross-user incoming/outgoing sync)
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('requests_')) {
                try {
                    const list = JSON.parse(localStorage.getItem(key) || '[]');
                    let changed = false;
                    list.forEach(r => { if (r.id === id || r._id === id) { r.status = status; changed = true; } });
                    if (changed) localStorage.setItem(key, JSON.stringify(list));
                } catch(e) {}
            }
        }
    }

    async updateBackend(id, action) {
        if (!this.token) return false;
        try {
            const res  = await fetch(`${REQUESTS_API}/api/requests/${id}/${action}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (!res.ok && !data.local) { this.toast(data.message || 'Action failed', 'error'); return false; }
            return true;
        } catch (err) {
            console.warn('Backend update failed:', err.message);
            return false;
        }
    }

    isMongoId(id) {
        return /^[a-f\d]{24}$/i.test(String(id));
    }

    updateCounts(incoming, outgoing) {
        const inBadge  = document.getElementById('incomingCount');
        const outBadge = document.getElementById('outgoingCount');
        if (inBadge)  { inBadge.textContent  = incoming; inBadge.style.display  = incoming  > 0 ? 'inline-block' : 'none'; }
        if (outBadge) { outBadge.textContent  = outgoing; outBadge.style.display = outgoing  > 0 ? 'inline-block' : 'none'; }
    }

    formatDate(d) {
        if (!d) return 'N/A';
        const dt = new Date(d);
        return isNaN(dt) ? 'N/A' : dt.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
    }

    getDays(from, to) {
        if (!from || !to) return 0;
        return Math.max(0, Math.ceil((new Date(to) - new Date(from)) / 86400000));
    }

    toast(msg, type='info') {
        const colors = { success:'#10b981', error:'#ef4444', info:'#2563eb' };
        const t = document.createElement('div');
        t.style.cssText = `position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);
            background:${colors[type]||colors.info};color:white;padding:.875rem 1.5rem;
            border-radius:12px;font-weight:700;font-size:.875rem;z-index:99999;
            box-shadow:0 8px 30px rgba(0,0,0,.2);white-space:nowrap`;
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 3500);
    }
}

document.addEventListener('DOMContentLoaded', () => { new RequestsManager(); });
window.logout = () => {
    ['isLoggedIn','username','token','authToken'].forEach(k => localStorage.removeItem(k));
    window.location.href = 'index.html';
};