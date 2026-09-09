// My Borrowed Items — with two-step Return flow
const BORROWED_API = self.BORROWBUDDY_CONFIG.API_BASE_URL;

class MyBorrowedItems {
    constructor() {
        this.username = localStorage.getItem('username') || 'User';
        this.token    = localStorage.getItem('authToken') || localStorage.getItem('token');
        this.borrowedItems = this.loadLocalCache(); // instant paint from cache while backend loads
        this.currentFilter = 'all';
        // Items the user dismissed with the X button — persisted separately so
        // the 4s poll (which re-fetches the full list from the backend) doesn't
        // silently bring them back. The backend has no "hide from my list"
        // concept, so this stays purely client-side.
        this.hiddenIds = new Set(JSON.parse(localStorage.getItem(`hiddenBorrowed_${this.username}`) || '[]'));
        this.init();
    }

    async init() {
        this.renderItems();
        this.attachEventListeners();
        this.updateCartBadge();
        await this.fetchBorrowed();
        this.startPolling();
    }

    loadLocalCache() {
        return JSON.parse(localStorage.getItem(`borrowed_${this.username}`) || '[]');
    }

    saveBorrowedItems() {
        localStorage.setItem(`borrowed_${this.username}`, JSON.stringify(this.borrowedItems));
    }

    // Backend Payment record -> the shape this UI already knows how to render
    mapPaymentToItem(p) {
        return {
            transactionId:   `pay_${p._id}`,
            itemName:        p.metadata?.itemName || 'Item',
            itemImage:       p.metadata?.itemImage,
            owner:           p.metadata?.lenderName || 'Unknown',
            status:          p.loanStatus === 'returned' ? 'completed' : (p.loanStatus || 'active'),
            borrowFrom:      p.fromDate,
            borrowTo:        p.toDate,
            totalPaid:       `₹${Number(p.amount || 0).toFixed(2)}`,
            returnRequestedAt: p.returnRequestedAt
        };
    }

    // Backend Request record (a "Send Request" / free borrow that got approved) -> same shape.
    // Previously these never appeared here at all — approval only unlocked contact info.
    mapRequestToItem(r) {
        return {
            transactionId:   `req_${r._id}`,
            itemName:        r.itemName || 'Item',
            itemImage:       r.itemImage,
            owner:           r.itemOwner || 'Unknown',
            status:          r.status === 'completed' ? 'completed' : (r.status === 'pending_return' ? 'pending_return' : 'active'),
            borrowFrom:      r.fromDate,
            borrowTo:        r.toDate,
            totalPaid:       r.totalPrice || 'Free',
            returnRequestedAt: r.returnRequestedAt
        };
    }

    // ── Real source of truth: fetch from the server, not just this browser's localStorage.
    // Both borrow paths are merged: paid "Instant Access" loans (Payment records) AND
    // approved free "Send Request" borrows (Request records) — previously only the
    // paid path ever showed up here.
    async fetchBorrowed() {
        if (!this.token) return;
        try {
            const [payRes, reqRes] = await Promise.all([
                fetch(`${BORROWED_API}/api/payments/borrowed`,  { headers: { 'Authorization': `Bearer ${this.token}` } }),
                fetch(`${BORROWED_API}/api/requests/outgoing`,  { headers: { 'Authorization': `Bearer ${this.token}` } })
            ]);
            const payData = await payRes.json();
            const reqData = await reqRes.json();

            const payments = payData.success ? payData.payments.map(p => this.mapPaymentToItem(p)) : [];
            const requests = reqData.success
                ? reqData.requests
                    .filter(r => ['approved', 'pending_return', 'completed'].includes(r.status))
                    .map(r => this.mapRequestToItem(r))
                : [];

            this.borrowedItems = [...payments, ...requests].filter(i => !this.hiddenIds.has(i.transactionId));
            localStorage.setItem(`borrowed_${this.username}`, JSON.stringify(this.borrowedItems));
            this.renderItems();
        } catch (err) {
            console.warn('Could not refresh borrowed items from server:', err.message);
        }
    }

    // Poll every 4s to pick up owner confirmations from the other side
    startPolling() {
        setInterval(() => this.fetchBorrowed(), 4000);
    }

    renderItems() {
        const grid = document.getElementById('borrowedItemsGrid');
        if (!grid) return;

        // Match browse.css's #itemsGrid layout (flex column list, same gap) since this
        // container has a different id and wouldn't otherwise pick up that rule.
        grid.style.cssText = 'display:flex;flex-direction:column;gap:0.85rem';

        const filteredItems = this.filterItems();

        if (filteredItems.length === 0) {
            grid.innerHTML = this.currentFilter === 'all'
                ? EmptyState.markup('noBorrowed')
                : EmptyState.markup('noBorrowed', {
                    art: 'inbox',
                    title: `No ${this.currentFilter} items`,
                    text: 'Nothing in this category right now. Switch tabs to see the rest of your borrows.',
                    action: { label: 'Show all items', onclick: "document.querySelector('.category-btn[data-status=\\'all\\']')?.click()", icon: 'fa-list' }
                });
            return;
        }

        grid.innerHTML = filteredItems.map(item => this.createItemCard(item)).join('');
        this.attachItemEventListeners();
    }

    createItemCard(item) {
        const statusInfo    = this.getStatusInfo(item);
        const daysRemaining = this.getDaysRemaining(item.borrowTo);
        const img           = item.itemImage || item.image || 'https://via.placeholder.com/200';
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
                    ${statusInfo.pill}
                </div>

                <div style="font-size:.72rem;color:#6b7280;margin-bottom:.3rem"><i class="fas fa-user"></i> ${item.owner || 'Unknown'}</div>

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
                    <span class="item-card-price" style="color:#0f766e;font-weight:700;font-size:1.0rem">${item.totalPaid || 'Free'}</span>
                    ${deposit > 0 ? `
                    <span style="font-size:.68rem;color:${item.depositRefunded ? '#059669' : '#92400e'}">
                        <i class="fas fa-shield-alt" style="color:${item.depositRefunded ? '#059669' : '#f59e0b'}"></i>
                        ₹${deposit.toFixed(2)}${item.depositRefunded ? ' refunded' : item.status === 'completed' ? ' pending refund' : ' deposit'}
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
            <a class="report-issue-btn" href="disputes.html?report=1&item=${encodeURIComponent(item.itemName||'')}&against=${encodeURIComponent(item.owner||'')}&requestId=${encodeURIComponent(txId||'')}" style="
                padding:.35rem .6rem;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;border-radius:7px;
                font-weight:600;cursor:pointer;font-size:.68rem;display:inline-flex;align-items:center;justify-content:center;gap:.3rem;text-decoration:none;
            "><i class="fas fa-flag"></i> Report</a>`;

        const msgBtn = `
            <button class="message-owner-btn" data-owner="${item.owner||''}" style="
                padding:.4rem .65rem;background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;border-radius:7px;
                font-weight:600;cursor:pointer;font-size:.72rem;display:inline-flex;align-items:center;justify-content:center;gap:.3rem;
            "><i class="fas fa-comment"></i> Message</button>`;

        if (status === 'active') {
            return `
            <div style="display:flex;flex-wrap:wrap;gap:.4rem;align-items:center">
                ${msgBtn}
                <button class="return-item-btn" data-tx="${txId}" style="
                    padding:.4rem .65rem;background:#fef3c7;color:#92400e;border:1px solid #fcd34d;border-radius:7px;
                    font-weight:600;cursor:pointer;font-size:.72rem;display:inline-flex;align-items:center;justify-content:center;gap:.3rem;
                "><i class="fas fa-undo"></i> Return</button>
                ${reportBtn}
            </div>`;
        }

        if (status === 'pending_return') {
            return `
            <div style="
                background:#eff6ff;border:1px dashed #93c5fd;border-radius:8px;padding:.4rem .6rem;
                font-size:.72rem;color:#1d4ed8;display:flex;align-items:center;gap:.4rem;width:fit-content;
            "><i class="fas fa-hourglass-half fa-spin"></i> Waiting for owner to confirm…</div>`;
        }

        if (status === 'completed') {
            return `
            <div style="display:flex;flex-wrap:wrap;gap:.4rem;align-items:center">
                <span style="
                    background:#d1fae5;border-radius:7px;padding:.3rem .55rem;font-size:.68rem;color:#065f46;
                    display:inline-flex;align-items:center;gap:.3rem;font-weight:600;
                "><i class="fas fa-check-circle"></i> Returned</span>
                ${msgBtn}
                <button class="leave-review-btn" data-item-id="${item.id}" style="
                    padding:.4rem .65rem;background:#fffbeb;color:#92400e;border:1px solid #fde68a;border-radius:7px;
                    font-weight:600;cursor:pointer;font-size:.72rem;display:inline-flex;align-items:center;justify-content:center;gap:.3rem;
                "><i class="fas fa-star"></i> Review</button>
                <button class="remove-item-btn" data-tx="${txId}" style="
                    padding:.4rem .55rem;background:#fee2e2;color:#ef4444;border:1px solid #fca5a5;border-radius:7px;
                    font-weight:600;cursor:pointer;font-size:.68rem;
                "><i class="fas fa-times"></i></button>
                ${reportBtn}
            </div>`;
        }

        return msgBtn ? `<div style="display:flex;gap:.4rem">${msgBtn}</div>` : '';
    }

    getStatusInfo(item) {
        const daysRemaining = this.getDaysRemaining(item.borrowTo);
        const status = item.status || 'active';

        const pillStyle = 'padding:.15rem .5rem;border-radius:20px;font-size:.62rem;font-weight:700;white-space:nowrap;flex-shrink:0';

        if (status === 'completed') {
            return { pill: `<span style="${pillStyle};background:#d1fae5;color:#059669"><i class="fas fa-check-circle"></i> Returned</span>` };
        }
        if (status === 'pending_return') {
            return { pill: `<span style="${pillStyle};background:#dbeafe;color:#1d4ed8"><i class="fas fa-hourglass-half"></i> Pending</span>` };
        }
        if (daysRemaining !== null && daysRemaining < 0) {
            return { pill: `<span style="${pillStyle};background:#fee2e2;color:#dc2626"><i class="fas fa-exclamation-triangle"></i> Overdue</span>` };
        }
        return { pill: `<span style="${pillStyle};background:#dbeafe;color:#2563eb"><i class="fas fa-clock"></i> Active</span>` };
    }

    getDaysRemaining(toDate) {
        if (!toDate) return null;
        const today = new Date(); today.setHours(0,0,0,0);
        const ret   = new Date(toDate); ret.setHours(0,0,0,0);
        return Math.ceil((ret - today) / 86400000);
    }

    filterItems() {
        if (this.currentFilter === 'all') return this.borrowedItems;
        return this.borrowedItems.filter(item => {
            const status = item.status || 'active';
            const days   = this.getDaysRemaining(item.borrowTo);
            if (this.currentFilter === 'active')    return status === 'active' && (days === null || days >= 0);
            if (this.currentFilter === 'overdue')   return status === 'active' && days !== null && days < 0;
            if (this.currentFilter === 'completed') return status === 'completed' || status === 'pending_return';
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
        document.querySelectorAll('.message-owner-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                window.location.href = `messages.html?user=${encodeURIComponent(btn.dataset.owner)}`;
            });
        });

        document.querySelectorAll('.return-item-btn').forEach(btn => {
            btn.addEventListener('click', () => this.requestReturn(btn.dataset.tx));
        });

        document.querySelectorAll('.remove-item-btn').forEach(btn => {
            btn.addEventListener('click', () => this.removeItem(btn.dataset.tx));
        });

        document.querySelectorAll('.leave-review-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                window.location.href = `item-details.html?id=${btn.dataset.itemId}#reviews`;
            });
        });
    }

    // ── Step 1: Borrower requests return ──────────────────────────
    // This now hits the backend, so the owner's own device actually receives it —
    // previously this only wrote to the borrower's own localStorage under a key
    // named for the owner, which the owner's browser never reads.
    // txId is prefixed (pay_/req_) so we know which backend record to update.
    async requestReturn(txId) {
        if (!confirm('Request to return this item? The owner will need to confirm before your deposit is released.')) return;
        if (!this.token) { this.showNotification('Please log in again.', 'info'); return; }

        const isRequest = txId.startsWith('req_');
        const id         = txId.replace(/^(pay_|req_)/, '');
        const endpoint   = isRequest
            ? `${BORROWED_API}/api/requests/${id}/request-return`
            : `${BORROWED_API}/api/payments/${id}/request-return`;

        try {
            const res  = await fetch(endpoint, {
                method:  'PUT',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            const data = await res.json();

            if (!data.success) {
                this.showNotification(data.message || 'Could not request return.', 'info');
                return;
            }

            await this.fetchBorrowed();
            this.showNotification('Return requested! Waiting for owner to confirm.', 'success');
        } catch (err) {
            this.showNotification('Network error — please try again.', 'info');
        }
    }

    removeItem(txId) {
        if (!confirm('Remove this item from your list?')) return;
        const idx = this.borrowedItems.findIndex(i => (i.transactionId || i.requestId || i.paymentId || i.id) === txId);
        if (idx === -1) return;
        this.borrowedItems.splice(idx, 1);
        this.saveBorrowedItems();
        this.hiddenIds.add(txId);
        localStorage.setItem(`hiddenBorrowed_${this.username}`, JSON.stringify([...this.hiddenIds]));
        this.renderItems();
        this.showNotification('Item removed.', 'success');
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
            box-shadow:0 8px 30px rgba(0,0,0,.2);white-space:nowrap`;
        n.innerHTML = `<i class="fas fa-${type==='success'?'check-circle':'info-circle'}"></i> ${message}`;
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 3000);
    }
}

let myBorrowedItems;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { myBorrowedItems = new MyBorrowedItems(); });
} else {
    myBorrowedItems = new MyBorrowedItems();
}
