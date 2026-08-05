const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const fetch    = global.fetch || require('node-fetch');

// In-memory storage — files never touch disk, straight to Cloudinary
const upload = multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: 8 * 1024 * 1024 }, // 8MB per file
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed'));
    }
});

const CLOUD_NAME    = process.env.CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET; // unsigned preset

// ── POST /api/upload/images — accepts up to 5 images, returns Cloudinary URLs ──
router.post('/images', upload.array('images', 5), async (req, res) => {
    try {
        if (!CLOUD_NAME || !UPLOAD_PRESET) {
            return res.status(500).json({
                success: false,
                message: 'Cloudinary not configured. Set CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET in .env'
            });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'No images provided' });
        }

        const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

        const uploadPromises = req.files.map(async (file) => {
            const base64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

            const form = new URLSearchParams();
            form.append('file', base64);
            form.append('upload_preset', UPLOAD_PRESET);

            const cloudRes = await fetch(uploadUrl, {
                method: 'POST',
                body:   form
            });

            const cloudData = await cloudRes.json();
            if (!cloudRes.ok) throw new Error(cloudData.error?.message || 'Cloudinary upload failed');

            return {
                url:       cloudData.secure_url,
                publicId:  cloudData.public_id,
                width:     cloudData.width,
                height:    cloudData.height
            };
        });

        const results = await Promise.all(uploadPromises);

        res.json({
            success: true,
            images:  results.map(r => r.url),
            details: results
        });
    } catch (err) {
        console.error('Upload error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ── DELETE /api/upload/images — remove an image by Cloudinary public_id ────────
router.delete('/images/:publicId', async (req, res) => {
    try {
        if (!CLOUD_NAME) return res.status(500).json({ success: false, message: 'Cloudinary not configured' });

        // Note: deleting requires signed request (API key + secret) — only do this
        // server-side if you've set CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET
        const apiKey    = process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;
        if (!apiKey || !apiSecret) {
            return res.status(501).json({ success: false, message: 'Image deletion not configured (missing API key/secret)' });
        }

        const crypto    = require('crypto');
        const publicId  = decodeURIComponent(req.params.publicId);
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = crypto.createHash('sha1')
            .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
            .digest('hex');

        const form = new URLSearchParams();
        form.append('public_id', publicId);
        form.append('timestamp', timestamp);
        form.append('api_key',   apiKey);
        form.append('signature', signature);

        const delRes  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`, {
            method: 'POST', body: form
        });
        const delData = await delRes.json();

        res.json({ success: delData.result === 'ok', result: delData.result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;