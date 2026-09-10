const Razorpay = require('razorpay');
const crypto   = require('crypto');
const Payment  = require('../models/Payment');
const User     = require('../models/User');

// Init Razorpay with keys from .env
const razorpay = new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/config
// Returns the public key to the frontend
// ─────────────────────────────────────────────────────────────────────────────
exports.getConfig = async (req, res) => {
    res.status(200).json({
        success: true,
        keyId: process.env.RAZORPAY_KEY_ID
    });
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/create-order
// Creates a Razorpay order (like Stripe's payment intent)
// Body: { amount (₹), itemId, itemName }
// ─────────────────────────────────────────────────────────────────────────────
exports.createOrder = async (req, res) => {
    try {
        const { amount, itemId, itemName } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid amount' });
        }

        // Razorpay needs amount in paise (1 ₹ = 100 paise)
        const amountPaise = Math.round(amount * 100);

        const order = await razorpay.orders.create({
            amount:   amountPaise,
            currency: 'INR',
            receipt:  `bb_${Date.now()}`,
            notes: {
                itemId:   itemId   || '',
                itemName: itemName || '',
                userId:   req.user._id.toString()
            }
        });

        // Save pending payment to MongoDB
        const payment = await Payment.create({
            userId:   req.user._id,
            itemId:   itemId || null,
            amount:   amount,
            currency: 'inr',
            provider: 'razorpay',
            type:     'service_fee',
            orderId:  order.id,
            status:   'pending',
            metadata: { itemName }
        });

        res.status(200).json({
            success:   true,
            orderId:   order.id,
            amount:    amountPaise,
            currency:  'INR',
            paymentId: payment._id,
            keyId:     process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        console.error('Create Order Error:', error);
        res.status(500).json({ success: false, message: 'Failed to create order', error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/verify
// Verifies Razorpay signature after payment, marks item as unlocked
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, itemId }
// ─────────────────────────────────────────────────────────────────────────────
exports.verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id, razorpay_payment_id, razorpay_signature, itemId,
            ownerUsername, itemName, itemImage, fromDate, toDate
        } = req.body;

        // Verify signature using HMAC SHA256
        const body      = razorpay_order_id + '|' + razorpay_payment_id;
        const expected  = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex');

        if (expected !== razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }

        // Look up the owner so we can notify/attribute the loan to their real account,
        // not just a username string that only means something in one browser.
        let ownerId = null;
        if (ownerUsername) {
            const ownerUser = await User.findOne({
                $or: [{ username: ownerUsername }, { email: ownerUsername }]
            });
            ownerId = ownerUser?._id || null;
        }

        // Update payment in MongoDB to succeeded, and record the loan lifecycle info
        const payment = await Payment.findOneAndUpdate(
            { orderId: razorpay_order_id, userId: req.user._id },
            {
                status:        'succeeded',
                transactionId: razorpay_payment_id,
                paidAt:        new Date(),
                ownerId:       ownerId,
                fromDate:      fromDate || undefined,
                toDate:        toDate   || undefined,
                loanStatus:    'active',
                'metadata.itemName':     itemName  || undefined,
                'metadata.itemImage':    itemImage || undefined,
                'metadata.lenderName':   ownerUsername || undefined,
                'metadata.borrowerName': req.user.username || req.user.email
            },
            { new: true }
        );

        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment record not found' });
        }

        res.status(200).json({
            success:   true,
            message:   'Payment verified — item unlocked',
            paymentId: razorpay_payment_id,
            itemId:    itemId || payment.itemId,
            payment
        });

    } catch (error) {
        console.error('Verify Payment Error:', error);
        res.status(500).json({ success: false, message: 'Verification failed', error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/verify-cart — verifies one Razorpay payment that covers
// multiple cart items at once, then creates one real Payment/loan record PER
// item so each shows up correctly in both the borrower's and each owner's
// My Borrowed / My Lent lists. Previously the frontend only ever wrote these
// to localStorage cross-user keys, which the other person's browser could
// never actually see.
// ─────────────────────────────────────────────────────────────────────────────
exports.verifyCartPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, items } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'No cart items to record.' });
        }

        const body      = razorpay_order_id + '|' + razorpay_payment_id;
        const expected  = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex');

        if (expected !== razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }

        // Mark the original order-tracking Payment record as succeeded too, so
        // there's still an audit trail of the actual Razorpay charge.
        await Payment.findOneAndUpdate(
            { orderId: razorpay_order_id, userId: req.user._id },
            { status: 'succeeded', transactionId: razorpay_payment_id, paidAt: new Date() }
        );

        // Resolve every owner username once, not per item
        const ownerUsernames = [...new Set(items.map(i => i.ownerUsername).filter(Boolean))];
        const owners = await User.find({
            $or: [
                { username: { $in: ownerUsernames } },
                { email: { $in: ownerUsernames } }
            ]
        });
        const ownerMap = new Map();
        owners.forEach(o => {
            ownerMap.set(o.username, o._id);
            ownerMap.set(o.email, o._id);
        });

        const isValidObjectId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

        const created = await Promise.all(items.map(item => Payment.create({
            userId:        req.user._id,
            itemId:        isValidObjectId(item.itemId) ? item.itemId : null,
            amount:        item.amount || 0,
            currency:      'inr',
            provider:      'razorpay',
            type:          'service_fee',
            orderId:       razorpay_order_id,
            transactionId: razorpay_payment_id,
            status:        'succeeded',
            paidAt:        new Date(),
            ownerId:       ownerMap.get(item.ownerUsername) || null,
            fromDate:      item.fromDate || undefined,
            toDate:        item.toDate || undefined,
            loanStatus:    'active',
            metadata: {
                itemName:     item.itemName,
                itemImage:    item.itemImage,
                lenderName:   item.ownerUsername,
                borrowerName: req.user.username || req.user.email
            }
        })));

        res.status(200).json({ success: true, message: `${created.length} item(s) unlocked`, payments: created });

    } catch (error) {
        console.error('Verify Cart Payment Error:', error);
        res.status(500).json({ success: false, message: 'Cart verification failed', error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/borrowed — items the current user has borrowed (paid for)
// ─────────────────────────────────────────────────────────────────────────────
exports.getBorrowed = async (req, res) => {
    try {
        const payments = await Payment.find({ userId: req.user._id, status: 'succeeded' })
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, payments });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get borrowed items', error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/lent — items the current user has lent out (owner side)
// ─────────────────────────────────────────────────────────────────────────────
exports.getLent = async (req, res) => {
    try {
        const payments = await Payment.find({ ownerId: req.user._id, status: 'succeeded' })
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, payments });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get lent items', error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/payments/:id/request-return — borrower requests to return the item
// ─────────────────────────────────────────────────────────────────────────────
exports.requestReturn = async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id);
        if (!payment) return res.status(404).json({ success: false, message: 'Loan not found.' });

        if (payment.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized.' });
        }
        if (payment.loanStatus !== 'active') {
            return res.status(400).json({ success: false, message: 'This item is not currently active.' });
        }

        payment.loanStatus        = 'pending_return';
        payment.returnRequestedAt = new Date();
        await payment.save();

        res.status(200).json({ success: true, payment });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to request return', error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/payments/:id/confirm-return — owner confirms the item was returned
// ─────────────────────────────────────────────────────────────────────────────
exports.confirmReturn = async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id);
        if (!payment) return res.status(404).json({ success: false, message: 'Loan not found.' });

        if (!payment.ownerId || payment.ownerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized.' });
        }
        if (payment.loanStatus !== 'pending_return') {
            return res.status(400).json({ success: false, message: 'No pending return to confirm.' });
        }

        payment.loanStatus        = 'returned';
        payment.returnConfirmedAt = new Date();
        await payment.save();

        res.status(200).json({ success: true, payment });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to confirm return', error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/history
// ─────────────────────────────────────────────────────────────────────────────
exports.getPaymentHistory = async (req, res) => {
    try {
        const payments = await Payment.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .populate('itemId', 'name');

        res.status(200).json({ success: true, payments });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to get history', error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/unlocked/:itemId
// Checks if current user has paid to unlock a specific item
// ─────────────────────────────────────────────────────────────────────────────
exports.checkUnlocked = async (req, res) => {
    try {
        const payment = await Payment.findOne({
            userId: req.user._id,
            itemId: req.params.itemId,
            status: 'succeeded'
        });

        res.status(200).json({ success: true, unlocked: !!payment });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Check failed', error: error.message });
    }
};
