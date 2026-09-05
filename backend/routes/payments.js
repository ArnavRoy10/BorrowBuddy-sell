const express = require('express');
const router  = express.Router();

const {
    getConfig,
    createOrder,
    verifyPayment,
    getPaymentHistory,
    checkUnlocked,
    getBorrowed,
    getLent,
    requestReturn,
    confirmReturn
} = require('../controllers/paymentController');

const { protect } = require('../middleware/auth');

// Public — frontend needs the key ID on load
router.get('/config', getConfig);

// Protected — user must be logged in
router.post('/create-order',    protect, createOrder);
router.post('/verify',          protect, verifyPayment);
router.get('/history',          protect, getPaymentHistory);
router.get('/unlocked/:itemId', protect, checkUnlocked);

// Loan lifecycle — real server-side return flow (fixes owner never receiving the request)
router.get('/borrowed',              protect, getBorrowed);
router.get('/lent',                  protect, getLent);
router.put('/:id/request-return',    protect, requestReturn);
router.put('/:id/confirm-return',    protect, confirmReturn);

module.exports = router;
