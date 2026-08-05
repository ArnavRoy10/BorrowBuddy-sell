const express = require('express');
const router  = express.Router();
const Message = require('../models/Message');
const Payment = require('../models/Payment');
const User    = require('../models/User');
const { protect } = require('../middleware/auth');

// ─── Content Filter ────────────────────────────────────────────────────────────
const PHONE_PATTERNS = [
    /\b(\+91[\-\s]?)?[6-9]\d{9}\b/g,
    /\b\+?1?\s*[\(]?\d{3}[\)]?[\s\-\.]?\d{3}[\s\-\.]?\d{4}\b/g,
    /\b\+?\d{1,3}[\s\-]?\(?\d{2,4}\)?[\s\-]?\d{3,4}[\s\-]?\d{3,4}\b/g,
    /\b\d{5}[\s\-]\d{5}\b/g,
];
const ADDRESS_PATTERNS = [
    /\b(flat|apartment|apt|house|villa|plot|sector|block|floor|building|society|colony|nagar|road|street|lane|marg|chowk|bazaar|market|near|opposite|opp\.?|behind)\b/gi,
    /\b\d{1,4}[\-\/]?\s*[A-Z]?\s*(st|street|rd|road|ave|avenue|blvd|boulevard|ln|lane|dr|drive|ct|court|pl|place|way|nagar|marg)\b/gi,
    /\b(pin|pincode|zip|postal)\s*[:–\-]?\s*\d{5,6}\b/gi,
    /\b[1-9]\d{5}\b/g,
];

function filterContent(text) {
    const reasons = [];
    for (const re of PHONE_PATTERNS)   { if (re.test(text)) { reasons.push('phone number');     break; } }
    for (const re of ADDRESS_PATTERNS) { if (re.test(text)) { reasons.push('physical address'); break; } }
    PHONE_PATTERNS.forEach(r => (r.lastIndex = 0));
    ADDRESS_PATTERNS.forEach(r => (r.lastIndex = 0));
    return { clean: reasons.length === 0, reasons: [...new Set(reasons)] };
}

// ─── Helper: resolve username OR objectId → User doc ──────────────────────────
async function resolveUser(idOrUsername) {
    if (!idOrUsername) return null;
    // If it looks like a Mongo ObjectId (24 hex chars) try that first
    if (/^[a-f\d]{24}$/i.test(idOrUsername)) {
        const u = await User.findById(idOrUsername).select('_id username');
        if (u) return u;
    }
    // Otherwise look up by username
    return await User.findOne({ username: idOrUsername }).select('_id username');
}

// ─── Payment Check ─────────────────────────────────────────────────────────────
async function hasCompletedPayment(borrowerId, itemId) {
    try {
        const payment = await Payment.findOne({ userId: borrowerId, itemId, status: 'succeeded' });
        return !!payment;
    } catch { return false; }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/messages/conversation?otherUserId=<username|id>&itemId=<id>
// ─────────────────────────────────────────────────────────────────────────────
router.get('/conversation', protect, async (req, res) => {
    try {
        const { otherUserId, itemId } = req.query;
        if (!otherUserId || !itemId) {
            return res.status(400).json({ success: false, message: 'otherUserId and itemId required' });
        }

        // Resolve the other user
        const otherUser = await resolveUser(otherUserId);
        if (!otherUser) {
            // No user found yet — return empty conversation (first message hasn't been sent)
            return res.json({ success: true, unlocked: false, messages: [] });
        }

        const myId    = req.user._id;
        const otherId = otherUser._id;
        const paid    = await hasCompletedPayment(myId, itemId);

        const messages = await Message.find({
            participants: { $all: [myId, otherId] },
            itemId
        }).sort({ createdAt: 1 });

        // Mark unread as read
        await Message.updateMany(
            { participants: { $all: [myId, otherId] }, itemId, senderId: { $ne: myId }, read: false },
            { $set: { read: true } }
        );

        res.json({
            success: true,
            unlocked: paid,
            messages: messages.map(m => ({
                _id:             m._id,
                senderId:        m.senderId,
                senderUsername:  m.senderUsername,
                text:            m.text,
                sentAfterPayment:m.sentAfterPayment,
                wasFiltered:     m.wasFiltered,
                createdAt:       m.createdAt,
                read:            m.read
            }))
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/messages/send
// Body: { otherUserId (username or id), itemId, itemName, text }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/send', protect, async (req, res) => {
    try {
        const { otherUserId, itemId, itemName = '', text } = req.body;

        if (!otherUserId || !itemId || !text?.trim()) {
            return res.status(400).json({ success: false, message: 'otherUserId, itemId and text are required' });
        }

        // Resolve other user by username or id
        const otherUser = await resolveUser(otherUserId);
        if (!otherUser) {
            return res.status(404).json({ success: false, message: `User "${otherUserId}" not found` });
        }

        const myId    = req.user._id;
        const otherId = otherUser._id;
        const paid    = await hasCompletedPayment(myId, itemId);

        const finalText = text.trim();

        // Block restricted content if not paid
        if (!paid) {
            const check = filterContent(finalText);
            if (!check.clean) {
                return res.status(403).json({
                    success:    false,
                    restricted: true,
                    reasons:    check.reasons,
                    message:    `Message contains restricted content (${check.reasons.join(', ')}). Complete payment first.`
                });
            }
        }

        const msg = await Message.create({
            participants:     [myId, otherId].map(String).sort(),
            itemId,
            itemName,
            senderId:         myId,
            senderUsername:   req.user.username || req.user.name || 'User',
            text:             finalText,
            sentAfterPayment: paid,
            wasFiltered:      false
        });

        res.status(201).json({
            success:  true,
            unlocked: paid,
            message: {
                _id:             msg._id,
                senderId:        msg.senderId,
                senderUsername:  msg.senderUsername,
                text:            msg.text,
                sentAfterPayment:msg.sentAfterPayment,
                createdAt:       msg.createdAt,
                read:            false
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/messages/inbox
// ─────────────────────────────────────────────────────────────────────────────
router.get('/inbox', protect, async (req, res) => {
    try {
        const myId       = req.user._id;
        const myIdStr    = myId.toString();
        const myUsername = req.user.username || req.user.name || '';

        const threads = await Message.aggregate([
            { $match: { participants: myIdStr } },
            { $sort:  { createdAt: -1 } },
            {
                $group: {
                    _id:               { itemId: '$itemId', participants: '$participants' },
                    lastMessage:       { $first: '$text' },
                    lastAt:            { $first: '$createdAt' },
                    lastSenderUsername:{ $first: '$senderUsername' },
                    unread:            { $sum: { $cond: [{ $and: [{ $ne: ['$senderUsername', myUsername] }, { $eq: ['$read', false] }] }, 1, 0] } },
                    itemName:          { $first: '$itemName' },
                    participants:      { $first: '$participants' },
                    allSenderUsernames:{ $addToSet: '$senderUsername' }
                }
            },
            { $sort: { lastAt: -1 } }
        ]);

        // Enrich each thread with the other user's username
        const enriched = threads.map(t => {
            // participants is array of userId strings — find the other one
            const otherIdStr   = (t._id.participants || []).find(p => p !== myIdStr) || '';
            // otherUsername: find a senderUsername that isn't mine
            const otherUsername = (t.allSenderUsernames || []).find(u => u !== myUsername) || otherIdStr;
            return {
                ...t,
                otherUserId:   otherIdStr,
                otherUsername
            };
        });

        res.json({ success: true, threads: enriched });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/messages/unread-count
// ─────────────────────────────────────────────────────────────────────────────
router.get('/unread-count', protect, async (req, res) => {
    try {
        const count = await Message.countDocuments({
            participants: req.user._id.toString(),
            senderId:     { $ne: req.user._id },
            read:         false
        });
        res.json({ success: true, count });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;