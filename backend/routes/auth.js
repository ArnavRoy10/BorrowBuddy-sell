const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const router = express.Router();

const { 
    register, 
    login, 
    getMe, 
    logout,
    updateProfile,
    deleteAccount
} = require('../controllers/authController');

const { protect } = require('../middleware/auth');
const User = require('../models/User');
const { generateOtp, sendOtpSms } = require('../utils/smsService');

// ==================== PHONE OTP VERIFICATION ====================

// @route   POST /api/auth/send-otp
// @desc    Generate and send a 6-digit OTP to the user's phone
router.post('/send-otp', protect, async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone || phone.trim().length < 8) {
            return res.status(400).json({ success: false, message: 'Please provide a valid phone number' });
        }

        const otp       = generateOtp();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        const user = await User.findById(req.user._id);
        user.phone            = phone.trim();
        user.phoneOtp         = otp;
        user.phoneOtpExpires  = expiresAt;
        user.phoneOtpAttempts = 0;
        user.phoneVerified    = false; // reset verification if phone number changes
        await user.save();

        const smsResult = await sendOtpSms(phone, otp);

        res.json({
            success: true,
            message: smsResult.dev
                ? 'OTP generated (check backend console — SMS not configured)'
                : 'OTP sent to your phone',
            dev: !!smsResult.dev
        });
    } catch (err) {
        console.error('Send OTP error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// @route   POST /api/auth/verify-otp
// @desc    Verify the 6-digit OTP and mark phone as verified
router.post('/verify-otp', protect, async (req, res) => {
    try {
        const { otp } = req.body;
        if (!otp) return res.status(400).json({ success: false, message: 'OTP is required' });

        const user = await User.findById(req.user._id).select('+phoneOtp +phoneOtpExpires +phoneOtpAttempts');
        if (!user.phoneOtp) {
            return res.status(400).json({ success: false, message: 'No OTP was requested. Please request a new one.' });
        }

        if (user.phoneOtpAttempts >= 5) {
            return res.status(429).json({ success: false, message: 'Too many attempts. Please request a new OTP.' });
        }

        if (new Date() > user.phoneOtpExpires) {
            user.phoneOtp = undefined;
            await user.save();
            return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
        }

        if (user.phoneOtp !== otp.toString().trim()) {
            user.phoneOtpAttempts = (user.phoneOtpAttempts || 0) + 1;
            await user.save();
            return res.status(400).json({
                success: false,
                message: `Incorrect OTP. ${5 - user.phoneOtpAttempts} attempt(s) remaining.`
            });
        }

        // ── Success ──────────────────────────────────────────────────
        user.phoneVerified    = true;
        user.phoneOtp         = undefined;
        user.phoneOtpExpires  = undefined;
        user.phoneOtpAttempts = 0;
        await user.save();

        res.json({ success: true, message: 'Phone number verified successfully!', phoneVerified: true });
    } catch (err) {
        console.error('Verify OTP error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// @route   POST /api/auth/resend-otp
// @desc    Resend OTP to the currently-set phone number
router.post('/resend-otp', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user.phone) {
            return res.status(400).json({ success: false, message: 'No phone number on file. Please add one first.' });
        }

        const otp       = generateOtp();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        user.phoneOtp         = otp;
        user.phoneOtpExpires  = expiresAt;
        user.phoneOtpAttempts = 0;
        await user.save();

        const smsResult = await sendOtpSms(user.phone, otp);

        res.json({
            success: true,
            message: smsResult.dev ? 'OTP resent (check console)' : 'OTP resent to your phone',
            dev: !!smsResult.dev
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ==================== REFERRAL SYSTEM ====================

// @route   GET /api/auth/referral-stats
// @desc    Get the logged-in user's referral code, credits, and count
router.get('/referral-stats', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        res.json({
            success: true,
            referralCode:   user.referralCode,
            creditsBalance: user.creditsBalance || 0,
            referralCount:  user.referralCount || 0
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// @route   GET /api/auth/validate-referral/:code
// @desc    Check if a referral code is valid (used on signup page)
router.get('/validate-referral/:code', async (req, res) => {
    try {
        const user = await User.findOne({ referralCode: req.params.code.trim().toUpperCase() });
        if (!user) return res.json({ success: true, valid: false });
        res.json({ success: true, valid: true, referrerName: user.firstName || user.username });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// @route   POST /api/auth/redeem-points
// @desc    Spend points on instant unlock (or other future rewards)
router.post('/redeem-points', protect, async (req, res) => {
    try {
        const { amount = 100, reason = 'instant_unlock', itemId } = req.body;

        const user = await User.findById(req.user._id);
        const balance = user.creditsBalance || 0;

        if (balance < amount) {
            return res.status(400).json({
                success: false,
                message: `Not enough points. You have ${balance}, need ${amount}.`
            });
        }

        user.creditsBalance = balance - amount;
        await user.save();

        console.log(`⭐ ${user.username} redeemed ${amount} points for ${reason}${itemId ? ` (item: ${itemId})` : ''}`);

        res.json({
            success: true,
            message: 'Points redeemed successfully',
            newBalance: user.creditsBalance
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ==================== REGULAR AUTH ROUTES ====================

// @route   POST /api/auth/register
router.post('/register', register);

// @route   POST /api/auth/login
router.post('/login', login);

// @route   GET /api/auth/me
router.get('/me', protect, getMe);

// @route   PUT /api/auth/updateprofile
router.put('/updateprofile', protect, updateProfile);

// @route   POST /api/auth/logout
router.post('/logout', logout);

// @route   DELETE /api/auth/deleteaccount
router.delete('/deleteaccount', protect, deleteAccount);

// ==================== GOOGLE OAUTH ROUTES ====================

// @desc    Initiate Google OAuth
// @route   GET /api/auth/google
// @access  Public
router.get('/google',
    passport.authenticate('google', { 
        scope: ['profile', 'email'],
        session: false
    })
);

// @desc    Google OAuth callback
// @route   GET /api/auth/google/callback
// @access  Public
router.get('/google/callback',
    passport.authenticate('google', { 
        failureRedirect: `${process.env.FRONTEND_URL}/login.html?error=google_auth_failed`,
        session: false 
    }),
    (req, res) => {
        try {
            // Generate JWT token
            const token = jwt.sign(
                { id: req.user._id }, 
                process.env.JWT_SECRET, 
                { expiresIn: process.env.JWT_EXPIRE }
            );

            console.log('✅ Google OAuth successful for:', req.user.email);

            // Set cookie
            res.cookie('token', token, {
                expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax'
            });

            // Redirect to frontend with token
            res.redirect(`${process.env.FRONTEND_URL}/auth-success.html?token=${token}`);
        } catch (error) {
            console.error('❌ Google callback error:', error);
            res.redirect(`${process.env.FRONTEND_URL}/login.html?error=server_error`);
        }
    }
);


module.exports = router;