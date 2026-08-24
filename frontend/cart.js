// BorrowBuddy — Cart with two-pathway checkout
const CART_API = self.BORROWBUDDY_CONFIG.API_BASE_URL + '/api';

let cartItems = [];

document.addEventListener('DOMContentLoaded', () => {
    loadCart();
    document.getElementById('clearCartBtn')?.addEventListener('click', clearCart);
    document.getElementById('requestAllBtn')?.addEventListener('click', showCheckoutModal);
});

// ── Load & render ─────────────────────────────────────────────────
function loadCart() {
    cartItems = JSON.parse(localStorage.getItem('cart') || '[]');
    renderCart();
    renderSummary();
    updateBadge();
}

function renderCart() {
    const container = document.getElementById('cartItemsContainer');
    const empty     = document.getElementById('emptyCartMessage');
    const countEl   = document.getElementById('cartItemCount');

    if (!cartItems.length) {
        container.innerHTML = '';
        empty.style.display = 'flex';
        countEl.textContent = '0';
        document.getElementById('requestAllBtn').disabled = true;
        return;
    }

    empty.style.display = 'none';
    countEl.textContent  = cartItems.length;
    document.getElementById('requestAllBtn').disabled = false;

    container.innerHTML = cartItems.map((item, i) => {
        const img    = (item.images && item.images[0]) || item.image || 'https://via.placeholder.com/100';
        const price  = parseFloat((item.price || '0').toString().replace(/[^\d.]/g,'')) || 0;
        const days   = item.rentalDays || 1;
        const rental = price * days;
        const deposit= parseFloat(item.securityDeposit) || 0;

        return `
        <div class="cart-item" id="cart-item-${i}">
            <div class="cart-item-image">
                <img src="${img}" alt="${esc(item.name)}"
                     onerror="this.src='https://via.placeholder.com/140'">
            </div>

            <div class="cart-item-details">
                <h3 class="cart-item-title">${esc(item.name)}</h3>

                <div class="item-meta">
                    <span><i class="fas fa-user"></i> ${esc(item.owner)}</span>
                    <span class="item-category-badge">${esc(item.category||'item')}</span>
                </div>

                <div class="date-selection">
                    <div class="date-input-group">
                        <label><i class="fas fa-calendar-alt"></i> From</label>
                        <input type="date" class="date-input" value="${item.fromDate||''}"
                               min="${new Date().toISOString().split('T')[0]}"
                               onchange="updateDates(${i},'from',this.value)">
                    </div>
                    <div class="date-input-group">
                        <label><i class="fas fa-calendar-check"></i> To</label>
                        <input type="date" class="date-input" value="${item.toDate||''}"
                               min="${item.fromDate||new Date().toISOString().split('T')[0]}"
                               onchange="updateDates(${i},'to',this.value)">
                    </div>
                    ${days > 0 && item.fromDate && item.toDate ? `
                    <span class="days-badge">
                        <i class="fas fa-clock"></i> ${days} day${days!==1?'s':''}
                    </span>` : ''}
                </div>

                <div class="cart-item-actions-row">
                    <button class="cart-text-action" onclick="removeItem(${i})" title="Remove from cart">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>

            <div class="cart-item-price-col">
                <div class="price">${price>0?`₹${price}<span>/day</span>`:'Free'}</div>
                ${rental > 0 ? `<div class="price-sub">Rental: ₹${rental.toFixed(2)}</div>` : ''}
                ${deposit > 0 ? `<div class="price-sub deposit"><i class="fas fa-shield-alt"></i> Deposit: ₹${deposit}</div>` : ''}
            </div>
        </div>`;
    }).join('');
}

function renderSummary() {
    const summaryEl = document.getElementById('cartSummaryItems');
    const totalEl   = document.getElementById('cartTotal');
    const depositEl = document.getElementById('totalDeposit');
    const inlineCountEl = document.getElementById('cartItemCountInline');
    const inlineTotalEl = document.getElementById('cartSubtotalInline');

    if (!cartItems.length) {
        summaryEl.innerHTML = '<p style="color:#6b7280;font-size:.875rem">Your cart is empty</p>';
        totalEl.textContent  = '₹0.00';
        if (depositEl) depositEl.innerHTML = '';
        if (inlineCountEl) inlineCountEl.textContent = '0';
        if (inlineTotalEl) inlineTotalEl.textContent = '₹0.00';
        return;
    }

    let rentalTotal  = 0;
    let depositTotal = 0;

    summaryEl.innerHTML = cartItems.map(item => {
        const price   = parseFloat((item.price||'0').toString().replace(/[^\d.]/g,'')) || 0;
        const days    = item.rentalDays || 1;
        const rental  = price * days;
        const deposit = parseFloat(item.securityDeposit) || 0;
        rentalTotal  += rental;
        depositTotal += deposit;

        return `
        <div style="display:flex;justify-content:space-between;align-items:start;
                    padding:.5rem 0;border-bottom:1px solid #e5e7eb;gap:.5rem">
            <span style="font-size:.82rem;color:#4b5563;flex:1">${esc(item.name)}</span>
            <span style="font-size:.82rem;font-weight:700;color:#1f2937;white-space:nowrap">
                ${rental > 0 ? `₹${rental.toFixed(2)}` : 'Free'}
            </span>
        </div>`;
    }).join('');

    totalEl.textContent = rentalTotal > 0 ? `₹${rentalTotal.toFixed(2)}` : 'Free';
    if (inlineCountEl) inlineCountEl.textContent = cartItems.length;
    if (inlineTotalEl) inlineTotalEl.textContent = rentalTotal > 0 ? `₹${rentalTotal.toFixed(2)}` : 'Free';

    if (depositEl && depositTotal > 0) {
        depositEl.innerHTML = `
        <div style="margin-top:.75rem;padding:.75rem;background:#fffbeb;
                    border-radius:8px;border:1px solid #fde68a">
            <div style="font-size:.78rem;color:#b45309;font-weight:700;margin-bottom:.25rem">
                <i class="fas fa-shield-alt"></i> Security Deposits
            </div>
            <div style="display:flex;justify-content:space-between;font-size:.82rem;color:#78350f">
                <span>Total Deposits</span>
                <span style="font-weight:700">₹${depositTotal.toFixed(2)}</span>
            </div>
            <div style="font-size:.7rem;color:#92400e;margin-top:.3rem">
                Refunded after items are returned
            </div>
        </div>`;
    }
}

// ── Date updates ──────────────────────────────────────────────────
function updateDates(index, field, value) {
    if (field === 'from') {
        cartItems[index].fromDate = value;
        if (cartItems[index].toDate && cartItems[index].toDate <= value) {
            cartItems[index].toDate = '';
        }
    } else {
        if (value <= cartItems[index].fromDate) {
            alert('End date must be after start date');
            return;
        }
        cartItems[index].toDate = value;
    }

    if (cartItems[index].fromDate && cartItems[index].toDate) {
        cartItems[index].rentalDays = Math.max(1, Math.ceil(
            (new Date(cartItems[index].toDate) - new Date(cartItems[index].fromDate)) / 86400000
        ));
    }

    saveCart();
    renderCart();
    renderSummary();
}

// ── Remove / Clear ────────────────────────────────────────────────
function removeItem(index) {
    cartItems.splice(index, 1);
    saveCart();
    renderCart();
    renderSummary();
    updateBadge();
}

function clearCart() {
    if (!cartItems.length) return;
    if (!confirm(`Remove all ${cartItems.length} item${cartItems.length!==1?'s':''} from cart?`)) return;
    cartItems = [];
    saveCart();
    renderCart();
    renderSummary();
    updateBadge();
}

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cartItems));
}

function updateBadge() {
    const badge = document.getElementById('cartBadge');
    if (badge) {
        badge.textContent   = cartItems.length;
        badge.style.display = cartItems.length > 0 ? 'inline-block' : 'none';
    }
}

// ── Checkout Modal ────────────────────────────────────────────────
function showCheckoutModal() {
    // Validate all items have dates
    const missing = cartItems.filter(i => !i.fromDate || !i.toDate);
    if (missing.length) {
        alert(`Please set From and To dates for: ${missing.map(i=>i.name).join(', ')}`);
        return;
    }

    const rentalTotal  = calcRentalTotal();
    const instantFee   = (10 + rentalTotal * 0.10).toFixed(2);
    const daysInfo     = cartItems.map(i => `${i.name} · ${i.rentalDays} day${i.rentalDays!==1?'s':''}`).join('<br>');

    const modal = document.createElement('div');
    modal.id    = 'checkoutModal';
    modal.style.cssText = `
        position:fixed;inset:0;z-index:99999;
        background:rgba(15,23,42,0.75);backdrop-filter:blur(5px);
        display:flex;align-items:center;justify-content:center;padding:1rem;
    `;
    modal.innerHTML = `
        <div style="
            background:#fff;border-radius:22px;width:100%;max-width:580px;
            box-shadow:0 40px 100px rgba(0,0,0,0.35);overflow:hidden;
            animation:slideUp .25s ease;
        ">
            <!-- Header -->
            <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb,#7c3aed);padding:1.75rem 2rem;color:white">
                <div style="display:flex;justify-content:space-between;align-items:start">
                    <div>
                        <div style="font-size:.72rem;font-weight:700;letter-spacing:.1em;opacity:.7;text-transform:uppercase;margin-bottom:.3rem">
                            Checkout — ${cartItems.length} item${cartItems.length!==1?'s':''}
                        </div>
                        <div style="font-size:1.3rem;font-weight:800">How do you want to borrow?</div>
                    </div>
                    <button onclick="document.getElementById('checkoutModal').remove()"
                        style="background:rgba(255,255,255,.15);border:none;color:white;
                               width:34px;height:34px;border-radius:50%;cursor:pointer;
                               font-size:1rem;display:flex;align-items:center;justify-content:center">✕</button>
                </div>

                <!-- Item summary pills -->
                <div style="display:flex;flex-wrap:wrap;gap:.4rem;margin-top:1rem">
                    ${cartItems.map(i=>`
                    <div style="background:rgba(255,255,255,.15);border-radius:20px;padding:.25rem .75rem;font-size:.75rem;display:flex;align-items:center;gap:.4rem">
                        <i class="fas fa-box"></i> ${esc(i.name)}
                        <span style="opacity:.7">· ${i.rentalDays}d</span>
                    </div>`).join('')}
                </div>

                <div style="display:flex;gap:1.5rem;margin-top:1rem;font-size:.82rem;opacity:.8">
                    <span><i class="fas fa-rupee-sign"></i> Rental: ₹${rentalTotal.toFixed(2)}</span>
                </div>
            </div>

            <!-- Options -->
            <div style="padding:1.5rem 2rem;display:grid;grid-template-columns:1fr 1fr;gap:1rem">

                <!-- Option 1: Standard Request -->
                <div onclick="chooseStandardCheckout()" style="
                    border:2px solid #e5e7eb;border-radius:16px;padding:1.25rem;
                    cursor:pointer;transition:all .2s;
                " onmouseover="this.style.borderColor='#2563eb';this.style.background='#eff6ff'"
                   onmouseout="this.style.borderColor='#e5e7eb';this.style.background='#fff'">
                    <div style="font-size:2rem;margin-bottom:.5rem">📬</div>
                    <div style="font-weight:700;color:#1f2937;margin-bottom:.4rem">Send Requests</div>
                    <div style="font-size:.78rem;color:#6b7280;line-height:1.5;margin-bottom:.75rem">
                        Send borrow requests to all owners. Get contact details once each owner accepts.
                    </div>
                    <div style="background:#f0fdf4;color:#15803d;font-size:.75rem;font-weight:700;
                                padding:.3rem .6rem;border-radius:6px;display:inline-block;margin-bottom:.5rem">
                        ✓ Free
                    </div>
                    <div style="font-size:.72rem;color:#9ca3af"><i class="fas fa-clock"></i> Requires owner acceptance</div>
                    <button onclick="event.stopPropagation();chooseStandardCheckout()" style="
                        width:100%;margin-top:1rem;padding:.65rem;background:#2563eb;
                        color:white;border:none;border-radius:10px;font-weight:700;
                        font-size:.875rem;cursor:pointer;transition:background .15s;
                    " onmouseover="this.style.background='#1d4ed8'" onmouseout="this.style.background='#2563eb'">
                        <i class="fas fa-paper-plane"></i> Send All Requests
                    </button>
                </div>

                <!-- Option 2: Instant Unlock -->
                <div onclick="chooseInstantCheckout()" style="
                    border:2px solid #7c3aed;border-radius:16px;padding:1.25rem;
                    cursor:pointer;transition:all .2s;background:#faf5ff;position:relative;overflow:hidden;
                " onmouseover="this.style.background='#f3e8ff'"
                   onmouseout="this.style.background='#faf5ff'">
                    <div style="position:absolute;top:.6rem;right:.6rem;background:linear-gradient(135deg,#7c3aed,#2563eb);
                                color:white;font-size:.62rem;font-weight:700;padding:2px 8px;border-radius:20px;
                                text-transform:uppercase;letter-spacing:.05em">Instant</div>
                    <div style="font-size:2rem;margin-bottom:.5rem">⚡</div>
                    <div style="font-weight:700;color:#1f2937;margin-bottom:.4rem">Instant Unlock All</div>
                    <div style="font-size:.78rem;color:#6b7280;line-height:1.5;margin-bottom:.75rem">
                        Pay once and instantly get all owners' phone numbers, details and pickup instructions.
                    </div>
                    <div style="background:#ede9fe;color:#5b21b6;font-size:.75rem;font-weight:700;
                                padding:.3rem .6rem;border-radius:6px;display:inline-block;margin-bottom:.3rem">
                        ₹${instantFee}
                    </div>
                    <div style="font-size:.68rem;color:#9ca3af;margin-bottom:.3rem">(₹10 + 10% of ₹${rentalTotal.toFixed(2)})</div>
                    <div style="font-size:.72rem;color:#9ca3af"><i class="fas fa-bolt"></i> All details revealed instantly</div>
                    <button onclick="event.stopPropagation();chooseInstantCheckout()" style="
                        width:100%;margin-top:1rem;padding:.65rem;
                        background:linear-gradient(135deg,#7c3aed,#2563eb);
                        color:white;border:none;border-radius:10px;font-weight:700;
                        font-size:.875rem;cursor:pointer;
                        box-shadow:0 4px 14px rgba(124,58,237,.35);transition:opacity .15s;
                    " onmouseover="this.style.opacity='.88'" onmouseout="this.style.opacity='1'">
                        <i class="fas fa-lock-open"></i> Pay ₹${instantFee} & Unlock All
                    </button>
                </div>
            </div>

            <div style="padding:0 2rem 1.25rem;font-size:.72rem;color:#9ca3af;text-align:center">
                <i class="fas fa-shield-alt"></i> Instant payments secured by Razorpay &nbsp;·&nbsp; All activity logged for your protection
            </div>
        </div>
        <style>@keyframes slideUp{from{transform:translateY(24px);opacity:0}to{transform:translateY(0);opacity:1}}</style>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// ── Pathway 1: Standard Request ───────────────────────────────────
async function chooseStandardCheckout() {
    document.getElementById('checkoutModal')?.remove();

    const username = localStorage.getItem('username');
    const token    = localStorage.getItem('authToken') || localStorage.getItem('token');
    const reqKey   = `requests_${username}`;
    const reqList  = JSON.parse(localStorage.getItem(reqKey) || '[]');
    let   sent     = 0;

    for (const item of cartItems) {
        const entry = {
            id:          `req_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
            itemId:      item.id || item._id,
            itemName:    item.name,
            itemImage:   (item.images && item.images[0]) || item.image || '',
            itemOwner:   item.owner,
            fromDate:    item.fromDate,
            toDate:      item.toDate,
            duration:    item.rentalDays,
            totalPrice:  calcItemRental(item) > 0 ? `₹${calcItemRental(item).toFixed(2)}` : 'Free',
            status:      'pending',
            type:        'standard',
            createdAt:   new Date().toISOString()
        };

        reqList.push(entry);

        if (token) {
            try {
                await fetch(`${CART_API}/requests`, {
                    method:  'POST',
                    headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${token}` },
                    body:    JSON.stringify(entry)
                });
            } catch(e) { console.warn('Backend request failed:', e.message); }
        }
        sent++;
    }

    localStorage.setItem(reqKey, JSON.stringify(reqList));
    showCartSuccess('standard', sent);
}

// ── Pathway 2: Instant Payment ────────────────────────────────────
function chooseInstantCheckout() {
    document.getElementById('checkoutModal')?.remove();

    const rentalTotal = calcRentalTotal();
    const instantFee  = parseFloat((10 + rentalTotal * 0.10).toFixed(2));

    // Store cart state for post-payment recording
    localStorage.setItem('pendingCartBorrow', JSON.stringify({
        items:      cartItems,
        instantFee,
        rentalTotal
    }));

    if (typeof Razorpay === 'undefined') {
        showDemoPayModal(instantFee);
        return;
    }

    processInstantCartPayment(instantFee);
}

async function processInstantCartPayment(fee) {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    try {
        const orderRes  = await fetch(`${CART_API}/payments/create-order`, {
            method:  'POST',
            headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${token}` },
            body:    JSON.stringify({ amount: fee, description: `Instant unlock: ${cartItems.length} items` })
        });
        const orderData = await orderRes.json();
        if (!orderData.success) throw new Error(orderData.message);

        const rzp = new Razorpay({
            key:         orderData.keyId,
            amount:      orderData.amount,
            currency:    'INR',
            order_id:    orderData.orderId,
            name:        'BorrowBuddy — Cart Instant Access',
            description: `Unlock ${cartItems.length} item${cartItems.length!==1?'s':''}`,
            theme:       { color: '#7c3aed' },
            prefill: {
                name:  localStorage.getItem('username') || '',
                email: localStorage.getItem('email')    || ''
            },
            handler: async (response) => {
                try {
                    const verify = await fetch(`${CART_API}/payments/verify`, {
                        method:  'POST',
                        headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${token}` },
                        body:    JSON.stringify({
                            razorpay_order_id:   response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature:  response.razorpay_signature
                        })
                    });
                    const vData = await verify.json();
                    if (vData.success) {
                        recordCartBorrows(response.razorpay_payment_id);
                        showCartSuccess('instant', cartItems.length);
                    } else {
                        alert('Payment verification failed. ID: ' + response.razorpay_payment_id);
                    }
                } catch(e) { alert('Verification error. Please contact support.'); }
            },
            modal: { ondismiss: () => {} }
        });
        rzp.on('payment.failed', r => alert('Payment failed: ' + r.error.description));
        rzp.open();
    } catch(e) {
        console.error(e);
        showDemoPayModal(fee);
    }
}

function showDemoPayModal(fee) {
    const modal = document.createElement('div');
    modal.id    = 'demoPayModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;padding:1rem';
    modal.innerHTML = `
        <div style="background:white;border-radius:20px;padding:2rem;max-width:380px;width:100%;text-align:center;box-shadow:0 25px 60px rgba(0,0,0,.4)">
            <div style="font-size:2.5rem;margin-bottom:.5rem">🧪</div>
            <h2 style="color:#1f2937;margin-bottom:.25rem">Test Payment</h2>
            <p style="color:#6b7280;font-size:.875rem;margin-bottom:1.25rem">
                Razorpay not configured. Simulate instant payment of <strong>₹${fee}</strong> for
                <strong>${cartItems.length} item${cartItems.length!==1?'s':''}</strong>.
            </p>
            <div style="background:#faf5ff;border-radius:10px;padding:.875rem;margin-bottom:1.25rem;font-size:.8rem;color:#5b21b6;text-align:left;line-height:1.8">
                ${cartItems.map(i=>`<div>📦 ${esc(i.name)} — ${i.owner}</div>`).join('')}
            </div>
            <div style="display:flex;gap:.75rem">
                <button onclick="document.getElementById('demoPayModal').remove()" style="flex:1;padding:.7rem;background:#f3f4f6;border:none;border-radius:10px;cursor:pointer;font-weight:600">Cancel</button>
                <button onclick="document.getElementById('demoPayModal').remove();simulateCartPayment(${fee})"
                    style="flex:2;padding:.7rem;background:linear-gradient(135deg,#7c3aed,#2563eb);color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer">
                    ✓ Simulate & Unlock All
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function simulateCartPayment(fee) {
    recordCartBorrows('demo-cart-' + Date.now());
    showCartSuccess('instant', cartItems.length);
}

// ── Record all borrows ────────────────────────────────────────────
function recordCartBorrows(paymentId) {
    const username = localStorage.getItem('username') || '';
    const pending  = JSON.parse(localStorage.getItem('pendingCartBorrow') || '{}');
    const items    = pending.items || cartItems;

    const borrowedKey  = `borrowed_${username}`;
    const borrowedList = JSON.parse(localStorage.getItem(borrowedKey) || '[]');

    items.forEach((item, idx) => {
        const owner    = item.owner || '';
        const itemId   = item.id || item._id || `cart_${idx}`;
        const pid      = `${paymentId}_${idx}`;
        const image    = (item.images && item.images[0]) || item.image || '';
        const rental   = calcItemRental(item);

        // Borrower record
        if (!borrowedList.some(b => b.paymentId === pid)) {
            borrowedList.push({
                id:          itemId,
                itemName:    item.name,
                itemImage:   image,
                owner,
                status:      'active',
                borrowFrom:  item.fromDate,
                borrowTo:    item.toDate,
                totalPaid:   rental > 0 ? `₹${rental.toFixed(2)}` : 'Free',
                paymentId:   pid,
                rentalDays:  item.rentalDays || 1
            });
        }

        // Owner lent record
        if (owner && owner !== username) {
            const lentKey  = `lent_${owner}`;
            const lentList = JSON.parse(localStorage.getItem(lentKey) || '[]');
            if (!lentList.some(l => l.paymentId === pid)) {
                lentList.push({
                    id:          itemId,
                    itemName:    item.name,
                    itemImage:   image,
                    borrower:    username,
                    status:      'active',
                    borrowFrom:  item.fromDate,
                    borrowTo:    item.toDate,
                    totalEarned: rental > 0 ? `₹${rental.toFixed(2)}` : 'Free',
                    paymentId:   pid,
                    rentalDays:  item.rentalDays || 1
                });
                localStorage.setItem(lentKey, JSON.stringify(lentList));
            }
        }
    });

    localStorage.setItem(borrowedKey, JSON.stringify(borrowedList));
    localStorage.removeItem('pendingCartBorrow');

    // Clear cart after successful checkout
    cartItems = [];
    saveCart();
    updateBadge();
}

// ── Success screen ────────────────────────────────────────────────
function showCartSuccess(type, count) {
    // Remove any existing modals
    document.getElementById('checkoutModal')?.remove();
    document.getElementById('demoPayModal')?.remove();

    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.75);display:flex;align-items:center;justify-content:center;padding:1rem';

    const isInstant = type === 'instant';

    modal.innerHTML = `
        <div style="background:white;border-radius:22px;padding:2.5rem;max-width:440px;width:100%;text-align:center;box-shadow:0 40px 100px rgba(0,0,0,.35)">
            <div style="font-size:3.5rem;margin-bottom:.75rem">${isInstant ? '⚡' : '📬'}</div>
            <h2 style="margin:0 0 .5rem;color:#1f2937">${isInstant ? 'All Items Unlocked!' : 'Requests Sent!'}</h2>
            <p style="color:#6b7280;margin:0 0 1.5rem;line-height:1.65;font-size:.9rem">
                ${isInstant
                    ? `Successfully unlocked <strong>${count} item${count!==1?'s':''}</strong>. You can now contact all owners directly.`
                    : `Sent <strong>${count}</strong> borrow request${count!==1?'s':''}. You'll receive contact details once each owner accepts.`
                }
            </p>

            ${isInstant ? `
            <div style="background:#f0fdf4;border-radius:12px;padding:1rem;margin-bottom:1.5rem;text-align:left;font-size:.82rem;color:#15803d;line-height:1.8">
                <div style="font-weight:700;margin-bottom:.5rem">✅ What you can do now:</div>
                <div>📞 Call owners directly using their phone numbers</div>
                <div>📍 Get pickup location details from item pages</div>
                <div>💬 Message owners through the chat system</div>
            </div>` : `
            <div style="background:#eff6ff;border-radius:12px;padding:1rem;margin-bottom:1.5rem;text-align:left;font-size:.82rem;color:#1d4ed8;line-height:1.8">
                <div style="font-weight:700;margin-bottom:.5rem">📋 What happens next:</div>
                <div>1. Owners get notified of your requests</div>
                <div>2. They log in and accept or decline</div>
                <div>3. You receive contact details on acceptance</div>
            </div>`}

            <div style="display:flex;gap:.75rem">
                <button onclick="window.location.href='browse.html'"
                    style="flex:1;padding:.75rem;background:#f3f4f6;border:none;border-radius:12px;cursor:pointer;font-weight:600">
                    Browse More
                </button>
                <button onclick="window.location.href='${isInstant?'my-borrowed.html':'requests.html'}'"
                    style="flex:2;padding:.75rem;background:${isInstant?'linear-gradient(135deg,#7c3aed,#2563eb)':'#2563eb'};color:white;border:none;border-radius:12px;cursor:pointer;font-weight:700">
                    ${isInstant ? 'View Borrowed Items' : 'View My Requests'}
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Refresh cart display
    renderCart();
    renderSummary();
}

// ── Helpers ───────────────────────────────────────────────────────
function calcItemRental(item) {
    const price = parseFloat((item.price||'0').toString().replace(/[^\d.]/g,'')) || 0;
    return price * (item.rentalDays || 1);
}

function calcRentalTotal() {
    return cartItems.reduce((sum, item) => sum + calcItemRental(item), 0);
}

function esc(s) {
    return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Expose for inline HTML
window.removeItem          = removeItem;
window.updateDates         = updateDates;
window.showCheckoutModal   = showCheckoutModal;
window.chooseStandardCheckout = chooseStandardCheckout;
window.chooseInstantCheckout  = chooseInstantCheckout;
window.simulateCartPayment    = simulateCartPayment;
