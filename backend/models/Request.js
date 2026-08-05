const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
    itemId:          { type: String, required: true },
    itemName:        { type: String, required: true },
    itemImage:       { type: String },
    itemOwner:       { type: String, required: true },
    itemOwnerId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    requestedBy:     { type: String, required: true },
    requestedById:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    fromDate:        { type: Date, required: true },
    toDate:          { type: Date, required: true },
    duration:        { type: Number, required: true },
    price:           { type: String, default: 'Free' },
    totalPrice:      { type: String, default: 'Free' },
    securityDeposit: { type: Number, default: 0 },
    message:         { type: String, default: '' },
    status: {
        type:    String,
        enum:    ['pending', 'approved', 'rejected', 'completed', 'cancelled'],
        default: 'pending'
    }
}, { timestamps: true });

module.exports = mongoose.model('Request', requestSchema);