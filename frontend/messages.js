/**
 * BorrowBuddy — Messages (Enhanced)
 * ─────────────────────────────────────────────────────────────
 * Features:
 *   • Inbox with unread badge, username display, last message preview
 *   • Real-time polling (5s) with new-message toast notifications
 *   • Unread count badge on navbar across all pages
 *   • Better message bubbles with timestamps, read ticks
 *   • Content filter: phone/address blocked pre-payment
 *   • Typing indicator (optimistic UI)
 */

const API_BASE = self.BORROWBUDDY_CONFIG.API_BASE_URL + '/api';

// ─── Content filter ────────────────────────────────────────────────────────────
const PHONE_RE = [
    /\b(\+91[\-\s]?)?[6-9]\d{9}\b/,
    /\b\+?1?\s*[\(]?\d{3}[\)]?[\s\-\.]?\d{3}[\s\-\.]?\d{4}\b/,
    /\b\+?\d{1,3}[\s\-]?\(?\d{2,4}\)?[\s\-]?\d{3,4}[\s\-]?\d{3,4}\b/,
    /\b\d{5}[\s\-]\d{5}\b/,
];
const ADDRESS_RE = [
    /\b(flat|apartment|apt|house|villa|plot|sector|block|floor|building|society|colony|nagar|road|street|lane|marg|chowk|bazaar|market|near|opposite|opp\.?|behind)\b/i,
    /\b\d{1,4}[\-\/]?\s*[A-Z]?\s*(st|street|rd|road|ave|avenue|blvd|boulevard|ln|lane|dr|drive|ct|court|pl|place|way|nagar|marg)\b/i,
    /\b(pin|pincode|zip|postal)\s*[:–\-]?\s*\d{5,6}\b/i,
    /\b[1-9]\d{5}\b/,
];
function clientFilter(text) {
    const reasons = [];
    if (PHONE_RE.some(r => r.test(text)))   reasons.push('phone number');
    if (ADDRESS_RE.some(r => r.test(text))) reasons.push('physical address');
    return { clean: reasons.length === 0, reasons };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
const getToken       = () => localStorage.getItem('authToken') || localStorage.getItem('token') || '';
const authHeaders    = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` });
const currentUserId  = () => localStorage.getItem('userId') || '';
const currentUsername= () => localStorage.getItem('username') || 'Me';

// ─── API ───────────────────────────────────────────────────────────────────────
async function fetchInbox() {
    try {
        const res = await fetch(`${API_BASE}/messages/inbox`, { headers: authHeaders() });
        return res.ok ? (await res.json()).threads || [] : [];
    } catch(e) { return []; }
}

async function fetchConversation(otherUserId, itemId) {
    try {
        const url = `${API_BASE}/messages/conversation?otherUserId=${otherUserId}&itemId=${encodeURIComponent(itemId)}`;
        const res = await fetch(url, { headers: authHeaders() });
        if (!res.ok) return { messages: [], unlocked: false };
        return await res.json();
    } catch(e) { return { messages: [], unlocked: false }; }
}

async function sendMessageAPI(otherUserId, itemId, itemName, text) {
    try {
        const res = await fetch(`${API_BASE}/messages/send`, {
            method: 'POST', headers: authHeaders(),
            body: JSON.stringify({ otherUserId, itemId, itemName, text })
        });
        return await res.json();
    } catch(e) { return { success: false, message: 'Network error' }; }
}

async function markReadAPI(otherUserId, itemId) {
    try {
        await fetch(`${API_BASE}/messages/read`, {
            method: 'POST', headers: authHeaders(),
            body: JSON.stringify({ otherUserId, itemId })
        });
    } catch(e) {}
}

// ─── Global unread badge (shown across all pages) ──────────────────────────────
async function updateGlobalUnreadBadge() {
    const threads = await fetchInbox();
    const total   = threads.reduce((sum, t) => sum + (t.unread || 0), 0);
    // Update badge on navbar (messages nav link)
    document.querySelectorAll('#messagesBadge, .messages-badge').forEach(el => {
        el.textContent   = total > 0 ? (total > 99 ? '99+' : total) : '';
        el.style.display = total > 0 ? 'inline-flex' : 'none';
    });
    // Store for other pages
    localStorage.setItem('unreadMessages', total);
}

// ─── MessagesManager ───────────────────────────────────────────────────────────
class MessagesManager {
    constructor() {
        this.myUsername    = currentUsername();
        this.myUserId      = currentUserId();
        this.activeThread  = null;
        this.messages      = [];
        this.threads       = [];
        this._pollHandle   = null;
        this._lastMsgCount = 0;
        this._lastMsgIds   = new Set();
        this.init();
    }

    async init() {
        await this.loadInbox();
        this.checkURLParams();
        this.startPolling();
        this.setupSearch();
        this.updateNavBadge();
    }

    // ── Inbox ──────────────────────────────────────────────────────────────────
    async loadInbox() {
        this.threads = await fetchInbox();
        this.renderInbox();
        this.updateNavBadge();
    }

    renderInbox() {
        const list = document.getElementById('conversationsList');
        if (!list) return;

        // Update total unread badge in sidebar header
        const totalUnread = this.threads.reduce((s, t) => s + (t.unread || 0), 0);
        const totalEl = document.getElementById('inboxUnreadTotal');
        if (totalEl) {
            totalEl.textContent   = totalUnread > 0 ? totalUnread : '';
            totalEl.style.display = totalUnread > 0 ? 'inline-flex' : 'none';
        }

        if (!this.threads.length) {
            list.innerHTML = `
                <div style="text-align:center;padding:3rem 1rem;color:#9ca3af">
                    <i class="fas fa-comments" style="font-size:3rem;opacity:.3;display:block;margin-bottom:1rem"></i>
                    <p style="font-weight:600;color:#6b7280">No conversations yet</p>
                    <p style="font-size:.82rem;margin-top:.4rem">Browse items and message an owner to get started!</p>
                </div>`;
            return;
        }

        list.innerHTML = this.threads.map(t => {
            // Backend now returns otherUserId and otherUsername directly
            const otherId   = t.otherUserId   || (t._id?.participants || []).find(p => p !== this.myUserId) || '';
            const otherName = t.otherUsername  || otherId;
            const isActive  = this.activeThread?.otherUserId === otherId && this.activeThread?.itemId === (t._id?.itemId || t.itemId);
            const unread    = t.unread || 0;
            const initial   = this.initials(otherName);
            const time      = this.relativeTime(t.lastAt || t.updatedAt);
            const preview   = this.escape(t.lastMessage || '');
            const isMine    = t.lastSenderUsername === this.myUsername;

            return `
            <div class="conversation-item"
                 data-other-id="${otherId}"
                 data-other-name="${this.escape(otherName)}"
                 data-item-id="${t._id?.itemId || t.itemId || ''}"
                 data-item-name="${this.escape(t.itemName || '')}"
                 style="
                    display:flex;align-items:center;gap:.875rem;padding:.875rem 1rem;
                    cursor:pointer;border-bottom:1px solid #f3f4f6;
                    background:${isActive ? '#eff6ff' : unread > 0 ? '#fafbff' : 'white'};
                    transition:background .15s;
                    border-left:3px solid ${isActive ? '#2563eb' : 'transparent'};
                 "
                 onmouseover="if(!this.classList.contains('active'))this.style.background='#f9fafb'"
                 onmouseout="this.style.background='${isActive ? '#eff6ff' : unread > 0 ? '#fafbff' : 'white'}'">

                <div style="position:relative;flex-shrink:0">
                    <div style="
                        width:44px;height:44px;border-radius:50%;
                        background:linear-gradient(135deg,#667eea,#764ba2);
                        display:flex;align-items:center;justify-content:center;
                        color:white;font-weight:700;font-size:.9rem;
                    ">${initial}</div>
                </div>

                <div style="flex:1;min-width:0">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.2rem">
                        <span style="font-weight:${unread > 0 ? '700' : '600'};font-size:.9rem;color:#1f2937;
                                     white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px">
                            ${this.escape(otherName)}
                        </span>
                        <span style="font-size:.72rem;color:#9ca3af;flex-shrink:0;margin-left:.4rem">${time}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center">
                        <div style="font-size:.8rem;color:${unread > 0 ? '#374151' : '#9ca3af'};
                                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px;
                                    font-weight:${unread > 0 ? '600' : '400'}">
                            ${isMine ? '<span style="color:#9ca3af">You: </span>' : ''}${preview || '<em style="opacity:.6">No messages yet</em>'}
                        </div>
                        ${unread > 0 ? `
                        <span style="
                            background:#2563eb;color:white;
                            min-width:18px;height:18px;border-radius:9px;
                            font-size:.7rem;font-weight:700;
                            display:inline-flex;align-items:center;justify-content:center;
                            padding:0 5px;flex-shrink:0;margin-left:.4rem
                        ">${unread > 99 ? '99+' : unread}</span>` : ''}
                    </div>
                    <div style="font-size:.72rem;color:#c4b5fd;margin-top:.15rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                        <i class="fas fa-box" style="font-size:.65rem"></i> ${this.escape(t.itemName || t._id?.itemId || '')}
                    </div>
                </div>
            </div>`;
        }).join('');

        list.querySelectorAll('.conversation-item').forEach(el => {
            el.addEventListener('click', () => {
                this.openThread(
                    el.dataset.otherId,
                    el.dataset.otherName || el.dataset.otherId,
                    el.dataset.itemId,
                    el.dataset.itemName
                );
            });
        });
    }

    updateNavBadge() {
        const total = this.threads.reduce((sum, t) => sum + (t.unread || 0), 0);
        document.querySelectorAll('#messagesBadge, .messages-badge').forEach(el => {
            el.textContent   = total > 0 ? (total > 99 ? '99+' : total) : '';
            el.style.display = total > 0 ? 'inline-flex' : 'none';
        });
        localStorage.setItem('unreadMessages', total > 0 ? total : '');
    }

    // ── Open thread ────────────────────────────────────────────────────────────
    async openThread(otherUserId, otherUsername, itemId, itemName) {
        this.activeThread = { otherUserId, otherUsername, itemId, itemName, unlocked: false };

        // Mark as active in list
        document.querySelectorAll('.conversation-item').forEach(el => {
            el.classList.toggle('active', el.dataset.otherId === otherUserId && el.dataset.itemId === itemId);
            el.style.borderLeft = el.classList.contains('active') ? '3px solid #2563eb' : '3px solid transparent';
            el.style.background = el.classList.contains('active') ? '#eff6ff' : 'white';
        });

        this.renderChatSkeleton();

        const data = await fetchConversation(otherUserId, itemId);
        this.messages = data.messages || [];
        this.activeThread.unlocked = data.unlocked || false;
        this._lastMsgIds = new Set(this.messages.map(m => m._id));

        // Mark messages as read
        await markReadAPI(otherUserId, itemId);
        await this.loadInbox();

        this.renderChat();
    }

    // ── Chat skeleton ──────────────────────────────────────────────────────────
    renderChatSkeleton() {
        const chatArea  = document.getElementById('chatArea');
        const emptyChat = document.getElementById('emptyChat');
        if (emptyChat) emptyChat.style.display = 'none';
        if (chatArea) chatArea.innerHTML = `
            <div style="display:flex;flex-direction:column;height:100%">
                <!-- Skeleton header -->
                <div style="padding:1rem 1.25rem;border-bottom:1px solid #e5e7eb;display:flex;gap:.875rem;align-items:center;background:white">
                    <div style="width:42px;height:42px;border-radius:50%;background:#e5e7eb;animation:shimmer 1.2s infinite"></div>
                    <div style="flex:1">
                        <div style="width:120px;height:14px;background:#e5e7eb;border-radius:4px;margin-bottom:6px;animation:shimmer 1.2s infinite"></div>
                        <div style="width:80px;height:10px;background:#f3f4f6;border-radius:4px;animation:shimmer 1.2s infinite"></div>
                    </div>
                </div>
                <div style="flex:1;padding:1rem;display:flex;align-items:center;justify-content:center">
                    <div style="text-align:center;color:#9ca3af">
                        <i class="fas fa-spinner fa-spin" style="font-size:1.5rem;margin-bottom:.5rem;display:block"></i>
                        Loading messages...
                    </div>
                </div>
            </div>
            <style>@keyframes shimmer{0%,100%{opacity:1}50%{opacity:.5}}</style>`;
    }

    // ── Full chat render ───────────────────────────────────────────────────────
    renderChat() {
        const chatArea  = document.getElementById('chatArea');
        const emptyChat = document.getElementById('emptyChat');
        if (!this.activeThread) { if (emptyChat) emptyChat.style.display = 'flex'; return; }
        if (emptyChat) emptyChat.style.display = 'none';

        const { otherUsername, itemName, unlocked } = this.activeThread;

        chatArea.innerHTML = `
            <!-- Header -->
            <div style="
                display:flex;align-items:center;gap:.875rem;
                padding:.875rem 1.25rem;
                border-bottom:1px solid #e5e7eb;
                background:white;flex-shrink:0;
            ">
                <div style="
                    width:42px;height:42px;border-radius:50%;
                    background:linear-gradient(135deg,#667eea,#764ba2);
                    display:flex;align-items:center;justify-content:center;
                    color:white;font-weight:700;font-size:.9rem;flex-shrink:0
                ">${this.initials(otherUsername)}</div>
                <div style="flex:1;min-width:0">
                    <div style="font-weight:700;color:#1f2937;font-size:.95rem">${this.escape(otherUsername)}</div>
                    <div style="font-size:.75rem;color:#9ca3af;display:flex;align-items:center;gap:.4rem">
                        <i class="fas fa-box" style="font-size:.65rem"></i>
                        ${this.escape(itemName)}
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:.5rem;flex-shrink:0">
                    ${unlocked
                        ? `<span style="background:#d1fae5;color:#065f46;padding:.2rem .65rem;border-radius:20px;font-size:.72rem;font-weight:700">
                               🔓 Unlocked
                           </span>`
                        : `<span style="background:#fef3c7;color:#92400e;padding:.2rem .65rem;border-radius:20px;font-size:.72rem;font-weight:700">
                               🔒 Pre-payment
                           </span>`
                    }
                </div>
            </div>

            <!-- Restriction banner -->
            ${!unlocked ? `
            <div style="
                background:#fffbeb;border-bottom:1px solid #fde68a;
                padding:.6rem 1.25rem;display:flex;align-items:start;
                gap:.5rem;font-size:.78rem;color:#78350f;flex-shrink:0;
            ">
                <i class="fas fa-shield-alt" style="color:#f59e0b;margin-top:1px;flex-shrink:0"></i>
                <span><strong>Restricted</strong> — Phone numbers & addresses are blocked until payment is completed.</span>
            </div>` : ''}

            <!-- Messages area -->
            <div id="chatMessages" style="
                flex:1;overflow-y:auto;padding:1rem 1.25rem;
                display:flex;flex-direction:column;gap:.5rem;
                background:#f9fafb;
            "></div>

            <!-- Send error -->
            <div id="sendError" style="display:none;background:#fef3c7;border-top:1px solid #fde68a;
                 padding:.5rem 1.25rem;font-size:.8rem;color:#92400e;flex-shrink:0"></div>

            <!-- Input bar -->
            <div style="
                display:flex;align-items:center;gap:.625rem;
                padding:.75rem 1rem;border-top:1px solid #e5e7eb;
                background:white;flex-shrink:0;
            ">
                <input type="text" id="messageInput"
                    placeholder="${unlocked ? 'Type freely — payment complete ✓' : 'Type a message…'}"
                    autocomplete="off"
                    style="
                        flex:1;padding:.65rem 1rem;border:1.5px solid #e5e7eb;
                        border-radius:24px;font-size:.875rem;outline:none;
                        transition:border-color .15s;background:#f9fafb;
                    "
                    onfocus="this.style.borderColor='#2563eb';this.style.background='white'"
                    onblur="this.style.borderColor='#e5e7eb';this.style.background='#f9fafb'">
                <button id="sendBtn" style="
                    width:40px;height:40px;border-radius:50%;border:none;
                    background:linear-gradient(135deg,#2563eb,#7c3aed);
                    color:white;cursor:pointer;display:flex;align-items:center;
                    justify-content:center;font-size:.9rem;flex-shrink:0;
                    transition:opacity .15s;box-shadow:0 4px 12px rgba(37,99,235,.35);
                " onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'"
                   title="Send message">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        `;

        this.renderMessagesOnly();
        this.scrollToBottom();
        this.attachSendHandlers();
    }

    // ── Message rendering ──────────────────────────────────────────────────────
    renderMessage(msg) {
        const isMine = (this.myUserId && String(msg.senderId) === String(this.myUserId))
                    || msg.senderUsername === this.myUsername;
        const time   = this.relativeTime(msg.createdAt);
        const isPending = msg.pending;

        if (isMine) {
            return `
            <div style="display:flex;justify-content:flex-end;margin-bottom:.25rem">
                <div style="max-width:72%">
                    <div style="
                        background:linear-gradient(135deg,#2563eb,#7c3aed);
                        color:white;padding:.6rem 1rem;border-radius:18px 18px 4px 18px;
                        font-size:.875rem;line-height:1.5;word-break:break-word;
                        opacity:${isPending ? '.65' : '1'};
                    ">${this.escape(msg.text)}
                    ${msg.sentAfterPayment ? '<span title="Sent after payment" style="font-size:.65rem;opacity:.7;margin-left:4px">🔓</span>' : ''}
                    </div>
                    <div style="text-align:right;font-size:.68rem;color:#9ca3af;margin-top:.2rem;padding-right:.25rem">
                        ${time} ${isPending ? '⏳' : '<i class="fas fa-check-double" style="color:#2563eb;font-size:.6rem"></i>'}
                    </div>
                </div>
            </div>`;
        } else {
            return `
            <div style="display:flex;align-items:flex-end;gap:.5rem;margin-bottom:.25rem">
                <div style="
                    width:28px;height:28px;border-radius:50%;flex-shrink:0;
                    background:linear-gradient(135deg,#667eea,#764ba2);
                    display:flex;align-items:center;justify-content:center;
                    color:white;font-size:.65rem;font-weight:700;
                ">${this.initials(msg.senderUsername)}</div>
                <div style="max-width:72%">
                    <div style="
                        background:white;color:#1f2937;
                        padding:.6rem 1rem;border-radius:18px 18px 18px 4px;
                        font-size:.875rem;line-height:1.5;word-break:break-word;
                        border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,.05);
                    ">${this.escape(msg.text)}</div>
                    <div style="font-size:.68rem;color:#9ca3af;margin-top:.2rem;padding-left:.25rem">${time}</div>
                </div>
            </div>`;
        }
    }

    renderMessagesOnly() {
        const container = document.getElementById('chatMessages');
        if (!container) return;
        if (!this.messages.length) {
            container.innerHTML = `
                <div style="flex:1;display:flex;align-items:center;justify-content:center;
                            text-align:center;color:#9ca3af;padding:3rem 1rem">
                    <div>
                        <i class="fas fa-comment-dots" style="font-size:2.5rem;opacity:.2;display:block;margin-bottom:1rem"></i>
                        <p style="font-size:.9rem">No messages yet. Say hello! 👋</p>
                    </div>
                </div>`;
            return;
        }

        // Group messages by date
        let currentDate = '';
        container.innerHTML = this.messages.map(msg => {
            const dateStr  = new Date(msg.createdAt).toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' });
            const dateSep  = dateStr !== currentDate
                ? `<div style="text-align:center;margin:.75rem 0;font-size:.72rem;color:#9ca3af">
                       <span style="background:#f3f4f6;padding:.2rem .75rem;border-radius:20px">${dateStr}</span>
                   </div>`
                : '';
            currentDate = dateStr;
            return dateSep + this.renderMessage(msg);
        }).join('');
    }

    // ── Send ───────────────────────────────────────────────────────────────────
    attachSendHandlers() {
        const btn   = document.getElementById('sendBtn');
        const input = document.getElementById('messageInput');
        if (!btn || !input) return;

        const doSend = () => {
            const text = input.value.trim();
            if (!text) return;
            input.value = '';
            input.focus();
            this.sendMessage(text);
        };

        btn.addEventListener('click', doSend);
        input.addEventListener('keypress', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); } });

        // Live warning
        if (!this.activeThread?.unlocked) {
            input.addEventListener('input', () => {
                const check = clientFilter(input.value);
                const errEl = document.getElementById('sendError');
                if (!errEl) return;
                if (!check.clean && input.value.trim()) {
                    errEl.style.display = 'block';
                    errEl.innerHTML = `⚠️ Contains <strong>${check.reasons.join(' & ')}</strong> — blocked until payment complete.`;
                } else {
                    errEl.style.display = 'none';
                }
            });
        }
    }

    async sendMessage(text) {
        if (!this.activeThread.unlocked) {
            const check = clientFilter(text);
            if (!check.clean) {
                this.showSendError(`Blocked: contains ${check.reasons.join(' and ')}. Complete payment first.`);
                return;
            }
        }

        const { otherUserId, itemId, itemName } = this.activeThread;
        const tempMsg = {
            _id: 'temp_' + Date.now(),
            senderId: this.myUserId,
            senderUsername: this.myUsername,
            text, createdAt: new Date().toISOString(), pending: true
        };
        this.messages.push(tempMsg);
        this.renderMessagesOnly();
        this.scrollToBottom();

        const result = await sendMessageAPI(otherUserId, itemId, itemName, text);
        if (!result.success) {
            this.messages = this.messages.filter(m => m._id !== tempMsg._id);
            this.renderMessagesOnly();
            this.showSendError(result.restricted
                ? `Blocked: ${result.reasons?.join(' and ')}. Complete payment first.`
                : result.message || 'Failed to send.');
            return;
        }

        const idx = this.messages.findIndex(m => m._id === tempMsg._id);
        if (idx !== -1) this.messages[idx] = result.message;
        this.renderMessagesOnly();
        this.scrollToBottom();
        this.hideSendError();
    }

    showSendError(msg) {
        const el = document.getElementById('sendError');
        if (!el) return;
        el.style.display = 'block';
        el.innerHTML = `⚠️ ${this.escape(msg)}`;
        clearTimeout(this._errTimeout);
        this._errTimeout = setTimeout(() => this.hideSendError(), 6000);
    }

    hideSendError() {
        const el = document.getElementById('sendError');
        if (el) el.style.display = 'none';
    }

    // ── Polling with new-message notifications ─────────────────────────────────
    startPolling() {
        this._pollHandle = setInterval(async () => {
            // Refresh active conversation
            if (this.activeThread) {
                const data       = await fetchConversation(this.activeThread.otherUserId, this.activeThread.itemId);
                const newMsgs    = (data.messages || []).filter(m => !this._lastMsgIds.has(m._id));
                const wasUnlocked= this.activeThread.unlocked;
                this.activeThread.unlocked = data.unlocked;
                this.messages = data.messages || [];
                this._lastMsgIds = new Set(this.messages.map(m => m._id));

                if (data.unlocked !== wasUnlocked) {
                    this.renderChat();
                } else {
                    this.renderMessagesOnly();
                    // Only scroll if near bottom or new message from other user
                    const newFromOther = newMsgs.filter(m => m.senderUsername !== this.myUsername);
                    if (newFromOther.length) {
                        this.scrollToBottom();
                        this.showNewMessageToast(newFromOther[newFromOther.length - 1]);
                    }
                }
            }
            // Refresh inbox
            await this.loadInbox();
        }, 5000);
    }

    showNewMessageToast(msg) {
        // Don't toast if conversation is visible and user is active
        if (document.visibilityState === 'visible' && this.activeThread) return;

        const toast = document.createElement('div');
        toast.style.cssText = `
            position:fixed;bottom:1.5rem;right:1.5rem;z-index:99999;
            background:white;border:1px solid #e5e7eb;border-radius:16px;
            padding:1rem 1.25rem;min-width:280px;max-width:340px;
            box-shadow:0 12px 40px rgba(0,0,0,.15);
            display:flex;align-items:center;gap:.875rem;
            animation:slideInRight .3s ease;cursor:pointer;
        `;
        toast.innerHTML = `
            <div style="
                width:40px;height:40px;border-radius:50%;flex-shrink:0;
                background:linear-gradient(135deg,#667eea,#764ba2);
                display:flex;align-items:center;justify-content:center;
                color:white;font-weight:700;font-size:.85rem;
            ">${this.initials(msg.senderUsername)}</div>
            <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:.875rem;color:#1f2937;margin-bottom:.15rem">
                    ${this.escape(msg.senderUsername)}
                </div>
                <div style="font-size:.8rem;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                    ${this.escape(msg.text)}
                </div>
            </div>
            <button onclick="this.parentElement.remove()" style="
                background:none;border:none;color:#9ca3af;cursor:pointer;font-size:1rem;
                padding:.25rem;flex-shrink:0;line-height:1;
            ">✕</button>
            <style>@keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}</style>
        `;
        toast.addEventListener('click', e => {
            if (e.target.tagName !== 'BUTTON') {
                toast.remove();
                if (this.activeThread) this.renderChat();
            }
        });
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
    }

    // ── URL params ─────────────────────────────────────────────────────────────
    checkURLParams() {
        const p             = new URLSearchParams(window.location.search);
        const otherUserId   = p.get('owner') || p.get('userId') || p.get('user') || '';
        const otherUsername = p.get('owner') || p.get('username') || p.get('user') || otherUserId;
        const itemId        = p.get('itemId') || 'direct';
        const itemName      = p.get('itemName') || p.get('item') || 'Item';

        if (otherUserId) this.openThread(otherUserId, otherUsername, itemId, itemName);
    }

    // ── Search ─────────────────────────────────────────────────────────────────
    setupSearch() {
        document.getElementById('searchConversations')?.addEventListener('input', e => {
            const q = e.target.value.toLowerCase();
            document.querySelectorAll('.conversation-item').forEach(el => {
                el.style.display = el.textContent.toLowerCase().includes(q) ? 'flex' : 'none';
            });
        });
    }

    // ── Utilities ──────────────────────────────────────────────────────────────
    scrollToBottom() {
        setTimeout(() => {
            const el = document.getElementById('chatMessages');
            if (el) el.scrollTop = el.scrollHeight;
        }, 60);
    }

    initials(name = '') {
        if (!name) return 'U';
        const parts = name.trim().split(/\s+/);
        return (parts.length >= 2 ? parts[0][0] + parts[1][0] : name.substring(0, 2)).toUpperCase();
    }

    escape(str = '') {
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    relativeTime(iso) {
        if (!iso) return '';
        const ms   = Date.now() - new Date(iso).getTime();
        const mins = Math.floor(ms / 60000);
        const hrs  = Math.floor(ms / 3600000);
        const days = Math.floor(ms / 86400000);
        if (mins  <  1) return 'Just now';
        if (mins  < 60) return `${mins}m`;
        if (hrs   < 24) return `${hrs}h`;
        if (days  <  7) return `${days}d`;
        return new Date(iso).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    }
}

// ─── Bootstrap ─────────────────────────────────────────────────────────────────
let messagesManager;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { messagesManager = new MessagesManager(); });
} else {
    messagesManager = new MessagesManager();
}

// ─── Global: update navbar badge on any page ───────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const msgBadge = document.getElementById('messagesBadge');
    if (msgBadge) {
        const stored = localStorage.getItem('unreadMessages');
        if (stored && parseInt(stored) > 0) {
            msgBadge.textContent   = stored;
            msgBadge.style.display = 'inline-flex';
        }
        // Refresh every 30s on any page
        setInterval(updateGlobalUnreadBadge, 30000);
    }
});