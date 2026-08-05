const express = require('express');
const router  = express.Router();
const Dispute = require('../models/Dispute');
const User    = require('../models/User');
const { protect } = require('../middleware/auth');

const nameOf = (user) => user.username || user.email;

function canView(dispute, user) {
    const id = user._id.toString();
    return (
        (dispute.raisedById && dispute.raisedById.toString() === id) ||
        (dispute.againstId && dispute.againstId.toString() === id) ||
        dispute.raisedBy === nameOf(user) ||
        dispute.against === nameOf(user) ||
        user.role === 'admin' || user.isAdmin === true
    );
}

const isAdmin = (user) => user.role === 'admin' || user.isAdmin === true;

// ── POST /api/disputes — report a damaged item / request a refund ──
router.post('/', protect, async (req, res) => {
    try {
        const {
            requestId, itemId, itemName, itemImage, against,
            type, description, refundRequested, amountRequested, evidence
        } = req.body;

        if (!itemName || !type || !description) {
            return res.status(400).json({
                success: false,
                message: 'Item, issue type and description are required.'
            });
        }

        let againstUser = null;
        if (against) {
            againstUser = await User.findOne({ $or: [{ username: against }, { email: against }] });
        }

        const dispute = await Dispute.create({
            requestId, itemId, itemName, itemImage,
            raisedBy:   nameOf(req.user),
            raisedById: req.user._id,
            against:    against || '',
            againstId:  againstUser?._id || null,
            type,
            description,
            refundRequested: !!refundRequested,
            amountRequested: Number(amountRequested) || 0,
            evidence: Array.isArray(evidence) ? evidence.slice(0, 5) : [],
            messages: []
        });

        res.status(201).json({ success: true, dispute });
    } catch (error) {
        console.error('Create dispute error:', error);
        res.status(500).json({ success: false, message: 'Could not create dispute.' });
    }
});

// ── GET /api/disputes/mine — disputes I raised or that involve me ──
router.get('/mine', protect, async (req, res) => {
    try {
        const name = nameOf(req.user);
        const disputes = await Dispute.find({
            $or: [
                { raisedById: req.user._id },
                { againstId: req.user._id },
                { raisedBy: name },
                { against: name }
            ]
        }).sort({ createdAt: -1 });

        res.json({ success: true, count: disputes.length, disputes });
    } catch (error) {
        console.error('List disputes error:', error);
        res.status(500).json({ success: false, message: 'Could not load disputes.' });
    }
});

// ── GET /api/disputes/admin/all — moderation queue ────────────────
router.get('/admin/all', protect, async (req, res) => {
    if (!isAdmin(req.user)) {
        return res.status(403).json({ success: false, message: 'Admins only.' });
    }
    const filter = req.query.status ? { status: req.query.status } : {};
    const disputes = await Dispute.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: disputes.length, disputes });
});

// ── GET /api/disputes/:id ─────────────────────────────────────────
router.get('/:id', protect, async (req, res) => {
    try {
        const dispute = await Dispute.findById(req.params.id);
        if (!dispute) return res.status(404).json({ success: false, message: 'Dispute not found.' });
        if (!canView(dispute, req.user)) {
            return res.status(403).json({ success: false, message: 'Not authorized.' });
        }
        res.json({ success: true, dispute });
    } catch (error) {
        res.status(400).json({ success: false, message: 'Invalid dispute id.' });
    }
});

// ── POST /api/disputes/:id/messages — reply in a dispute thread ────
router.post('/:id/messages', protect, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text || !text.trim()) {
            return res.status(400).json({ success: false, message: 'Message cannot be empty.' });
        }

        const dispute = await Dispute.findById(req.params.id);
        if (!dispute) return res.status(404).json({ success: false, message: 'Dispute not found.' });
        if (!canView(dispute, req.user)) {
            return res.status(403).json({ success: false, message: 'Not authorized.' });
        }
        if (['resolved', 'rejected', 'withdrawn'].includes(dispute.status)) {
            return res.status(400).json({ success: false, message: 'This dispute is closed.' });
        }

        dispute.messages.push({
            sender:   nameOf(req.user),
            senderId: req.user._id,
            text:     text.trim(),
            isStaff:  isAdmin(req.user)
        });
        if (dispute.status === 'open') dispute.status = 'under_review';
        await dispute.save();

        res.status(201).json({ success: true, dispute });
    } catch (error) {
        console.error('Dispute message error:', error);
        res.status(500).json({ success: false, message: 'Could not post message.' });
    }
});

// ── PATCH /api/disputes/:id/withdraw — reporter cancels ───────────
router.patch('/:id/withdraw', protect, async (req, res) => {
    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return res.status(404).json({ success: false, message: 'Dispute not found.' });

    const isOwner = dispute.raisedById?.toString() === req.user._id.toString() ||
                    dispute.raisedBy === nameOf(req.user);
    if (!isOwner) return res.status(403).json({ success: false, message: 'Only the reporter can withdraw.' });
    if (dispute.status === 'resolved') {
        return res.status(400).json({ success: false, message: 'Dispute already resolved.' });
    }

    dispute.status = 'withdrawn';
    await dispute.save();
    res.json({ success: true, dispute });
});

// ── PATCH /api/disputes/:id/resolve — admin decision ──────────────
router.patch('/:id/resolve', protect, async (req, res) => {
    if (!isAdmin(req.user)) {
        return res.status(403).json({ success: false, message: 'Admins only.' });
    }

    const { outcome, refundAmount, note, reject } = req.body;
    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return res.status(404).json({ success: false, message: 'Dispute not found.' });

    dispute.status = reject ? 'rejected' : 'resolved';
    dispute.resolution = {
        outcome:      reject ? 'no_refund' : (outcome || 'no_refund'),
        refundAmount: Number(refundAmount) || 0,
        note:         note || '',
        resolvedBy:   nameOf(req.user),
        resolvedAt:   new Date()
    };
    await dispute.save();

    res.json({ success: true, dispute });
});

module.exports = router;