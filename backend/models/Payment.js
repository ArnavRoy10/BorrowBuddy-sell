const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    itemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Item'
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'inr',
        enum: ['usd', 'inr', 'eur', 'gbp']
    },
    provider: {
        type: String,
        enum: ['stripe', 'razorpay', 'paypal'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'succeeded', 'failed', 'refunded', 'cancelled'],
        default: 'pending'
    },
    type: {
        type: String,
        enum: ['deposit', 'service_fee', 'late_fee', 'damage_fee', 'rental'],
        required: true
    },

    // Razorpay fields
    orderId:       String,   // Razorpay order ID (order_xxx)
    transactionId: String,   // Razorpay payment ID (pay_xxx)

    metadata: {
        itemName:     String,
        borrowerName: String,
        lenderName:   String,
        description:  String
    },

    refundAmount: Number,
    refundReason: String,
    refundedAt:   Date,
    errorMessage: String,
    errorCode:    String,
    paidAt:       Date

}, { timestamps: true });

paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ orderId: 1 });
paymentSchema.index({ itemId: 1, userId: 1, status: 1 });

module.exports = mongoose.model('Payment', paymentSchema);