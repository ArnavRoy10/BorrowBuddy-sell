// My Lent Items — with two-step Return confirmation flow
const LENT_API = self.BORROWBUDDY_CONFIG.API_BASE_URL;

class MyLentItems {
    constructor() {
        this.username = localStorage.getItem('username') || 'User';
        this.token    = localStorage.getItem('authToken') || localStorage.getItem('token');
        this.lentItems = this.loadLocalCache();
        this.currentFilter = 'all';
        // Items the user dismissed with the X button — persisted separately so
        // the 4s poll (which re-fetches the full list from the backend) doesn't
        // silently bring them back. The backend has no "hide from my list"
        // concept, so this stays purely client-side.
        this.hiddenIds = new Set(JSON.parse(localStorage.getItem(`hiddenLent_${this.username}`) || '[]'));
        this.init();
    }

    async init() {
        this.renderItems();
        this.updateStats();
        this.attachEventListeners();
        this.updateCartBadge();
        await this.fetchLent();
        this.startPolling();
        this.notifyPendingReturns();
    }

    loadLocalCache() {
        return JSON.parse(localStorage.getItem(`lent_${this.username}`) || '[]');
    }

    saveLentItems() {
        localStorage.setItem(`lent_${this.username}`, JSON.stringify(this.lentItems));
    }

    // Backend Payment record -> the shape this UI already knows how to render
    mapPaymentToItem(p) {
        return {
            transactionId:     `pay_${p._id}`,
            itemName:          p.metadata?.itemName || 'Item',
            itemImage:         p.metadata?.itemImage,
            borrower:          p.metadata?.borrowerName || 'Unknown',
            status:            p.loanStatus === 'returned' ? 'returned' : (p.loanStatus || 'active'),
            borrowFrom:        p.fromDate,
            borrowTo:          p.toDate,
            totalEarned:       `₹${Number(p.amount || 0).toFixed(2)}`,
            returnRequestedAt: p.returnRequestedAt
        };
    }

    // Backend Request record (an approved "Send Request" / free borrow) -> same shape.
    // Previously these never appeared here — approval only revealed contact info.
    mapRequestToItem(r) {
        return {
            transactionId:     `req_${r._id}`,
            itemName:          r.itemName || 'Item',
            itemImage:         r.itemImage,
            borrower:          r.requestedBy || 'Unknown',
            status:            r.status === 'completed' ? 'returned' : (r.status === 'pending_return' ? 'pending_return' : 'active'),
            borrowFrom:        r.fromDate,
            borrowTo:          r.toDate,
            totalEarned:       r.totalPrice || 'Free',
            returnRequestedAt: r.returnRequestedAt
        };
    }

    // ── Real source of truth: fetch from the server, not just this browser's localStorage.
    // Merges paid loans (Payments) with approved free borrows (Requests) — this is what
    // makes return requests from the borrower's device actually show up here, for BOTH
    // borrow pathways.
    async fetchLent(silent = false) {
        if (!this.token) return;
        try {
            const [payRes, reqRes] = await Promise.all([
                fetch(`${LENT_API}/api/payments/lent`,     { headers: { 'Authorization': `Bearer ${this.token}` } }),
                fetch(`${LENT_API}/api/requests/incoming`, { headers: { 'Authorization': `Bearer ${this.token}` } })
            ]);
            const payData = await payRes.json();
            const reqData = await reqRes.json();

            const hadPending = this.lentItems.filter(i => i.status === 'pending_return').length;

            const payments = payData.success ? payData.payments.map(p => this.mapPaymentToItem(p)) : [];
            const requests = reqData.success
                ? reqData.requests
                    .filter(r => ['approved', 'pending_return', 'completed'].includes(r.status))
                    .map(r => this.mapRequestToItem(r))
                : [];

            this.lentItems = [...payments, ...requests].filter(i => !this.hiddenIds.has(i.transactionId));
            localStorage.setItem(`lent_${this.username}`, JSON.stringify(this.lentItems));
            this.renderItems();
            this.updateStats();

            const nowPending = this.lentItems.filter(i => i.status === 'pending_return').length;
            if (silent && nowPending > hadPending) {
                this.showNotification('A borrower just requested to return an item', 'info');
            }
        } catch (err) {
            console.warn('Could not refresh lent items from server:', err.message);
        }
    }

    startPolling() {
        setInterval(() => this.fetchLent(true), 4000);
    }

    // One-time toast if there are pending returns to confirm when page loads
    notifyPendingReturns() {
        const pending = this.lentItems.filter(i => i.status === 'pending_return');
        if (pending.length > 0) {
            this.showNotification(`${pending.length} item${pending.length!==1?'s':''} waiting for your return confirmation`, 'info');
        }
    }

    updateStats() {
        const stats = this.calculateStats();
        const totalLentEl    = document.getElementById('totalLentCount');
        const totalEarningsEl= document.getElementById('totalEarnings');
        const overdueCountEl = document.getElementById('overdueCount');
        if (totalLentEl)     totalLentEl.textContent     = stats.totalLent;
        if (totalEarningsEl) totalEarningsEl.textContent = `₹${stats.totalEarnings.toFixed(2)}`;
        if (overdueCountEl)  overdueCountEl.textContent  = stats.overdueCount;
    }

    calculateStats() {
        const active = this.lentItems.filter(i => (i.status === 'active' || i.status === 'pending_return'));
        const totalEarnings = this.lentItems.reduce((sum, i) => {
            const raw = String(i.totalEarned || '0').replace(/[^\d.]/g, '');
            return sum + (parseFloat(raw) || 0);
        }, 0);
        const overdue = this.lentItems.filter(i => i.status === 'active' && this.getDaysRemaining(i.borrowTo) < 0);
        return { totalLent: active.length, totalEarnings, overdueCount: overdue.length };
    }

    renderItems() {
        const grid = document.getElementById('lentItemsGrid');
        if (!grid) return;

        // Match browse.css's #itemsGrid layout (flex column list, same gap) since this
        // container has a different id and wouldn't otherwise pick up that rule.
        grid.style.cssText = 'display:flex;flex-direction:column;gap:0.85rem';

        const filteredItems = this.filterItems();

        if (filteredItems.length === 0) {
            grid.innerHTML = this.currentFilter === 'all'
                ? EmptyState.markup('noLent')
                : EmptyState.markup('noLent', {
                    art: 'inbox',
                    title: `No ${this.currentFilter} items`,
                    text: 'Nothing here for this filter yet. Switch tabs to see everything you’ve lent out.'
                });
            return;
        }

        grid.innerHTML = filteredItems.map(item => this.createItemCard(item)).join('');
        this.attachItemEventListeners();
    }

    createItemCard(item) {
        const returnStatus  = this.getReturnStatus(item);
        const daysRemaining = this.getDaysRemaining(item.borrowTo);
        const img           = item.itemImage || item.image || 'https://via.placeholder.com/200';
        const earned        = String(item.totalEarned || 'Free');
        const txId          = item.transactionId || item.requestId || item.paymentId || item.id;
        const deposit       = parseFloat(item.securityDeposit || 0);

        return `
        <div class="item-card" style="background:white;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);transition:box-shadow .2s,transform .2s;border:1px solid #e5e7eb;display:flex;min-width:0">
            <div class="item-thumb" style="position:relative;flex-shrink:0;overflow:hidden;background:linear-gradient(135deg,#667eea,#764ba2)">
                <img src="${img}" alt="${item.itemName||''}" style="width:100%;height:100%;object-fit:cover" onerror="this.src='https://via.placeholder.com/200'">
            </div>
            <div class="item-card-body" style="padding:.6rem .75rem;display:flex;flex-direction:column;flex:1 1 auto;min-width:0">

                <!-- Top row: title + status pill -->
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.4rem;margin-bottom:.2rem;min-width:0">
                    <h3 class="item-card-title" style="margin:0;font-size:.88rem;font-weight:600;color:#1f2937;line-height:1.3;
                        display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;min-width:0">
                        ${item.itemName || 'Unknown Item'}
                    </h3>
                    <span style="padding:.15rem .5rem;border-radius:20px;font-size:.62rem;font-weight:700;white-space:nowrap;flex-shrink:0;background:${returnStatus.bg};color:${returnStatus.color}">
                        <i class="fas fa-${returnStatus.icon}"></i> ${returnStatus.text}
                    </span>
                </div>

                <div style="font-size:.72rem;color:#6b7280;margin-bottom:.3rem"><i class="fas fa-user"></i> ${item.borrower || 'Unknown'}</div>

                <div style="font-size:.7rem;color:#6b7280;margin-bottom:.3rem">
                    <i class="fas fa-calendar"></i> ${this.formatDate(item.borrowFrom)} → ${this.formatDate(item.borrowTo)}
                    ${daysRemaining !== null && item.status === 'active' ? `
                    <span style="font-weight:700;color:${daysRemaining < 0 ? '#ef4444' : '#10b981'};margin-left:.4rem">
                        ${daysRemaining < 0
                            ? `<i class="fas fa-exclamation-circle"></i> Overdue ${Math.abs(daysRemaining)}d`
                            : `<i class="fas fa-clock"></i> ${daysRemaining}d left`}
                    </span>` : ''}
                </div>

                <div style="display:flex;align-items:baseline;gap:.5rem;flex-wrap:wrap;margin-bottom:.3rem">
                    <span class="item-card-price" style="color:#059669;font-weight:700;font-size:1.0rem"><i class="fas fa-rupee-sign" style="font-size:.8rem"></i> ${earned}</span>
                    ${deposit > 0 ? `
                    <span style="font-size:.68rem;color:${item.depositRefunded ? '#059669' : '#92400e'}">
                        <i class="fas fa-shield-alt" style="color:${item.depositRefunded ? '#059669' : '#f59e0b'}"></i>
                        ₹${deposit.toFixed(2)}${item.depositRefunded ? ' refunded' : ' held'}
                    </span>` : ''}
                </div>

                <div style="flex:1 1 auto;min-height:.3rem"></div>

                ${this.renderActionArea(item, txId)}
            </div>
        </div>`;
    }

    renderActionArea(item, txId) {
        const status = item.status || 'active';

        const reportBtn = `
            <a class="report-issue-btn" href="disputes.html?report=1&item=${encodeURIComponent(item.itemName||'')}&against=${encodeURIComponent(item.borrower||'')}&requestId=${encodeURIComponent(txId||'')}" style="
                padding:.35rem .6rem;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;border-radius:7px;
                font-weight:600;cursor:pointer;font-size:.68rem;display:inline-flex;align-items:center;justify-content:center;gap:.3rem;text-decoration:none;
            "><i class="fas fa-flag"></i> Report</a>`;

        const contactBtn = `
            <button class="btn-contact" data-borrower="${item.borrower||''}" style="
                padding:.4rem .65rem;background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;border-radius:7px;
                font-weight:600;cursor:pointer;font-size:.72rem;display:inline-flex;align-items:center;justify-content:center;gap:.3rem;
            "><i class="fas fa-comment"></i> Contact</button>`;

        if (status === 'pending_return') {
            return `
            <div style="display:flex;flex-wrap:wrap;gap:.4rem;align-items:center">
                <span style="
                    background:#dbeafe;border-radius:7px;padding:.3rem .55rem;font-size:.68rem;color:#1d4ed8;
                    display:inline-flex;align-items:center;gap:.3rem;font-weight:600;
                "><i class="fas fa-undo"></i> Return requested</span>
                ${contactBtn}
                <button class="btn-confirm-return" data-tx="${txId}" style="
                    padding:.4rem .65rem;background:#10b981;color:white;border:none;border-radius:7px;
                    font-weight:700;cursor:pointer;font-size:.72rem;display:inline-flex;align-items:center;justify-content:center;gap:.3rem;
                "><i class="fas fa-check-double"></i> Confirm Return</button>
                ${reportBtn}
            </div>`;
        }

        if (status === 'returned') {
            return `
            <div style="display:flex;flex-wrap:wrap;gap:.4rem;align-items:center">
                <span style="
                    background:#d1fae5;border-radius:7px;padding:.3rem .55rem;font-size:.68rem;color:#065f46;
                    display:inline-flex;align-items:center;gap:.3rem;font-weight:600;
                "><i class="fas fa-check-circle"></i> Returned</span>
                ${contactBtn}
                <button class="btn-remove-item" data-tx="${txId}" style="
                    padding:.4rem .55rem;background:#fee2e2;color:#ef4444;border:1px solid #fca5a5;border-radius:7px;
                    font-weight:600;cursor:pointer;font-size:.68rem;
                "><i class="fas fa-times"></i></button>
                ${reportBtn}
            </div>`;
        }

        // active
        return `
            <div style="display:flex;flex-wrap:wrap;gap:.4rem;align-items:center">
                ${contactBtn}
                ${reportBtn}
            </div>`;
    }

    getReturnStatus(item) {
        const status = item.status || 'active';
        if (status === 'returned')       return { icon:'check-circle',       text:'Returned',          bg:'#d1fae5', color:'#059669' };
        if (status === 'pending_return') return { icon:'hourglass-half',     text:'Pending Confirm',  bg:'#dbeafe', color:'#1d4ed8' };
        const days = this.getDaysRemaining(item.borrowTo);
        if (days !== null && days < 0)   return { icon:'exclamation-circle', text:'Overdue',           bg:'#fee2e2', color:'#ef4444' };
        return { icon:'clock', text:'On Time', bg:'#dbeafe', color:'#2563eb' };
    }

    getDaysRemaining(toDate) {
        if (!toDate) return null;
        const today = new Date(); today.setHours(0,0,0,0);
        const ret   = new Date(toDate); ret.setHours(0,0,0,0);
        return Math.ceil((ret - today) / 86400000);
    }

    filterItems() {
        if (this.currentFilter === 'all') return this.lentItems;
        return this.lentItems.filter(item => {
            const status = item.status || 'active';
            const days   = this.getDaysRemaining(item.borrowTo);
            if (this.currentFilter === 'active')   return status === 'active' && (days === null || days >= 0);
            if (this.currentFilter === 'overdue')  return status === 'active' && days !== null && days < 0;
            if (this.currentFilter === 'returned') return status === 'returned' || status === 'pending_return';
            return true;
        });
    }

    attachEventListeners() {
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentFilter = btn.dataset.status || 'all';
                document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.renderItems();
            });
        });
    }

    attachItemEventListeners() {
        document.querySelectorAll('.btn-contact').forEach(btn => {
            btn.addEventListener('click', () => {
                window.location.href = `messages.html?user=${encodeURIComponent(btn.dataset.borrower)}`;
            });
        });

        document.querySelectorAll('.btn-confirm-return').forEach(btn => {
            btn.addEventListener('click', () => this.confirmReturn(btn.dataset.tx));
        });

        document.querySelectorAll('.btn-remove-item').forEach(btn => {
            btn.addEventListener('click', () => this.removeReturnedItem(btn.dataset.tx));
        });
    }

    // ── Step 2: Owner confirms the return — flags deposit for refund ──
    // Routes to the payments or requests API depending on which borrow pathway
    // created this loan (txId is prefixed pay_/req_).
    async confirmReturn(txId) {
        const item = this.lentItems.find(i => (i.transactionId || i.requestId || i.paymentId || i.id) === txId);
        if (!item) return;
        if (!this.token) { this.showNotification('Please log in again.', 'info'); return; }

        const deposit = parseFloat(item.securityDeposit || 0);
        const msg = deposit > 0
            ? `Confirm the item was returned in good condition? This will flag the ₹${deposit.toFixed(2)} security deposit for refund to the borrower.`
            : 'Confirm the item was returned in good condition?';
        if (!confirm(msg)) return;

        const isRequest = txId.startsWith('req_');
        const id         = txId.replace(/^(pay_|req_)/, '');
        const endpoint   = isRequest
            ? `${LENT_API}/api/requests/${id}/confirm-return`
            : `${LENT_API}/api/payments/${id}/confirm-return`;

        try {
            const res  = await fetch(endpoint, {
                method:  'PUT',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            const data = await res.json();

            if (!data.success) {
                this.showNotification(data.message || 'Could not confirm return.', 'info');
                return;
            }

            await this.fetchLent();
            this.showNotification(
                deposit > 0 ? `Return confirmed! ₹${deposit.toFixed(2)} deposit flagged for refund.` : 'Return confirmed!',
                'success'
            );
        } catch (err) {
            this.showNotification('Network error — please try again.', 'info');
        }
    }

    removeReturnedItem(txId) {
        if (!confirm('Remove this item from your list? This cannot be undone.')) return;
        const idx = this.lentItems.findIndex(i => (i.transactionId || i.requestId || i.paymentId || i.id) === txId);
        if (idx === -1) return;
        this.lentItems.splice(idx, 1);
        this.saveLentItems();
        this.hiddenIds.add(txId);
        localStorage.setItem(`hiddenLent_${this.username}`, JSON.stringify([...this.hiddenIds]));
        this.renderItems();
        this.updateStats();
        this.showNotification('Item removed.', 'success');
    }

    getInitials(name) {
        if (!name) return 'U';
        const parts = name.split(' ');
        return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.substring(0,2).toUpperCase();
    }

    formatDate(d) {
        if (!d) return 'N/A';
        const dt = new Date(d);
        return isNaN(dt) ? 'N/A' : dt.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
    }

    updateCartBadge() {
        const cart  = JSON.parse(localStorage.getItem('cart') || '[]');
        const badge = document.getElementById('cartBadge');
        if (badge) { badge.textContent = cart.length; badge.style.display = cart.length > 0 ? 'inline-block' : 'none'; }
    }

    showNotification(message, type='info') {
        const n = document.createElement('div');
        n.style.cssText = `position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);
            background:${type==='success' ? '#10b981' : '#3b82f6'};color:white;padding:.875rem 1.5rem;
            border-radius:12px;font-weight:700;font-size:.875rem;z-index:99999;
            box-shadow:0 8px 30px rgba(0,0,0,.2);white-space:nowrap;max-width:90vw`;
        n.innerHTML = `<i class="fas fa-${type==='success'?'check-circle':'info-circle'}"></i> ${message}`;
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 4000);
    }
}

let myLentItems;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { myLentItems = new MyLentItems(); });
} else {
    myLentItems = new MyLentItems();
}
