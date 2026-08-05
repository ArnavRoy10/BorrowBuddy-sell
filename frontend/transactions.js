// BorrowBuddy — Transaction History
// Aggregates all payment activity from borrowed_*, lent_*, and pending_deposit_refunds

const username = localStorage.getItem('username') || '';
let allTransactions = [];
let currentFilter = 'all';
let currentSort = 'newest';

document.addEventListener('DOMContentLoaded', () => {
    if (!username) { window.location.href = 'login.html'; return; }
    loadTransactions();
    attachFilterListeners();
});

// ── Build unified transaction list ─────────────────────────────────
function loadTransactions() {
    const borrowed = JSON.parse(localStorage.getItem(`borrowed_${username}`) || '[]');
    const lent     = JSON.parse(localStorage.getItem(`lent_${username}`)     || '[]');
    const refunds  = JSON.parse(localStorage.getItem('pending_deposit_refunds') || '[]');

    const txns = [];

    // Borrowed transactions = money OUT
    borrowed.forEach(b => {
        const amount = parseAmount(b.totalPaid);
        if (amount <= 0 && !b.securityDeposit) return; // skip pure-free with no deposit
        txns.push({
            id:          b.paymentId || b.requestId || b.transactionId || `${b.id}_${b.borrowFrom}`,
            type:        'borrow',
            direction:   'out',
            itemName:    b.itemName,
            itemImage:   b.itemImage,
            counterparty:b.owner,
            amount:      amount,
            deposit:     parseFloat(b.securityDeposit || 0),
            depositRefunded: !!b.depositRefunded,
            status:      b.status || 'active',
            fromDate:    b.borrowFrom,
            toDate:      b.borrowTo,
            date:        b.borrowFrom || b.createdAt || new Date().toISOString(),
            paymentId:   b.paymentId || '—',
            method:      b.paymentId?.startsWith('demo') ? 'Test Payment' : 'Razorpay'
        });
    });

    // Lent transactions = money IN
    lent.forEach(l => {
        const amount = parseAmount(l.totalEarned);
        if (amount <= 0 && !l.securityDeposit) return;
        txns.push({
            id:          l.paymentId || l.requestId || l.transactionId || `${l.id}_${l.borrowFrom}`,
            type:        'lend',
            direction:   'in',
            itemName:    l.itemName,
            itemImage:   l.itemImage,
            counterparty:l.borrower,
            amount:      amount,
            deposit:     parseFloat(l.securityDeposit || 0),
            depositRefunded: !!l.depositRefunded,
            status:      l.status || 'active',
            fromDate:    l.borrowFrom,
            toDate:      l.borrowTo,
            date:        l.borrowFrom || l.createdAt || new Date().toISOString(),
            paymentId:   l.paymentId || '—',
            method:      l.paymentId?.startsWith('demo') ? 'Test Payment' : 'Razorpay'
        });
    });

    allTransactions = txns;
    renderStats();
    renderTransactions();
}

function parseAmount(val) {
    if (!val) return 0;
    const num = parseFloat(String(val).replace(/[^\d.]/g, ''));
    return isNaN(num) ? 0 : num;
}

// ── Stats summary ───────────────────────────────────────────────────
function renderStats() {
    const totalOut = allTransactions.filter(t => t.direction === 'out').reduce((s,t) => s + t.amount, 0);
    const totalIn  = allTransactions.filter(t => t.direction === 'in').reduce((s,t) => s + t.amount, 0);
    const depositsHeld = allTransactions.filter(t => t.deposit > 0 && !t.depositRefunded).reduce((s,t) => s + t.deposit, 0);
    const depositsBack = allTransactions.filter(t => t.deposit > 0 && t.depositRefunded).reduce((s,t) => s + t.deposit, 0);

    setText('statTotalSpent',    `₹${totalOut.toFixed(2)}`);
    setText('statTotalEarned',   `₹${totalIn.toFixed(2)}`);
    setText('statDepositsHeld',  `₹${depositsHeld.toFixed(2)}`);
    setText('statDepositsBack',  `₹${depositsBack.toFixed(2)}`);
    setText('statTxnCount',      allTransactions.length);
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

// ── Filters ──────────────────────────────────────────────────────────
function attachFilterListeners() {
    document.querySelectorAll('.txn-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.txn-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderTransactions();
        });
    });

    document.getElementById('txnSort')?.addEventListener('change', e => {
        currentSort = e.target.value;
        renderTransactions();
    });

    document.getElementById('txnSearch')?.addEventListener('input', e => {
        renderTransactions(e.target.value.toLowerCase());
    });
}

function filterAndSort(searchQuery = '') {
    let items = [...allTransactions];

    if (currentFilter === 'borrowed') items = items.filter(t => t.type === 'borrow');
    else if (currentFilter === 'lent') items = items.filter(t => t.type === 'lend');
    else if (currentFilter === 'refunded') items = items.filter(t => t.depositRefunded);
    else if (currentFilter === 'pending')  items = items.filter(t => t.deposit > 0 && !t.depositRefunded);

    if (searchQuery) {
        items = items.filter(t =>
            (t.itemName || '').toLowerCase().includes(searchQuery) ||
            (t.counterparty || '').toLowerCase().includes(searchQuery)
        );
    }

    if (currentSort === 'newest')  items.sort((a,b) => new Date(b.date) - new Date(a.date));
    if (currentSort === 'oldest')  items.sort((a,b) => new Date(a.date) - new Date(b.date));
    if (currentSort === 'highest') items.sort((a,b) => b.amount - a.amount);
    if (currentSort === 'lowest')  items.sort((a,b) => a.amount - b.amount);

    return items;
}

// ── Render list ──────────────────────────────────────────────────────
function renderTransactions(searchQuery = '') {
    const container = document.getElementById('transactionsList');
    if (!container) return;

    const items = filterAndSort(searchQuery);

    if (!items.length) {
        container.innerHTML = searchQuery
            ? EmptyState.markup('noResults', {
                art: 'receipt',
                title: 'No matching transactions',
                text: `Nothing matched "${searchQuery}". Try a different item name or clear the search.`,
                action: null
            })
            : EmptyState.markup('noTransactions');
        return;
    }

    container.innerHTML = items.map(t => createTxnRow(t)).join('');

    container.querySelectorAll('.txn-download-btn').forEach(btn => {
        btn.addEventListener('click', () => downloadReceipt(btn.dataset.id));
    });
    container.querySelectorAll('.txn-row').forEach(row => {
        row.addEventListener('click', e => {
            if (e.target.closest('.txn-download-btn')) return;
            row.classList.toggle('expanded');
        });
    });
}

function createTxnRow(t) {
    const isOut     = t.direction === 'out';
    const sign      = isOut ? '-' : '+';
    const amtColor  = isOut ? '#ef4444' : '#10b981';
    const typeLabel = t.type === 'borrow' ? 'Borrowed' : 'Lent';
    const typeIcon  = t.type === 'borrow' ? 'fa-arrow-down' : 'fa-arrow-up';
    const typeColor = t.type === 'borrow' ? '#3b82f6' : '#8b5cf6';
    const dateStr   = new Date(t.date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
    const img       = t.itemImage || 'https://via.placeholder.com/48';

    return `
    <div class="txn-row" data-id="${esc(t.id)}" style="
        background:white;border:1px solid #e5e7eb;border-radius:14px;
        padding:1rem 1.25rem;margin-bottom:.75rem;cursor:pointer;
        transition:box-shadow .15s;
    " onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,.06)'" onmouseout="this.style.boxShadow='none'">

        <div style="display:flex;align-items:center;gap:1rem">
            <img src="${img}" alt="" style="width:48px;height:48px;border-radius:10px;object-fit:cover;flex-shrink:0" onerror="this.src='https://via.placeholder.com/48'">

            <div style="width:36px;height:36px;border-radius:50%;background:${typeColor}1a;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <i class="fas ${typeIcon}" style="color:${typeColor};font-size:.85rem"></i>
            </div>

            <div style="flex:1;min-width:0">
                <div style="display:flex;justify-content:space-between;align-items:start;gap:.5rem">
                    <div style="min-width:0">
                        <div style="font-weight:700;font-size:.9rem;color:#1f2937;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.itemName)}</div>
                        <div style="font-size:.78rem;color:#6b7280">${typeLabel} ${isOut ? 'from' : 'to'} <strong>${esc(t.counterparty)}</strong></div>
                    </div>
                    <div style="text-align:right;flex-shrink:0">
                        <div style="font-weight:800;font-size:1rem;color:${amtColor}">${sign}₹${t.amount.toFixed(2)}</div>
                        <div style="font-size:.72rem;color:#9ca3af">${dateStr}</div>
                    </div>
                </div>
            </div>

            <button class="txn-download-btn" data-id="${esc(t.id)}" title="Download receipt" style="
                background:#f3f4f6;border:none;width:34px;height:34px;border-radius:10px;
                cursor:pointer;color:#6b7280;flex-shrink:0;transition:all .15s;
            " onmouseover="this.style.background='#2563eb';this.style.color='white'" onmouseout="this.style.background='#f3f4f6';this.style.color='#6b7280'">
                <i class="fas fa-download"></i>
            </button>

            <a class="txn-report-btn" title="Report an issue with this rental"
               href="disputes.html?report=1&item=${encodeURIComponent(t.itemName || '')}&against=${encodeURIComponent(t.counterparty || '')}&requestId=${encodeURIComponent(t.id || '')}"
               onclick="event.stopPropagation()" style="
                background:#fff7ed;border:1px solid #fed7aa;width:34px;height:34px;border-radius:10px;
                cursor:pointer;color:#c2410c;flex-shrink:0;display:flex;align-items:center;justify-content:center;text-decoration:none;
            ">
                <i class="fas fa-flag"></i>
            </a>
        </div>

        <!-- Expanded details -->
        <div class="txn-details" style="
            max-height:0;overflow:hidden;transition:max-height .25s ease;
        ">
            <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid #f3f4f6;display:grid;grid-template-columns:1fr 1fr;gap:.75rem;font-size:.8rem">
                <div><span style="color:#9ca3af">Payment ID</span><br><strong>${esc(t.paymentId)}</strong></div>
                <div><span style="color:#9ca3af">Method</span><br><strong>${esc(t.method)}</strong></div>
                <div><span style="color:#9ca3af">Borrow Period</span><br><strong>${fmtDate(t.fromDate)} → ${fmtDate(t.toDate)}</strong></div>
                <div><span style="color:#9ca3af">Status</span><br><strong style="text-transform:capitalize">${esc(t.status.replace('_',' '))}</strong></div>
                ${t.deposit > 0 ? `
                <div style="grid-column:1/-1;background:${t.depositRefunded ? '#d1fae5' : '#fffbeb'};border-radius:8px;padding:.6rem .75rem;margin-top:.25rem">
                    <i class="fas fa-shield-alt" style="color:${t.depositRefunded ? '#059669' : '#f59e0b'}"></i>
                    Security Deposit: <strong>₹${t.deposit.toFixed(2)}</strong>
                    ${t.depositRefunded ? ' — Refunded ✓' : ' — Held (pending return)'}
                </div>` : ''}
            </div>
        </div>
    </div>
    <style>.txn-row.expanded .txn-details { max-height: 200px !important; }</style>
    `;
}

// ── Receipt generation (print → save as PDF) ────────────────────────
function downloadReceipt(txnId) {
    const t = allTransactions.find(x => x.id === txnId);
    if (!t) return;

    const win = window.open('', '_blank', 'width=650,height=800');
    const dateStr = new Date(t.date).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });
    const receiptNo = `BB-${t.paymentId?.slice(-8) || Date.now().toString().slice(-8)}`.toUpperCase();

    win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Receipt - ${receiptNo}</title>
        <style>
            * { margin:0; padding:0; box-sizing:border-box; font-family: 'Segoe UI', Arial, sans-serif; }
            body { padding: 40px; color: #1f2937; }
            .receipt { max-width: 560px; margin: 0 auto; border: 2px solid #e5e7eb; border-radius: 16px; overflow: hidden; }
            .header { background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; padding: 28px 32px; }
            .header h1 { font-size: 22px; margin-bottom: 4px; }
            .header p { font-size: 13px; opacity: .85; }
            .body { padding: 28px 32px; }
            .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
            .row span:first-child { color: #6b7280; }
            .row span:last-child { font-weight: 700; }
            .total-box { background: #f9fafb; border-radius: 10px; padding: 16px; margin-top: 20px; }
            .total-row { display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; color: ${t.direction === 'out' ? '#ef4444' : '#10b981'}; }
            .footer { text-align: center; padding: 20px 32px; font-size: 11px; color: #9ca3af; border-top: 1px solid #f3f4f6; }
            .badge { display: inline-block; background: #eff6ff; color: #2563eb; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; margin-top: 6px; }
            @media print { body { padding: 0; } .receipt { border: none; } }
        </style>
    </head>
    <body>
        <div class="receipt">
            <div class="header">
                <h1>🔄 BorrowBuddy</h1>
                <p>Payment Receipt</p>
            </div>
            <div class="body">
                <div class="row"><span>Receipt No.</span><span>${receiptNo}</span></div>
                <div class="row"><span>Date</span><span>${dateStr}</span></div>
                <div class="row"><span>Item</span><span>${esc(t.itemName)}</span></div>
                <div class="row"><span>${t.direction === 'out' ? 'Paid to' : 'Received from'}</span><span>${esc(t.counterparty)}</span></div>
                <div class="row"><span>Transaction Type</span><span>${t.type === 'borrow' ? 'Item Borrowed' : 'Item Lent'}</span></div>
                <div class="row"><span>Borrow Period</span><span>${fmtDate(t.fromDate)} – ${fmtDate(t.toDate)}</span></div>
                <div class="row"><span>Payment Method</span><span>${esc(t.method)}</span></div>
                <div class="row"><span>Payment ID</span><span>${esc(t.paymentId)}</span></div>
                ${t.deposit > 0 ? `<div class="row"><span>Security Deposit</span><span>₹${t.deposit.toFixed(2)} ${t.depositRefunded ? '(Refunded)' : '(Held)'}</span></div>` : ''}

                <div class="total-box">
                    <div class="total-row">
                        <span>${t.direction === 'out' ? 'Total Paid' : 'Total Earned'}</span>
                        <span>${t.direction === 'out' ? '-' : '+'}₹${t.amount.toFixed(2)}</span>
                    </div>
                    <div class="badge">${t.status.replace('_',' ').toUpperCase()}</div>
                </div>
            </div>
            <div class="footer">
                This is a computer-generated receipt from BorrowBuddy.<br>
                Generated on ${new Date().toLocaleString('en-IN')}
            </div>
        </div>
        <script>
            window.onload = () => { window.print(); };
        </script>
    </body>
    </html>`);
    win.document.close();
}

function fmtDate(d) {
    if (!d) return '—';
    const dt = new Date(d);
    return isNaN(dt) ? '—' : dt.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
}

function esc(str = '') {
    return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}