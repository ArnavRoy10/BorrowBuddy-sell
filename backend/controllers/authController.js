const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '7d'
    });
};

// Send token response with cookie
const sendTokenResponse = (user, statusCode, res) => {
    const token = generateToken(user._id);

    const options = {
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // HTTPS in production
        sameSite: 'lax'
    };

    res
        .status(statusCode)
        .cookie('token', token, options)
        .json({
            success: true,
            token,
            user: user.getPublicProfile()
        });
};

// @desc    Register user (local)
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
    try {
        const { username, email, password, firstName, lastName, referralCode } = req.body;

        // Validation
        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide username, email, and password'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters'
            });
        }

        // Check if user exists
        const existingUser = await User.findOne({ 
            $or: [{ email }, { username }] 
        });

        if (existingUser) {
            if (existingUser.email === email) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already registered'
                });
            }
            return res.status(400).json({
                success: false,
                message: 'Username already taken'
            });
        }

        // ── Validate referral code (if provided) ────────────────────
        let referrer = null;
        if (referralCode) {
            referrer = await User.findOne({ referralCode: referralCode.trim().toUpperCase() });
        }

        // Create user
        const user = await User.create({
            username,
            email,
            password,
            firstName,
            lastName,
            provider: 'local',
            referredBy: referrer ? referrer.referralCode : null
        });

        // ── Award points to both parties on successful signup ───────
        const SIGNUP_BONUS_NEW_USER = 100; // points for the new user
        const SIGNUP_BONUS_REFERRER = 100; // points for whoever referred them

        if (referrer) {
            user.creditsBalance = SIGNUP_BONUS_NEW_USER;
            await user.save();

            referrer.creditsBalance   = (referrer.creditsBalance || 0) + SIGNUP_BONUS_REFERRER;
            referrer.referralCount    = (referrer.referralCount || 0) + 1;
            await referrer.save();

            console.log(`🎁 Referral bonus: ${referrer.username} +${SIGNUP_BONUS_REFERRER} points, ${user.username} +${SIGNUP_BONUS_NEW_USER} points`);
        }

        console.log('✅ New user registered:', user.username);
        sendTokenResponse(user, 201, res);
    } catch (error) {
        console.error('❌ Register Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during registration'
        });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validation
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide username and password'
            });
        }

        // Find user by username or email
        const user = await User.findOne({
            $or: [{ username }, { email: username }]
        }).select('+password');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if user has password (social login users might not)
        if (!user.password) {
            return res.status(401).json({
                success: false,
                message: `This account was created with ${user.provider}. Please login with ${user.provider}.`
            });
        }

        // Check password
        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Update last login
        user.lastLogin = Date.now();
        await user.save();

        console.log('✅ User logged in:', user.username);
        sendTokenResponse(user, 200, res);
    } catch (error) {
        console.error('❌ Login Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login'
        });
    }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');

        res.status(200).json({
            success: true,
            user: user.getPublicProfile()
        });
    } catch (error) {
        console.error('❌ Get Me Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Update user profile
// @route   PUT /api/auth/updateprofile
// @access  Private
exports.updateProfile = async (req, res) => {
    try {
        const { firstName, lastName, phone, location, bio } = req.body;

        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Update fields if provided
        if (firstName !== undefined) user.firstName = firstName;
        if (lastName !== undefined) user.lastName = lastName;
        if (phone !== undefined) user.phone = phone;
        if (location !== undefined) user.location = location;
        if (bio !== undefined) user.bio = bio;

        await user.save();

        res.status(200).json({
            success: true,
            user: user.getPublicProfile()
        });
    } catch (error) {
        console.error('❌ Update Profile Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
exports.logout = (req, res) => {
    res.cookie('token', 'none', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true
    });

    res.status(200).json({
        success: true,
        message: 'Logged out successfully'
    });
};

// @desc    Delete account
// @route   DELETE /api/auth/deleteaccount
// @access  Private
exports.deleteAccount = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        await user.deleteOne();

        res.cookie('token', 'none', {
            expires: new Date(Date.now() + 10 * 1000),
            httpOnly: true
        });

        res.status(200).json({
            success: true,
            message: 'Account deleted successfully'
        });
    } catch (error) {
        console.error('❌ Delete Account Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};