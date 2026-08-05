const Razorpay = require('razorpay');
const crypto   = require('crypto');
const Payment  = require('../models/Payment');

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
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, itemId } = req.body;

        // Verify signature using HMAC SHA256
        const body      = razorpay_order_id + '|' + razorpay_payment_id;
        const expected  = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex');

        if (expected !== razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }

        // Update payment in MongoDB to succeeded
        const payment = await Payment.findOneAndUpdate(
            { orderId: razorpay_order_id, userId: req.user._id },
            {
                status:        'succeeded',
                transactionId: razorpay_payment_id,
                paidAt:        new Date()
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
            itemId:    itemId || payment.itemId
        });

    } catch (error) {
        console.error('Verify Payment Error:', error);
        res.status(500).json({ success: false, message: 'Verification failed', error: error.message });
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