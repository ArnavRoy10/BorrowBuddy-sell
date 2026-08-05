const express  = require('express');
const router   = express.Router();
const { ObjectId } = require('mongodb');
const { getDB } = require('../config/database');

const COLLECTION = 'items';

// ── GET all available items (public) ─────────────────────────────
router.get('/', async (req, res) => {
    try {
        const db    = getDB();
        // Match items that are NOT explicitly marked unavailable/borrowed/paused —
        // handles both boolean false/true and any legacy string values.
        const query = {
            $and: [
                { $or: [{ available: { $exists: false } }, { available: true }, { available: { $nin: [false, 'false'] } }] },
                { $or: [{ borrowed:  { $exists: false } }, { borrowed:  false }, { borrowed:  { $nin: [true, 'true'] } }] },
                { $or: [{ active:    { $exists: false } }, { active:    true }, { active:    { $nin: [false, 'false'] } }] },
                { status: { $ne: 'paused' } }
            ]
        };

        if (req.query.category && req.query.category !== 'all')
            query.category = req.query.category;

        const items = await db.collection(COLLECTION)
            .find(query)
            .sort({ createdAt: -1 })
            .toArray();

        const normalised = items.map(i => ({ ...i, id: i._id.toString() }));
        res.json({ success: true, items: normalised });
    } catch (err) {
        console.error('GET /items error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET my items (public, filtered by username query param) ──────
router.get('/my-items', async (req, res) => {
    try {
        const db       = getDB();
        const username = req.query.username;
        if (!username) return res.status(400).json({ success: false, message: 'username query param required' });

        const items = await db.collection(COLLECTION)
            .find({ owner: username })
            .sort({ createdAt: -1 })
            .toArray();

        const normalised = items.map(i => ({ ...i, id: i._id.toString() }));
        res.json({ success: true, items: normalised });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── GET single item by ID (public) ───────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const db   = getDB();
        let item   = null;

        if (ObjectId.isValid(req.params.id)) {
            item = await db.collection(COLLECTION).findOne({ _id: new ObjectId(req.params.id) });
        }
        if (!item) {
            item = await db.collection(COLLECTION).findOne({ id: req.params.id });
        }
        if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

        res.json({ success: true, item: { ...item, id: item._id.toString() } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── POST create item ──────────────────────────────────────────────
router.post('/', async (req, res) => {
    try {
        const db   = getDB();
        const item = {
            ...req.body,
            owner:     req.body.owner || 'unknown',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await db.collection(COLLECTION).insertOne(item);
        const saved  = { ...item, _id: result.insertedId, id: result.insertedId.toString() };

        res.status(201).json({ success: true, item: saved });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── PUT update item (owner verified by username in body) ─────────
router.put('/:id', async (req, res) => {
    try {
        const db = getDB();
        const username = req.body.username || req.query.username;
        if (!username) return res.status(400).json({ success: false, message: 'username is required' });

        const filter = ObjectId.isValid(req.params.id)
            ? { _id: new ObjectId(req.params.id) }
            : { id: req.params.id };

        const existing = await db.collection(COLLECTION).findOne(filter);
        if (!existing) return res.status(404).json({ success: false, message: 'Item not found' });
        if (existing.owner !== username)
            return res.status(403).json({ success: false, message: 'Not authorized' });

        const { username: _u, ...updateFields } = req.body;
        const update = { $set: { ...updateFields, updatedAt: new Date() } };
        await db.collection(COLLECTION).updateOne(filter, update);

        res.json({ success: true, message: 'Item updated' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── DELETE item (owner verified by username in body or query) ────
router.delete('/:id', async (req, res) => {
    try {
        const db = getDB();
        const username = req.body.username || req.query.username;
        if (!username) return res.status(400).json({ success: false, message: 'username is required' });

        const filter = ObjectId.isValid(req.params.id)
            ? { _id: new ObjectId(req.params.id) }
            : { id: req.params.id };

        const existing = await db.collection(COLLECTION).findOne(filter);
        if (!existing) return res.status(404).json({ success: false, message: 'Item not found' });
        if (existing.owner !== username)
            return res.status(403).json({ success: false, message: 'Not authorized' });

        await db.collection(COLLECTION).deleteOne(filter);
        res.json({ success: true, message: 'Item deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;