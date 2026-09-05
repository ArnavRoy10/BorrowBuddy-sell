const express  = require('express');
const router   = express.Router();
const Request  = require('../models/Request');
const User     = require('../models/User');
const { protect } = require('../middleware/auth');
const {
    sendRequestApprovedEmail,
    sendRequestDeclinedEmail,
    sendNewRequestEmail
} = require('../utils/emailService');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5500';

// ── POST /api/requests  — submit a new borrow request ─────────────
router.post('/', protect, async (req, res) => {
    try {
        const { itemId, itemName, itemImage, itemOwner, fromDate, toDate, duration, message } = req.body;

        const requestedBy   = req.user.username || req.user.email;
        const requestedById = req.user._id;

        if (requestedBy === itemOwner || requestedById.toString() === req.body.itemOwnerId) {
            return res.status(400).json({ success: false, message: 'You cannot borrow your own item.' });
        }

        // Look up the owner in DB to get their reliable _id
        const ownerUser = await User.findOne({
            $or: [{ username: itemOwner }, { email: itemOwner }]
        });

        // Cancel any existing pending request for this item by this user
        // (allows re-requesting with new dates or after accidental submissions)
        await Request.updateMany(
            { itemId, requestedById, status: 'pending' },
            { $set: { status: 'cancelled' } }
        );

        const request = await Request.create({
            itemId, itemName, itemImage,
            itemOwner,
            itemOwnerId:   ownerUser?._id || null,
            requestedBy,
            requestedById,
            fromDate, toDate, duration,
            message: message || ''
        });

        // ── Send email to owner about the new request ─────────────
        if (ownerUser?.email) {
            sendNewRequestEmail({
                to:           ownerUser.email,
                ownerName:    ownerUser.firstName || ownerUser.username,
                borrowerName: req.user.firstName || requestedBy,
                itemName,
                fromDate,
                toDate,
                requestsUrl:  `${FRONTEND_URL}/requests.html`
            }).catch(e => console.warn('Email send failed:', e.message));
        }

        res.status(201).json({ success: true, request });
    } catch (err) {
        console.error('Create request error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/requests/incoming — requests FOR my items ─────────────
router.get('/incoming', protect, async (req, res) => {
    try {
        // Match by ID (reliable) OR username/email (fallback for old records)
        const requests = await Request.find({
            $or: [
                { itemOwnerId: req.user._id },
                { itemOwner:   req.user.username },
                { itemOwner:   req.user.email }
            ]
        }).sort({ createdAt: -1 });

        res.json({ success: true, requests });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET /api/requests/outgoing — requests I SENT ───────────────────
router.get('/outgoing', protect, async (req, res) => {
    try {
        const requests = await Request.find({
            $or: [
                { requestedById: req.user._id },
                { requestedBy:   req.user.username },
                { requestedBy:   req.user.email }
            ]
        }).sort({ createdAt: -1 });

        res.json({ success: true, requests });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST /api/requests/cancel-by-item ────────────────────────────
// Cancels pending requests by itemId + fromDate when no MongoId available
router.post('/cancel-by-item', protect, async (req, res) => {
    try {
        const { itemId, fromDate } = req.body;
        if (!itemId) return res.status(400).json({ success: false, message: 'itemId required' });

        const requestedBy = req.user.username || req.user.email;

        const result = await Request.updateMany(
            {
                itemId,
                requestedBy,
                status: 'pending',
                ...(fromDate ? { fromDate } : {})
            },
            { $set: { status: 'cancelled' } }
        );

        res.json({ success: true, cancelled: result.modifiedCount });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── PUT /api/requests/:id/approve ──────────────────────────────────
router.put('/:id/approve', protect, async (req, res) => {
    try {
        const request = await Request.findById(req.params.id);
        if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });

        const isOwner = request.itemOwnerId?.toString() === req.user._id.toString()
                     || request.itemOwner === req.user.username
                     || request.itemOwner === req.user.email;
        if (!isOwner) return res.status(403).json({ success: false, message: 'Not authorized.' });

        request.status = 'approved';
        await request.save();

        // ── Send email to borrower about the approval ──────────────
        const borrowerUser = await User.findOne({
            $or: [{ username: request.requestedBy }, { email: request.requestedBy }, { _id: request.requestedById }]
        });
        if (borrowerUser?.email) {
            sendRequestApprovedEmail({
                to:            borrowerUser.email,
                borrowerName:  borrowerUser.firstName || borrowerUser.username,
                itemName:      request.itemName,
                ownerName:     req.user.firstName || req.user.username,
                fromDate:      request.fromDate,
                toDate:        request.toDate,
                itemUrl:       `${FRONTEND_URL}/item-details.html?id=${request.itemId}`
            }).catch(e => console.warn('Email send failed:', e.message));
        }

        res.json({ success: true, request });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── PUT /api/requests/:id/reject ───────────────────────────────────
router.put('/:id/reject', protect, async (req, res) => {
    try {
        const request = await Request.findById(req.params.id);
        if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });

        const isOwner = request.itemOwnerId?.toString() === req.user._id.toString()
                     || request.itemOwner === req.user.username
                     || request.itemOwner === req.user.email;
        if (!isOwner) return res.status(403).json({ success: false, message: 'Not authorized.' });

        request.status = 'rejected';
        await request.save();

        // ── Send email to borrower about the decline ────────────────
        const borrowerUser = await User.findOne({
            $or: [{ username: request.requestedBy }, { email: request.requestedBy }, { _id: request.requestedById }]
        });
        if (borrowerUser?.email) {
            sendRequestDeclinedEmail({
                to:            borrowerUser.email,
                borrowerName:  borrowerUser.firstName || borrowerUser.username,
                itemName:      request.itemName,
                ownerName:     req.user.firstName || req.user.username
            }).catch(e => console.warn('Email send failed:', e.message));
        }

        res.json({ success: true, request });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── PUT /api/requests/:id/cancel ───────────────────────────────────
router.put('/:id/cancel', protect, async (req, res) => {
    try {
        const request = await Request.findById(req.params.id);
        if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });

        const isRequester = request.requestedById?.toString() === req.user._id.toString()
                         || request.requestedBy === req.user.username
                         || request.requestedBy === req.user.email;
        if (!isRequester) return res.status(403).json({ success: false, message: 'Not authorized.' });
        if (request.status !== 'pending') return res.status(400).json({ success: false, message: 'Only pending requests can be cancelled.' });

        request.status = 'cancelled';
        await request.save();
        res.json({ success: true, request });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── PUT /api/requests/:id/request-return — borrower returns a free/standard borrow
router.put('/:id/request-return', protect, async (req, res) => {
    try {
        const request = await Request.findById(req.params.id);
        if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });

        const isRequester = request.requestedById?.toString() === req.user._id.toString()
                         || request.requestedBy === req.user.username
                         || request.requestedBy === req.user.email;
        if (!isRequester) return res.status(403).json({ success: false, message: 'Not authorized.' });
        if (request.status !== 'approved') {
            return res.status(400).json({ success: false, message: 'Only active (approved) borrows can be returned.' });
        }

        request.status = 'pending_return';
        request.returnRequestedAt = new Date();
        await request.save();

        res.json({ success: true, request });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── PUT /api/requests/:id/confirm-return — owner confirms a free/standard borrow was returned
router.put('/:id/confirm-return', protect, async (req, res) => {
    try {
        const request = await Request.findById(req.params.id);
        if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });

        const isOwner = request.itemOwnerId?.toString() === req.user._id.toString()
                     || request.itemOwner === req.user.username
                     || request.itemOwner === req.user.email;
        if (!isOwner) return res.status(403).json({ success: false, message: 'Not authorized.' });
        if (request.status !== 'pending_return') {
            return res.status(400).json({ success: false, message: 'No pending return to confirm.' });
        }

        request.status = 'completed';
        request.returnConfirmedAt = new Date();
        await request.save();

        res.json({ success: true, request });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
