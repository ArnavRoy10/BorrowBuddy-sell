const mongoose = require('mongoose');

const disputeMessageSchema = new mongoose.Schema({
    sender:   { type: String, required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text:     { type: String, required: true },
    isStaff:  { type: Boolean, default: false }
}, { timestamps: true, _id: true });

const disputeSchema = new mongoose.Schema({
    requestId:   { type: String },
    itemId:      { type: String },
    itemName:    { type: String, required: true },
    itemImage:   { type: String },

    raisedBy:    { type: String, required: true },
    raisedById:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    against:     { type: String },
    againstId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    type: {
        type: String,
        enum: ['damaged', 'lost', 'not_returned', 'not_as_described', 'late_return', 'refund', 'other'],
        required: true
    },
    description:     { type: String, required: true },
    refundRequested: { type: Boolean, default: false },
    amountRequested: { type: Number, default: 0 },
    evidence:        [{ type: String }], // data URLs / image URLs

    status: {
        type: String,
        enum: ['open', 'under_review', 'resolved', 'rejected', 'withdrawn'],
        default: 'open'
    },

    resolution: {
        outcome:      { type: String, enum: ['refund_full', 'refund_partial', 'no_refund', 'replacement', null], default: null },
        refundAmount: { type: Number, default: 0 },
        note:         { type: String, default: '' },
        resolvedBy:   { type: String, default: '' },
        resolvedAt:   { type: Date, default: null }
    },

    messages: [disputeMessageSchema]
}, { timestamps: true });

disputeSchema.index({ raisedById: 1, createdAt: -1 });
disputeSchema.index({ againstId: 1, createdAt: -1 });

module.exports = mongoose.model('Dispute', disputeSchema);