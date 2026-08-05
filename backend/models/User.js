const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 50
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        minlength: 6
        // Not required because OAuth users won't have passwords
    },
    firstName: {
        type: String,
        trim: true
    },
    lastName: {
        type: String,
        trim: true
    },
    avatar: {
        type: String,
        default: function() {
            return `https://ui-avatars.com/api/?name=${this.firstName || 'User'}+${this.lastName || ''}&background=667eea&color=fff`;
        }
    },
    provider: {
        type: String,
        enum: ['local', 'google', 'facebook'],
        default: 'local'
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true // Allows multiple null values
    },
    facebookId: {
        type: String,
        unique: true,
        sparse: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date
    },
    // Additional fields for BorrowBuddy functionality
    phone: {
        type: String,
        trim: true
    },
    phoneVerified: {
        type: Boolean,
        default: false
    },
    phoneOtp: {
        type: String,
        select: false // never returned in normal queries
    },
    phoneOtpExpires: {
        type: Date,
        select: false
    },
    phoneOtpAttempts: {
        type: Number,
        default: 0,
        select: false
    },
    location: {
        type: String,
        trim: true
    },
    bio: {
        type: String,
        maxlength: 500
    },
    // ── Referral system ──────────────────────────────────────────
    referralCode: {
        type: String,
        unique: true,
        sparse: true
    },
    referredBy: {
        type: String, // referralCode of the user who invited them
        default: null
    },
    creditsBalance: {
        type: Number,
        default: 0
    },
    referralCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Hash password before saving (only if password is modified)
userSchema.pre('save', async function(next) {
    // Only hash if password is modified (or new)
    if (!this.isModified('password')) {
        return next();
    }
    
    // Don't hash if no password (OAuth users)
    if (!this.password) {
        return next();
    }
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Auto-generate a unique referral code for new users
userSchema.pre('save', async function(next) {
    if (!this.isNew || this.referralCode) return next();

    const base = (this.username || 'user').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    let code = `${base}${Math.floor(1000 + Math.random() * 9000)}`;

    // Ensure uniqueness (very unlikely to collide, but check anyway)
    const Model = this.constructor;
    let exists = await Model.findOne({ referralCode: code });
    while (exists) {
        code = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
        exists = await Model.findOne({ referralCode: code });
    }

    this.referralCode = code;
    next();
});

// Method to compare passwords
userSchema.methods.matchPassword = async function(enteredPassword) {
    if (!this.password) {
        return false;
    }
    return await bcrypt.compare(enteredPassword, this.password);
};

// Method to get public profile
userSchema.methods.getPublicProfile = function() {
    return {
        id: this._id,
        username: this.username,
        email: this.email,
        firstName: this.firstName,
        lastName: this.lastName,
        avatar: this.avatar,
        provider: this.provider,
        isVerified: this.isVerified,
        phone: this.phone,
        phoneVerified: this.phoneVerified,
        location: this.location,
        bio: this.bio,
        referralCode: this.referralCode,
        creditsBalance: this.creditsBalance,
        referralCount: this.referralCount,
        createdAt: this.createdAt
    };
};

module.exports = mongoose.model('User', userSchema);