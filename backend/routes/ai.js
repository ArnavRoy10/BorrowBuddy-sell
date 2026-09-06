const express = require('express');
const router  = express.Router();
const { chat } = require('../controllers/aiController');

// Public — the assistant widget appears even for logged-out visitors on the
// landing page, and it only ever answers general app questions, no account data.
router.post('/chat', chat);

module.exports = router;
