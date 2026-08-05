/**
 * BorrowBuddy — Notifications System
 * ─────────────────────────────────────────────────────────────────
 * Works across all pages via localStorage.
 * Bell icon auto-injects into navbar.
 * Polls every 5s for new requests/approvals.
 */

const NOTIF_KEY = () => `notifications_${localStorage.getItem('username') || ''}`;
const NOTIF_API  = self.BORROWBUDDY_CONFIG.API_BASE_URL + '/api';

// ── Notification types ─────────────────────────────────────────────
const NOTIF_ICONS = {
    request_received: { icon: 'fa-inbox',          color: '#3b82f6', label: 'Borrow Request'  },
    request_approved: { icon: 'fa-check-circle',   color: '#10b981', label: 'Request Approved' },
    request_rejected: { icon: 'fa-times-circle',   color: '#ef4444', label: 'Request Declined' },
    return_requested: { icon: 'fa-undo',           color: '#f59e0b', label: 'Return Requested' },
    return_confirmed: { icon: 'fa-check-double',   color: '#10b981', label: 'Return Confirmed' },
    message_received: { icon: 'fa-comment-dots',   color: '#8b5cf6', label: 'New Message'      },
    deposit_refunded: { icon: 'fa-shield-alt',     color: '#10b981', label: 'Deposit Refunded' },
    item_overdue:     { icon: 'fa-exclamation-circle', color: '#ef4444', label: 'Item Overdue' },
};

// ── Core notification store ────────────────────────────────────────
function getNotifications() {
    return JSON.parse(localStorage.getItem(NOTIF_KEY()) || '[]');
}

function saveNotifications(notifs) {
    localStorage.setItem(NOTIF_KEY(), JSON.stringify(notifs));
}

function addNotification({ type, title, body, link = '', itemId = '', meta = {} }) {
    const notifs = getNotifications();
    const notif  = {
        id:        `notif_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
        type, title, body, link, itemId, meta,
        read:      false,
        createdAt: new Date().toISOString()
    };
    notifs.unshift(notif);
    // Keep max 100 notifications
    if (notifs.length > 100) notifs.splice(100);
    saveNotifications(notifs);
    updateBellBadge();
    showToast(notif);
    return notif;
}

function markAllRead() {
    const notifs = getNotifications().map(n => ({ ...n, read: true }));
    saveNotifications(notifs);
    updateBellBadge();
}

function markRead(id) {
    const notifs = getNotifications().map(n => n.id === id ? { ...n, read: true } : n);
    saveNotifications(notifs);
    updateBellBadge();
}

function clearAll() {
    saveNotifications([]);
    updateBellBadge();
}

function getUnreadCount() {
    return getNotifications().filter(n => !n.read).length;
}

// ── Bell badge ─────────────────────────────────────────────────────
function updateBellBadge() {
    const count  = getUnreadCount();
    const badge  = document.getElementById('notifBadge');
    if (!badge) return;
    badge.textContent   = count > 99 ? '99+' : count;
    badge.style.display = count > 0 ? 'flex' : 'none';
}

// ── Toast notification ─────────────────────────────────────────────
let toastQueue = [], toastShowing = false;

function showToast(notif) {
    toastQueue.push(notif);
    if (!toastShowing) processToastQueue();
}

function processToastQueue() {
    if (!toastQueue.length) { toastShowing = false; return; }
    toastShowing = true;
    const notif = toastQueue.shift();
    const meta  = NOTIF_ICONS[notif.type] || NOTIF_ICONS.request_received;

    const toast = document.createElement('div');
    toast.id    = 'notifToast_' + notif.id;
    toast.style.cssText = `
        position:fixed;bottom:1.5rem;right:1.5rem;z-index:99999;
        background:white;border:1px solid #e5e7eb;border-radius:16px;
        padding:1rem 1.25rem;min-width:300px;max-width:360px;
        box-shadow:0 12px 40px rgba(0,0,0,.15);
        display:flex;align-items:flex-start;gap:.875rem;cursor:pointer;
        animation:notifSlideIn .35s cubic-bezier(.34,1.56,.64,1);
        border-left:4px solid ${meta.color};
    `;
    toast.innerHTML = `
        <div style="width:36px;height:36px;border-radius:50%;flex-shrink:0;
                    background:${meta.color}1a;display:flex;align-items:center;justify-content:center">
            <i class="fas ${meta.icon}" style="color:${meta.color};font-size:.95rem"></i>
        </div>
        <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:.875rem;color:#1f2937;margin-bottom:.15rem">${notif.title}</div>
            <div style="font-size:.8rem;color:#6b7280;line-height:1.4">${notif.body}</div>
        </div>
        <button id="closeToast_${notif.id}" style="background:none;border:none;color:#9ca3af;cursor:pointer;font-size:1rem;padding:0;flex-shrink:0;line-height:1">✕</button>
        <style>
            @keyframes notifSlideIn  { from { transform:translateX(120%);opacity:0 } to { transform:translateX(0);opacity:1 } }
            @keyframes notifSlideOut { from { transform:translateX(0);opacity:1 } to { transform:translateX(120%);opacity:0 } }
        </style>
    `;

    const dismiss = () => {
        toast.style.animation = 'notifSlideOut .3s ease forwards';
        setTimeout(() => { toast.remove(); setTimeout(processToastQueue, 300); }, 300);
    };

    toast.addEventListener('click', e => {
        if (e.target.id === `closeToast_${notif.id}`) { dismiss(); return; }
        markRead(notif.id);
        if (notif.link) window.location.href = notif.link;
        dismiss();
    });

    document.getElementById(`closeToast_${notif.id}`)?.addEventListener('click', dismiss);
    document.body.appendChild(toast);
    setTimeout(dismiss, 6000);
}

// ── Bell icon + dropdown injector ────────────────────────────────
function injectBellIcon() {
    // Already injected
    if (document.getElementById('notifBell')) return;

    // Try multiple nav selectors used across different pages
    const navMenu = document.querySelector('#navMenu, .nav-menu, .navbar .nav-container > div:last-child');
    if (!navMenu) {
        // Retry after a short delay (some pages render nav late)
        setTimeout(injectBellIcon, 300);
        return;
    }

    // Build bell container
    const bellWrap = document.createElement('div');
    bellWrap.id    = 'notifBell';
    bellWrap.style.cssText = `
        position:relative;display:flex;align-items:center;cursor:pointer;
        padding:.4rem .6rem;border-radius:10px;transition:background .15s;
        margin:0 .25rem;
    `;
    bellWrap.title = 'Notifications';
    bellWrap.innerHTML = `
        <i class="fas fa-bell" style="font-size:1.1rem;color:#6b7280"></i>
        <span id="notifBadge" style="
            display:none;position:absolute;top:-4px;right:-4px;
            background:#ef4444;color:white;border-radius:50%;
            min-width:18px;height:18px;font-size:.68rem;font-weight:700;
            align-items:center;justify-content:center;padding:0 4px;
            border:2px solid white;
        ">0</span>
    `;

    // Build dropdown panel
    const dropdown = document.createElement('div');
    dropdown.id    = 'notifDropdown';
    dropdown.style.cssText = `
        display:none;position:absolute;top:calc(100% + 10px);right:0;
        width:360px;max-height:480px;background:white;
        border:1px solid #e5e7eb;border-radius:16px;
        box-shadow:0 12px 40px rgba(0,0,0,.15);z-index:9999;overflow:hidden;
        flex-direction:column;
    `;
    dropdown.innerHTML = `
        <div style="padding:.875rem 1.25rem;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
            <div style="font-weight:700;font-size:.95rem;color:#1f2937">
                <i class="fas fa-bell" style="color:#6366f1;margin-right:.4rem"></i> Notifications
                <span id="notifUnreadLabel" style="font-size:.75rem;color:#6b7280;font-weight:400;margin-left:.35rem"></span>
            </div>
            <div style="display:flex;gap:.5rem">
                <button id="notifMarkAllRead" style="font-size:.75rem;color:#2563eb;background:none;border:none;cursor:pointer;font-weight:600">Mark all read</button>
                <button id="notifClearAll"    style="font-size:.75rem;color:#ef4444;background:none;border:none;cursor:pointer;font-weight:600">Clear</button>
            </div>
        </div>
        <div id="notifList" style="overflow-y:auto;flex:1;max-height:380px"></div>
        <div style="padding:.75rem 1.25rem;border-top:1px solid #e5e7eb;text-align:center;flex-shrink:0">
            <span style="font-size:.8rem;color:#6366f1;font-weight:600;cursor:pointer" onclick="document.getElementById('notifDropdown').style.display='none'">Close ✕</span>
        </div>
    `;

    bellWrap.appendChild(dropdown);

    // Insert before Logout — try multiple selectors
    const logoutLink = navMenu.querySelector('a[onclick*="logout"], a[href*="logout"], a:last-child');
    if (logoutLink) {
        navMenu.insertBefore(bellWrap, logoutLink);
    } else {
        navMenu.appendChild(bellWrap);
    }

    // Style hover
    bellWrap.addEventListener('mouseenter', () => bellWrap.style.background = '#f3f4f6');
    bellWrap.addEventListener('mouseleave', () => bellWrap.style.background = 'transparent');

    // Toggle dropdown
    bellWrap.addEventListener('click', e => {
        e.stopPropagation();
        const isOpen = dropdown.style.display === 'flex';
        dropdown.style.display = isOpen ? 'none' : 'flex';
        if (!isOpen) renderDropdownList();
    });
    document.addEventListener('click', e => {
        if (!bellWrap.contains(e.target)) dropdown.style.display = 'none';
    });

    document.getElementById('notifMarkAllRead')?.addEventListener('click', e => {
        e.stopPropagation();
        markAllRead();
        renderDropdownList();
    });
    document.getElementById('notifClearAll')?.addEventListener('click', e => {
        e.stopPropagation();
        if (confirm('Clear all notifications?')) { clearAll(); renderDropdownList(); }
    });

    updateBellBadge();
}

function renderDropdownList() {
    const list   = document.getElementById('notifList');
    const label  = document.getElementById('notifUnreadLabel');
    if (!list) return;

    const notifs = getNotifications();
    const unread = notifs.filter(n => !n.read).length;
    if (label) label.textContent = unread > 0 ? `${unread} unread` : '';
    updateBellBadge();

    if (!notifs.length) {
        list.innerHTML = `
            <div style="text-align:center;padding:3rem 1rem;color:#9ca3af">
                <i class="fas fa-bell-slash" style="font-size:2.5rem;opacity:.3;display:block;margin-bottom:.75rem"></i>
                <p style="font-size:.875rem">No notifications yet</p>
            </div>`;
        return;
    }

    list.innerHTML = notifs.slice(0, 20).map(n => {
        const meta = NOTIF_ICONS[n.type] || NOTIF_ICONS.request_received;
        const time = relTime(n.createdAt);
        return `
        <div class="notif-item" data-id="${n.id}" data-link="${n.link||''}" style="
            display:flex;align-items:flex-start;gap:.75rem;padding:.875rem 1.25rem;
            background:${n.read ? 'white' : '#f8faff'};
            border-bottom:1px solid #f3f4f6;cursor:pointer;transition:background .15s;
            border-left:3px solid ${n.read ? 'transparent' : meta.color};
        " onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='${n.read ? 'white' : '#f8faff'}'">
            <div style="width:34px;height:34px;border-radius:50%;flex-shrink:0;
                        background:${meta.color}1a;display:flex;align-items:center;justify-content:center">
                <i class="fas ${meta.icon}" style="color:${meta.color};font-size:.85rem"></i>
            </div>
            <div style="flex:1;min-width:0">
                <div style="font-weight:${n.read ? '600' : '700'};font-size:.83rem;color:#1f2937;margin-bottom:.15rem">${n.title}</div>
                <div style="font-size:.77rem;color:#6b7280;line-height:1.4;margin-bottom:.25rem">${n.body}</div>
                <div style="font-size:.7rem;color:#9ca3af">${time}</div>
            </div>
            ${!n.read ? `<div style="width:8px;height:8px;background:${meta.color};border-radius:50%;flex-shrink:0;margin-top:4px"></div>` : ''}
        </div>`;
    }).join('');

    list.querySelectorAll('.notif-item').forEach(el => {
        el.addEventListener('click', () => {
            markRead(el.dataset.id);
            if (el.dataset.link) window.location.href = el.dataset.link;
            renderDropdownList();
        });
    });
}

function relTime(iso) {
    if (!iso) return '';
    const ms   = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(ms / 60000);
    const hrs  = Math.floor(ms / 3600000);
    const days = Math.floor(ms / 86400000);
    if (mins  <  1) return 'Just now';
    if (mins  < 60) return `${mins}m ago`;
    if (hrs   < 24) return `${hrs}h ago`;
    if (days  <  7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString('en-IN', { day:'numeric', month:'short' });
}

// ── Polling — check for new requests/approvals ────────────────────
let _lastRequestSnapshot = null;
let _lastBorrowedSnapshot = null;

function pollNotifications() {
    const username = localStorage.getItem('username');
    if (!username) return;

    checkIncomingRequests(username);
    checkBorrowedApprovals(username);
    checkOverdueItems(username);
    checkPendingReturns(username);
    checkDepositRefunds(username);
}

function checkIncomingRequests(username) {
    // Scan all requests_* keys for requests targeting my items
    const myItems   = JSON.parse(localStorage.getItem(`items_${username}`) || '[]');
    const myItemIds = new Set(myItems.map(i => i.id || i._id));
    const existing  = getNotifications().map(n => n.meta?.requestId).filter(Boolean);
    const seen      = new Set(existing);

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith('requests_') || key === `requests_${username}`) continue;
        try {
            const reqs = JSON.parse(localStorage.getItem(key) || '[]');
            reqs.forEach(r => {
                const rid = r.id || r._id;
                if (
                    r.status === 'pending' &&
                    (myItemIds.has(r.itemId) || r.itemOwner === username) &&
                    !seen.has(rid)
                ) {
                    seen.add(rid);
                    addNotification({
                        type:  'request_received',
                        title: 'New Borrow Request',
                        body:  `${r.requestedBy || 'Someone'} wants to borrow "${r.itemName || 'your item'}" from ${fmtDate(r.fromDate)} to ${fmtDate(r.toDate)}`,
                        link:  'requests.html',
                        itemId: r.itemId,
                        meta:  { requestId: rid }
                    });
                }
            });
        } catch(e) {}
    }
}

function checkBorrowedApprovals(username) {
    const borrowed = JSON.parse(localStorage.getItem(`borrowed_${username}`) || '[]');
    const existing  = getNotifications().map(n => n.meta?.approvalId).filter(Boolean);
    const seen      = new Set(existing);

    borrowed.forEach(b => {
        const aid = `approved_${b.requestId || b.paymentId || b.id}`;
        if (b.status === 'active' && !seen.has(aid)) {
            seen.add(aid);
            addNotification({
                type:  'request_approved',
                title: 'Request Approved! 🎉',
                body:  `Your request to borrow "${b.itemName}" was approved! Contact the owner to arrange pickup.`,
                link:  `item-details.html?id=${b.id}`,
                itemId: b.id,
                meta:  { approvalId: aid }
            });
        }
    });
}

function checkOverdueItems(username) {
    const borrowed = JSON.parse(localStorage.getItem(`borrowed_${username}`) || '[]');
    const existing  = getNotifications().map(n => n.meta?.overdueId).filter(Boolean);
    const seen      = new Set(existing);

    borrowed.filter(b => b.status === 'active').forEach(b => {
        if (!b.borrowTo) return;
        const days = Math.ceil((new Date(b.borrowTo) - new Date()) / 86400000);
        const oid  = `overdue_${b.id || b.requestId}`;
        if (days < 0 && !seen.has(oid)) {
            seen.add(oid);
            addNotification({
                type:  'item_overdue',
                title: 'Item Overdue!',
                body:  `"${b.itemName}" was due on ${fmtDate(b.borrowTo)}. Please return it as soon as possible.`,
                link:  'my-borrowed.html',
                itemId: b.id,
                meta:  { overdueId: oid }
            });
        }
    });
}

function checkPendingReturns(username) {
    const lent     = JSON.parse(localStorage.getItem(`lent_${username}`) || '[]');
    const existing = getNotifications().map(n => n.meta?.returnId).filter(Boolean);
    const seen     = new Set(existing);

    lent.filter(l => l.status === 'pending_return').forEach(l => {
        const rid = `return_${l.transactionId || l.requestId || l.id}`;
        if (!seen.has(rid)) {
            seen.add(rid);
            addNotification({
                type:  'return_requested',
                title: 'Item Return Requested',
                body:  `${l.borrower} has marked "${l.itemName}" as returned. Please confirm to release their deposit.`,
                link:  'my-lent.html',
                itemId: l.id,
                meta:  { returnId: rid }
            });
        }
    });
}

function checkDepositRefunds(username) {
    const borrowed = JSON.parse(localStorage.getItem(`borrowed_${username}`) || '[]');
    const existing = getNotifications().map(n => n.meta?.refundId).filter(Boolean);
    const seen     = new Set(existing);

    borrowed.filter(b => b.depositRefunded && !b.refundNotified).forEach(b => {
        const rfid = `refund_${b.transactionId || b.requestId || b.id}`;
        if (!seen.has(rfid)) {
            seen.add(rfid);
            addNotification({
                type:  'deposit_refunded',
                title: 'Security Deposit Refunded! 🎉',
                body:  `Your ₹${parseFloat(b.securityDeposit||0).toFixed(2)} deposit for "${b.itemName}" has been released.`,
                link:  'my-borrowed.html',
                itemId: b.id,
                meta:  { refundId: rfid }
            });
            // Mark so we don't notify again
            b.refundNotified = true;
        }
    });
    localStorage.setItem(`borrowed_${username}`, JSON.stringify(borrowed));
}

function fmtDate(d) {
    if (!d) return '—';
    const dt = new Date(d);
    return isNaN(dt) ? d : dt.toLocaleDateString('en-IN', { day:'numeric', month:'short' });
}

// ── Init on every page ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const username = localStorage.getItem('username');
    if (!username) return;

    // Try immediately, then retry after 500ms and 1s in case navbar loads late
    injectBellIcon();
    setTimeout(injectBellIcon, 500);
    setTimeout(injectBellIcon, 1000);

    updateBellBadge();
    pollNotifications();

    // Poll every 5 seconds
    setInterval(pollNotifications, 5000);
});

// ── Public API ────────────────────────────────────────────────────
window.BorrowBuddyNotifications = {
    add:          addNotification,
    markRead,
    markAllRead,
    clearAll,
    getUnreadCount,
    getNotifications,
    TYPES:        Object.keys(NOTIF_ICONS)
};