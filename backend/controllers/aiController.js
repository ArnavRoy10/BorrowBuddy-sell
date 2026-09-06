const fetch = global.fetch || require('node-fetch');

// Configurable so it's easy to swap models later without a code change —
// gemini-3.1-flash-lite is the current stable, low-cost choice (Sept 2026).
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
const GEMINI_URL    = (model) =>
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

// Keeps the assistant grounded in what BorrowBuddy actually does, instead of
// hallucinating generic marketplace behavior. Update this if features change.
const SYSTEM_PROMPT = `You are the BorrowBuddy Assistant, a friendly in-app helper for BorrowBuddy — a peer-to-peer borrow/lend marketplace (like a mix of a rental app and a community sharing board). All prices are in ₹ (Indian Rupees).

Key facts about how BorrowBuddy works:
- Browsing: users browse listed items by category, price, and distance.
- Borrowing has two pathways after picking dates on an item's availability calendar:
  1. Standard Request — free, sent to the owner, who must approve or decline it. Approval only reveals contact info for manual pickup coordination.
  2. Instant Access — pay a fee of ₹10 + 10% of the rental total (or redeem 100 loyalty points instead of paying) to unlock the owner's contact details immediately, no approval wait.
- Lending: users list items via "Add Item" — name, category, description, condition, up to 5 photos, price per day (or Free), an optional refundable security deposit, phone number, and pickup location.
- Returning items is a two-step confirmation: the borrower taps "Return" on "My Borrowed Items", which notifies the owner; the owner then confirms on "My Lent Items", which flags the security deposit for refund.
- Security deposits are refundable, held until the owner confirms the return.
- Loyalty points: users earn 100 points for each friend who signs up via their referral link (both people get 100 points); 100 points = one free Instant Access unlock.
- Other features: in-app messaging (contact details are filtered out of messages before an unlock/approval, for safety), phone verification via OTP, transaction history with downloadable receipts, dispute reporting for damaged/lost items, dark mode, and a request/loan status tracker.

Tone: friendly, concise, and practical — a few short sentences or a tight numbered list, not a wall of text. If someone asks about something account-specific (their exact balance, a specific transaction, order status) that you have no way of knowing, tell them plainly you can't see their account and point them to the relevant page (My Borrowed, My Lent, Transaction History, Settings) or suggest contacting support. Never invent policies, prices, or features you're not sure about. Stay strictly on topic — if asked something entirely unrelated to BorrowBuddy, politely redirect back to how you can help with the app.`;

// Basic per-IP rate limit so a single visitor can't run up your Gemini bill —
// resets every minute. In-memory only (fine for a single Render instance;
// swap for Redis if you ever scale to multiple instances).
const RATE_LIMIT       = 15; // requests per window per IP
const RATE_WINDOW_MS   = 60 * 1000;
const hitLog           = new Map();

function isRateLimited(ip) {
    const now    = Date.now();
    const hits   = (hitLog.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
    hits.push(now);
    hitLog.set(ip, hits);
    return hits.length > RATE_LIMIT;
}

exports.chat = async (req, res) => {
    try {
        const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
        if (isRateLimited(ip)) {
            return res.status(429).json({ success: false, message: 'Too many messages — please wait a moment and try again.' });
        }

        const { message, history } = req.body;
        if (!message || typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({ success: false, message: 'Message is required.' });
        }
        if (message.length > 2000) {
            return res.status(400).json({ success: false, message: 'Message is too long.' });
        }
        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ success: false, message: 'AI assistant is not configured on the server.' });
        }

        // history: [{ sender: 'user'|'assistant', text: '...' }, ...] — last ~10 turns from the client
        const priorTurns = Array.isArray(history) ? history.slice(-10) : [];
        const contents = [
            ...priorTurns.map(turn => ({
                role:  turn.sender === 'assistant' ? 'model' : 'user',
                parts: [{ text: String(turn.text || '').slice(0, 2000) }]
            })),
            { role: 'user', parts: [{ text: message.trim() }] }
        ];

        const geminiRes = await fetch(`${GEMINI_URL(GEMINI_MODEL)}?key=${process.env.GEMINI_API_KEY}`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents,
                systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                generationConfig:  { temperature: 0.6, maxOutputTokens: 500 }
            })
        });

        const data = await geminiRes.json();

        if (!geminiRes.ok) {
            console.error('Gemini API error:', data);
            return res.status(502).json({ success: false, message: 'AI assistant is temporarily unavailable.' });
        }

        const reply = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || null;
        if (!reply) {
            return res.status(502).json({ success: false, message: 'AI assistant could not generate a response.' });
        }

        res.status(200).json({ success: true, reply });

    } catch (error) {
        console.error('AI chat error:', error);
        res.status(500).json({ success: false, message: 'AI assistant error.', error: error.message });
    }
};
