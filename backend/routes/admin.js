const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const Admin   = require('../models/Admin');
const User    = require('../models/User');
const { getDB } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'borrowbuddy_secret';

// ── Middleware: verify admin JWT ──────────────────────────────────
async function adminAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer '))
        return res.status(401).json({ success: false, message: 'No admin token' });

    try {
        const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
        if (decoded.type !== 'admin')
            return res.status(401).json({ success: false, message: 'Not an admin token' });
        const admin = await Admin.findById(decoded.id).select('-password');
        if (!admin || !admin.isActive)
            return res.status(401).json({ success: false, message: 'Admin not found or inactive' });
        req.admin = admin;
        next();
    } catch (e) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
}

// ── Middleware: require a specific power ──────────────────────────
function requirePower(power) {
    return (req, res, next) => {
        if (req.admin.role === 'super_admin') return next();
        if (!req.admin.powers.includes(power))
            return res.status(403).json({ success: false, message: `Missing permission: ${power}` });
        next();
    };
}

// ── POST /api/admin/login ─────────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ success: false, message: 'Email and password required' });

        const admin = await Admin.findOne({ email: email.toLowerCase() });
        if (!admin || !admin.isActive)
            return res.status(401).json({ success: false, message: 'Invalid credentials' });

        const ok = await admin.matchPassword(password);
        if (!ok)
            return res.status(401).json({ success: false, message: 'Invalid credentials' });

        admin.lastLogin = new Date();
        await admin.save();

        const token = jwt.sign(
            { id: admin._id, type: 'admin', role: admin.role },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            success: true,
            token,
            admin: {
                id:       admin._id,
                name:     admin.name,
                email:    admin.email,
                role:     admin.role,
                powers:   admin.powers,
                isActive: admin.isActive
            }
        });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── GET /api/admin/me ─────────────────────────────────────────────
router.get('/me', adminAuth, (req, res) => {
    res.json({ success: true, admin: req.admin });
});

// ── GET /api/admin/admins — list all admins ───────────────────────
router.get('/admins', adminAuth, requirePower('manage_admins'), async (req, res) => {
    try {
        const admins = await Admin.find().select('-password').sort({ createdAt: -1 });
        res.json({ success: true, admins });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── POST /api/admin/admins — create admin ─────────────────────────
router.post('/admins', adminAuth, requirePower('manage_admins'), async (req, res) => {
    try {
        const { name, email, password, role, powers } = req.body;
        if (!name || !email || !password)
            return res.status(400).json({ success: false, message: 'Name, email, password required' });

        const exists = await Admin.findOne({ email: email.toLowerCase() });
        if (exists)
            return res.status(409).json({ success: false, message: 'Email already registered' });

        const admin = await Admin.create({
            name, email, password,
            role:      role      || 'viewer',
            powers:    powers    || [],
            createdBy: req.admin.email
        });

        res.status(201).json({
            success: true,
            admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role, powers: admin.powers, isActive: admin.isActive }
        });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── PUT /api/admin/admins/:id — update admin ──────────────────────
router.put('/admins/:id', adminAuth, requirePower('manage_admins'), async (req, res) => {
    try {
        const { name, role, powers, isActive, password } = req.body;
        const admin = await Admin.findById(req.params.id);
        if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

        if (name)     admin.name     = name;
        if (role)     admin.role     = role;
        if (powers)   admin.powers   = powers;
        if (typeof isActive === 'boolean') admin.isActive = isActive;
        if (password) admin.password = password;

        await admin.save();
        res.json({ success: true, admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role, powers: admin.powers, isActive: admin.isActive } });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── DELETE /api/admin/admins/:id ──────────────────────────────────
router.delete('/admins/:id', adminAuth, requirePower('manage_admins'), async (req, res) => {
    try {
        if (req.admin._id.toString() === req.params.id)
            return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
        await Admin.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Admin deleted' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── GET /api/admin/users — list all users ────────────────────────
router.get('/users', adminAuth, requirePower('view_users'), async (req, res) => {
    try {
        const { search, page = 1, limit = 20 } = req.query;
        const query = search
            ? { $or: [{ username: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }] }
            : {};
        const users = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));
        const total = await User.countDocuments(query);
        res.json({ success: true, users, total, page: Number(page) });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── GET /api/admin/users/:id — full user detail ───────────────────
router.get('/users/:id', adminAuth, requirePower('view_users'), async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const db = getDB();
        const items = await db.collection('items').find({ owner: user.username }).toArray();

        let requests = [];
        try {
            requests = await db.collection('requests')
                .find({ $or: [{ requestedBy: user.username }, { itemOwner: user.username }] })
                .sort({ createdAt: -1 }).limit(10).toArray();
        } catch (e) { /* requests collection may not exist yet */ }

        res.json({
            success: true,
            user,
            itemsListed: items.length,
            items: items.map(i => ({ ...i, id: i._id.toString() })),
            recentRequests: requests
        });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── DELETE /api/admin/users/:id ──────────────────────────────────
router.delete('/users/:id', adminAuth, requirePower('delete_users'), async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'User deleted' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── GET /api/admin/items ─────────────────────────────────────────
router.get('/items', adminAuth, requirePower('view_items'), async (req, res) => {
    try {
        const db    = getDB();
        const { search, page = 1, limit = 20 } = req.query;
        const query = search ? { $or: [{ name: new RegExp(search, 'i') }, { owner: new RegExp(search, 'i') }] } : {};
        const items = await db.collection('items').find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * Number(limit))
            .limit(Number(limit))
            .toArray();
        const total = await db.collection('items').countDocuments(query);
        res.json({ success: true, items: items.map(i => ({ ...i, id: i._id.toString() })), total });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── DELETE /api/admin/items/:id ──────────────────────────────────
router.delete('/items/:id', adminAuth, requirePower('delete_items'), async (req, res) => {
    try {
        const db = getDB();
        const { ObjectId } = require('mongodb');
        await db.collection('items').deleteOne({ _id: new ObjectId(req.params.id) });
        res.json({ success: true, message: 'Item deleted' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── GET /api/admin/transactions — aggregate payment activity ──────
// Reads from a "payments" collection if it exists. If your app has been
// recording payments only in each user's browser localStorage (no
// server-side Payment collection), this returns an empty list with a
// clear message rather than erroring.
router.get('/transactions', adminAuth, requirePower('view_payments'), async (req, res) => {
    try {
        const db = getDB();
        const { search, page = 1, limit = 20 } = req.query;

        const collections = await db.listCollections({ name: 'payments' }).toArray();
        if (!collections.length) {
            return res.json({
                success: true,
                transactions: [],
                total: 0,
                stats: { totalVolume: 0, totalDeposits: 0, count: 0 },
                message: 'No "payments" collection found yet. Payments recorded only in browser localStorage are not visible here.'
            });
        }

        const query = search
            ? { $or: [
                { itemName:  new RegExp(search, 'i') },
                { username:  new RegExp(search, 'i') },
                { paymentId: new RegExp(search, 'i') }
              ] }
            : {};

        const transactions = await db.collection('payments').find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * Number(limit))
            .limit(Number(limit))
            .toArray();

        const total = await db.collection('payments').countDocuments(query);

        const allPayments   = await db.collection('payments').find({}).toArray();
        const totalVolume   = allPayments.reduce((s, p) => s + (p.amount || 0), 0);
        const totalDeposits = allPayments.reduce((s, p) => s + (p.securityDeposit || 0), 0);

        res.json({
            success: true,
            transactions,
            total,
            stats: { totalVolume, totalDeposits, count: allPayments.length }
        });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── GET /api/admin/stats ─────────────────────────────────────────
router.get('/stats', adminAuth, requirePower('view_reports'), async (req, res) => {
    try {
        const db         = getDB();
        const totalUsers = await User.countDocuments();
        const totalItems = await db.collection('items').countDocuments();
        const totalReqs  = await db.collection('requests').countDocuments().catch(() => 0);
        const totalPaid  = await db.collection('payments').countDocuments().catch(() => 0);
        res.json({ success: true, stats: { totalUsers, totalItems, totalRequests: totalReqs, totalPayments: totalPaid } });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

module.exports = router;
module.exports.adminAuth = adminAuth;