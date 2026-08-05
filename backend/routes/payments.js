const express = require('express');
const router  = express.Router();

const {
    getConfig,
    createOrder,
    verifyPayment,
    getPaymentHistory,
    checkUnlocked
} = require('../controllers/paymentController');

const { protect } = require('../middleware/auth');

// Public — frontend needs the key ID on load
router.get('/config', getConfig);

// Protected — user must be logged in
router.post('/create-order',    protect, createOrder);
router.post('/verify',          protect, verifyPayment);
router.get('/history',          protect, getPaymentHistory);
router.get('/unlocked/:itemId', protect, checkUnlocked);

module.exports = router;