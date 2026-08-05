// BorrowBuddy — Borrow Request (two-pathway flow + availability calendar)
const API = self.BORROWBUDDY_CONFIG.API_BASE_URL;
let currentItem   = null;
let selectedDates = { from: null, to: null, days: 0, total: 0 };
let calendarInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    const username = localStorage.getItem('username');
    if (!username) { window.location.href = 'login.html'; return; }

    loadItemDetails();
    document.getElementById('borrowRequestForm')?.addEventListener('submit', handleSubmit);
});

// ── Load item ─────────────────────────────────────────────────────
function loadItemDetails() {
    const raw = localStorage.getItem('currentItem');
    if (!raw) { alert('Item not found'); window.location.href = 'browse.html'; return; }
    currentItem = JSON.parse(raw);
    displayItemPreview(currentItem);
    initCalendar(currentItem);
}

function displayItemPreview(item) {
    const img = (item.images && item.images[0]) || item.image || 'https://via.placeholder.com/120';
    const el  = document.getElementById('itemPreview');
    if (!el) return;
    el.innerHTML = `
        <img src="${img}" alt="${item.name}"
             style="width:100px;height:100px;object-fit:cover;border-radius:10px;flex-shrink:0">
        <div class="item-preview-info">
            <h3 style="margin:0 0 0.25rem">${item.name}</h3>
            <p style="margin:0 0 0.25rem;color:#6b7280;font-size:0.9rem">
                ${(item.description || '').substring(0, 100)}${(item.description || '').length > 100 ? '…' : ''}
            </p>
            <p style="margin:0 0 0.15rem"><strong>Owner:</strong> ${item.owner}</p>
            <p style="margin:0 0 0.15rem"><strong>Price:</strong> ${item.price || 'Free'}/day</p>
            <p style="margin:0"><strong>Location:</strong> ${item.locationPrimary || item.location || 'Not specified'}</p>
        </div>
    `;
}

// ── Availability calendar init ────────────────────────────────────
function initCalendar(item) {
    const itemId = item.id || item._id;
    const container = document.getElementById('availabilityCalendarContainer');
    if (!container || typeof renderAvailabilityCalendar !== 'function') return;

    calendarInstance = renderAvailabilityCalendar(itemId, 'availabilityCalendarContainer', (from, to) => {
        const days     = calcDays(from, to);
        const totalRaw = calcTotalRaw(days);
        selectedDates  = { from, to, days, total: totalRaw };
        updateSummaryDisplay();
    });
}

function updateSummaryDisplay() {
    const display = document.getElementById('durationDisplay');
    if (!display) return;
    if (!selectedDates.from || !selectedDates.to) {
        display.textContent = 'Select dates on the calendar above';
        display.style.color = '#6b7280';
        return;
    }
    const totalLabel = selectedDates.total > 0 ? `₹${selectedDates.total.toFixed(2)}` : 'Free';
    display.innerHTML = `
        <span style="color:#2563eb"><i class="fas fa-clock"></i> ${selectedDates.days} day${selectedDates.days !== 1 ? 's' : ''}</span>
        &nbsp;·&nbsp;
        <span style="color:#10b981"><i class="fas fa-rupee-sign"></i> Total: ${totalLabel}</span>
    `;
}

function calcDays(from, to) {
    return Math.max(1, Math.ceil((new Date(to) - new Date(from)) / 86400000) + 1);
}

function calcTotalRaw(days) {
    if (!currentItem) return 0;
    const match = (currentItem.price || '').toString().match(/[\d.]+/);
    return match ? parseFloat(match[0]) * days : 0;
}

// ── Instant fee = ₹10 + 10% of rental total ──────────────────────
function calcInstantFee(totalRental) {
    return (10 + totalRental * 0.10).toFixed(2);
}

// ── Form submit → validate → show pathway chooser ─────────────────
function handleSubmit(e) {
    e.preventDefault();

    if (!selectedDates.from || !selectedDates.to) {
        alert('Please select your borrow dates on the calendar above.');
        return;
    }

    // ── Server-side-style validation against blocked ranges ────────
    const itemId = currentItem.id || currentItem._id;
    if (typeof validateDateRange === 'function') {
        const check = validateDateRange(itemId, selectedDates.from, selectedDates.to);
        if (!check.valid) {
            alert(check.message);
            return;
        }
    }

    showPathwayModal();
}

// ── Pathway chooser modal ─────────────────────────────────────────
async function showPathwayModal() {
    const instantFee  = calcInstantFee(selectedDates.total);
    const rentalLabel = selectedDates.total > 0 ? `₹${selectedDates.total.toFixed(2)}` : 'Free';
    const daysLabel   = `${selectedDates.days} day${selectedDates.days !== 1 ? 's' : ''}`;
    const POINTS_COST_PER_UNLOCK = 100;

    // Fetch user's points balance
    let userPoints = 0;
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (token) {
        try {
            const res  = await fetch(`${API}/api/auth/referral-stats`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (data.success) userPoints = data.creditsBalance || 0;
        } catch (e) { console.warn('Could not fetch points balance:', e.message); }
    }
    const canUsePoints = userPoints >= POINTS_COST_PER_UNLOCK;

    const modal = document.createElement('div');
    modal.id    = 'pathwayModal';
    modal.style.cssText = `
        position:fixed;inset:0;z-index:99999;
        background:rgba(15,23,42,0.7);backdrop-filter:blur(4px);
        display:flex;align-items:center;justify-content:center;padding:1rem;
    `;
    modal.innerHTML = `
        <div style="
            background:#fff;border-radius:20px;width:100%;max-width:560px;
            box-shadow:0 32px 80px rgba(0,0,0,0.3);overflow:hidden;
        ">
            <div style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:1.5rem 2rem;color:white">
                <div style="display:flex;align-items:center;justify-content:space-between">
                    <div>
                        <div style="font-size:0.78rem;opacity:0.8;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:0.3rem">
                            Choose how to borrow
                        </div>
                        <div style="font-size:1.2rem;font-weight:700">${currentItem.name}</div>
                    </div>
                    <button onclick="document.getElementById('pathwayModal').remove()"
                        style="background:rgba(255,255,255,0.15);border:none;color:white;
                               width:32px;height:32px;border-radius:50%;cursor:pointer;
                               font-size:1.1rem;display:flex;align-items:center;justify-content:center">
                        ✕
                    </button>
                </div>
                <div style="display:flex;gap:1.5rem;margin-top:1rem;font-size:0.85rem;opacity:0.85">
                    <span><i class="fas fa-calendar-alt"></i> ${selectedDates.from} → ${selectedDates.to}</span>
                    <span><i class="fas fa-clock"></i> ${daysLabel}</span>
                    <span><i class="fas fa-rupee-sign"></i> ${rentalLabel}</span>
                </div>
            </div>

            <div style="padding:1.5rem 2rem;display:grid;grid-template-columns:1fr 1fr;gap:1rem">
                <div style="
                    border:2px solid #e5e7eb;border-radius:14px;padding:1.25rem;
                    cursor:pointer;transition:all 0.2s;
                " onmouseover="this.style.borderColor='#2563eb';this.style.background='#eff6ff'"
                   onmouseout="this.style.borderColor='#e5e7eb';this.style.background='#fff'"
                   onclick="chooseStandardRequest()">
                    <div style="font-size:2rem;margin-bottom:0.6rem">📬</div>
                    <div style="font-weight:700;color:#1f2937;font-size:1rem;margin-bottom:0.4rem">
                        Standard Request
                    </div>
                    <div style="font-size:0.78rem;color:#6b7280;line-height:1.5;margin-bottom:0.75rem">
                        Send a request and wait for the owner to accept. Once accepted, you'll receive their contact details and pickup instructions.
                    </div>
                    <div style="
                        background:#f0fdf4;color:#15803d;
                        font-size:0.78rem;font-weight:600;
                        padding:0.3rem 0.7rem;border-radius:6px;display:inline-block;
                        margin-bottom:0.75rem;
                    ">✓ Free</div>
                    <div style="font-size:0.75rem;color:#9ca3af">
                        <i class="fas fa-clock"></i> Requires owner to be online
                    </div>
                    <button style="
                        width:100%;margin-top:1rem;padding:0.65rem;
                        background:#2563eb;color:white;border:none;border-radius:10px;
                        font-weight:700;font-size:0.9rem;cursor:pointer;
                        transition:background 0.15s;
                    " onmouseover="this.style.background='#1d4ed8'"
                       onmouseout="this.style.background='#2563eb'"
                       onclick="event.stopPropagation();chooseStandardRequest()">
                        <i class="fas fa-paper-plane"></i> Send Request
                    </button>
                </div>

                <div style="
                    border:2px solid #7c3aed;border-radius:14px;padding:1.25rem;
                    cursor:pointer;transition:all 0.2s;background:#faf5ff;position:relative;overflow:hidden;
                " onmouseover="this.style.background='#f3e8ff'"
                   onmouseout="this.style.background='#faf5ff'"
                   onclick="chooseInstantAccess()">
                    <div style="
                        position:absolute;top:0.65rem;right:0.65rem;
                        background:linear-gradient(135deg,#7c3aed,#2563eb);
                        color:white;font-size:0.65rem;font-weight:700;
                        padding:2px 8px;border-radius:20px;letter-spacing:0.05em;
                        text-transform:uppercase;
                    ">Instant</div>

                    <div style="font-size:2rem;margin-bottom:0.6rem">⚡</div>
                    <div style="font-weight:700;color:#1f2937;font-size:1rem;margin-bottom:0.4rem">
                        Instant Access
                    </div>
                    <div style="font-size:0.78rem;color:#6b7280;line-height:1.5;margin-bottom:0.75rem">
                        Pay a small premium and instantly get the owner's phone number, full details, and pickup instructions — no waiting.
                    </div>
                    <div style="
                        background:#ede9fe;color:#5b21b6;
                        font-size:0.78rem;font-weight:600;
                        padding:0.3rem 0.7rem;border-radius:6px;display:inline-block;
                        margin-bottom:0.5rem;
                    ">
                        ₹${instantFee}
                        <span style="font-weight:400;opacity:0.7">(₹10 + 10% of rental)</span>
                    </div>
                    <div style="font-size:0.75rem;color:#9ca3af;margin-bottom:0.75rem">
                        <i class="fas fa-bolt"></i> Details revealed immediately
                    </div>
                    <button style="
                        width:100%;padding:0.65rem;
                        background:linear-gradient(135deg,#7c3aed,#2563eb);
                        color:white;border:none;border-radius:10px;
                        font-weight:700;font-size:0.9rem;cursor:pointer;
                        box-shadow:0 4px 14px rgba(124,58,237,0.35);
                        transition:opacity 0.15s;
                    " onmouseover="this.style.opacity='0.88'"
                       onmouseout="this.style.opacity='1'"
                       onclick="event.stopPropagation();chooseInstantAccess()">
                        <i class="fas fa-lock-open"></i> Pay ₹${instantFee} & Unlock
                    </button>

                    ${token ? `
                    <div style="margin-top:0.6rem;padding-top:0.6rem;border-top:1px dashed #d8b4fe">
                        <button ${canUsePoints ? '' : 'disabled'} style="
                            width:100%;padding:0.6rem;
                            background:${canUsePoints ? 'white' : '#f3f4f6'};
                            color:${canUsePoints ? '#7c3aed' : '#9ca3af'};
                            border:2px solid ${canUsePoints ? '#7c3aed' : '#e5e7eb'};
                            border-radius:10px;font-weight:700;font-size:0.85rem;
                            cursor:${canUsePoints ? 'pointer' : 'not-allowed'};
                            display:flex;align-items:center;justify-content:center;gap:0.4rem;
                        " onclick="event.stopPropagation();${canUsePoints ? 'useInstantAccessPoints()' : ''}">
                            <i class="fas fa-star"></i> Use ${POINTS_COST_PER_UNLOCK} Points Instead
                        </button>
                        <div style="font-size:0.68rem;color:#9ca3af;text-align:center;margin-top:0.4rem">
                            ${canUsePoints
                                ? `You have <strong style="color:#7c3aed">${userPoints} points</strong>`
                                : `You have ${userPoints}/${POINTS_COST_PER_UNLOCK} points — <a href="dashboard-enhanced.html" style="color:#7c3aed">invite friends to earn more</a>`
                            }
                        </div>
                    </div>` : ''}
                </div>
            </div>

            <div style="padding:0 2rem 1.25rem;font-size:0.75rem;color:#9ca3af;text-align:center">
                <i class="fas fa-shield-alt"></i> Instant payments secured by Razorpay &nbsp;·&nbsp;
                All activity is logged for your protection
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// ── Pathway 1: Standard Request ───────────────────────────────────
async function chooseStandardRequest() {
    document.getElementById('pathwayModal')?.remove();

    const token    = localStorage.getItem('authToken') || localStorage.getItem('token');
    const username = localStorage.getItem('username');

    const payload = {
        itemId:          currentItem.id || currentItem._id,
        itemName:        currentItem.name,
        itemImage:       (currentItem.images && currentItem.images[0]) || currentItem.image || '',
        itemOwner:       currentItem.owner,
        fromDate:        selectedDates.from,
        toDate:          selectedDates.to,
        duration:        selectedDates.days,
        totalPrice:      selectedDates.total > 0 ? `₹${selectedDates.total.toFixed(2)}` : 'Free',
        price:           currentItem.price || 'Free',
        securityDeposit: currentItem.securityDeposit || 0,
        requestedBy:     username,
        message:         document.getElementById('borrowMessage')?.value || ''
    };

    if (token) {
        try {
            const res  = await fetch(`${API}/api/requests`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body:    JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) { alert(data.message || 'Failed to send request'); return; }
        } catch (err) {
            console.warn('Backend request failed, saving locally:', err.message);
        }
    }

    const reqKey  = `requests_${username}`;
    const reqList = JSON.parse(localStorage.getItem(reqKey) || '[]');
    reqList.push({
        ...payload,
        id:        `req_${Date.now()}`,
        status:    'pending',
        type:      'standard',
        createdAt: new Date().toISOString()
    });
    localStorage.setItem(reqKey, JSON.stringify(reqList));

    if (window.BorrowBuddyNotifications) {
        // Notification will be picked up by the owner's own polling loop
    }

    showRequestSuccess('standard');
}

// ── Pathway 2: Instant Access (Paid) ────────────────────────────
function chooseInstantAccess() {
    document.getElementById('pathwayModal')?.remove();

    const instantFee = parseFloat(calcInstantFee(selectedDates.total));
    const itemId     = currentItem.id || currentItem._id;

    localStorage.setItem('pendingBorrow', JSON.stringify({
        itemId,
        fromDate:   selectedDates.from,
        toDate:     selectedDates.to,
        days:       selectedDates.days,
        total:      selectedDates.total,
        instantFee
    }));

    window.location.href = `item-details.html?id=${itemId}&instantPay=1&fee=${instantFee}`;
}

// ── Redeem 100 points for a free Instant Access unlock ─────────────
async function useInstantAccessPoints() {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (!token) { alert('Please log in to use points.'); return; }
    if (!confirm('Use 100 points to instantly unlock this item\'s contact details?')) return;

    const itemId = currentItem.id || currentItem._id;

    try {
        const res  = await fetch(`${API}/api/auth/redeem-points`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body:    JSON.stringify({ amount: 100, reason: 'instant_unlock', itemId })
        });
        const data = await res.json();

        if (!res.ok) { alert(data.message || 'Not enough points.'); return; }

        document.getElementById('pathwayModal')?.remove();

        localStorage.setItem('pendingBorrow', JSON.stringify({
            itemId,
            fromDate: selectedDates.from,
            toDate:   selectedDates.to,
            days:     selectedDates.days,
            total:    selectedDates.total,
            instantFee: 0,
            paidWithPoints: true
        }));

        window.location.href = `item-details.html?id=${itemId}&instantPay=1&fee=0&usedPoints=1`;
    } catch (e) {
        alert('Network error. Please try again.');
    }
}

// ── Success screens ───────────────────────────────────────────────
function showRequestSuccess(type) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,0.7);display:flex;align-items:center;justify-content:center;padding:1rem';
    modal.innerHTML = `
        <div style="background:white;border-radius:20px;padding:2.5rem;max-width:420px;width:100%;text-align:center;box-shadow:0 32px 80px rgba(0,0,0,0.3)">
            <div style="font-size:3.5rem;margin-bottom:1rem">📬</div>
            <h2 style="margin:0 0 0.5rem;color:#1f2937">Request Sent!</h2>
            <p style="color:#6b7280;margin:0 0 1.5rem;line-height:1.6">
                Your request has been sent to <strong>${currentItem.owner}</strong>.<br>
                You'll receive their contact details once they accept.
            </p>
            <div style="background:#f0fdf4;border-radius:10px;padding:1rem;margin-bottom:1.5rem;font-size:0.85rem;color:#15803d;text-align:left">
                <div style="font-weight:700;margin-bottom:0.5rem">📋 What happens next:</div>
                <div>1. Owner gets notified of your request</div>
                <div>2. They log in and accept or decline</div>
                <div>3. On accept, you see their phone & pickup details</div>
            </div>
            <div style="display:flex;gap:0.75rem">
                <button onclick="window.location.href='browse.html'" style="flex:1;padding:0.75rem;background:#f3f4f6;border:none;border-radius:10px;cursor:pointer;font-weight:600">Browse More</button>
                <button onclick="window.location.href='requests.html'" style="flex:2;padding:0.75rem;background:#2563eb;color:white;border:none;border-radius:10px;cursor:pointer;font-weight:700">View My Requests</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// ── Expose globals ────────────────────────────────────────────────
window.chooseStandardRequest = chooseStandardRequest;
window.chooseInstantAccess   = chooseInstantAccess;
window.useInstantAccessPoints = useInstantAccessPoints;