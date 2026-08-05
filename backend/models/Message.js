const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    // Both participant IDs stored as strings (sorted) for easy querying
    participants: {
        type: [String],
        required: true,
        validate: {
            validator: (arr) => arr.length === 2,
            message: 'A message must have exactly 2 participants'
        }
    },

    itemId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Item'
    },

    itemName: {
        type: String,
        default: ''
    },

    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    senderUsername: {
        type: String,
        required: true
    },

    text: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000
    },

    // Whether this message was sent after the borrower completed payment
    sentAfterPayment: {
        type: Boolean,
        default: false
    },

    // Whether the message content was flagged/filtered
    wasFiltered: {
        type: Boolean,
        default: false
    },

    read: {
        type: Boolean,
        default: false
    }

}, { timestamps: true });

// Indexes for fast conversation & inbox queries
messageSchema.index({ participants: 1, itemId: 1, createdAt: 1 });
messageSchema.index({ participants: 1, read: 1, senderId: 1 });

module.exports = mongoose.model('Message', messageSchema);