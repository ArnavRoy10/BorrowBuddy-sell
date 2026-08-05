/**
 * BorrowBuddy — Central Configuration
 * ------------------------------------
 * This is the ONLY file you need to edit to point the frontend at your backend.
 * Every other file reads BORROWBUDDY_CONFIG.API_BASE_URL instead of hardcoding a URL.
 *
 * Local development (default): leave as-is if your backend runs on port 5000.
 * Production: change API_BASE_URL to your deployed backend's URL, e.g.
 *   API_BASE_URL: 'https://api.yourapp.com'
 *
 * Uses `self` instead of `window` so this file also works when loaded inside
 * the service worker (sw.js), which has no `window` object.
 */
self.BORROWBUDDY_CONFIG = {
    API_BASE_URL: 'http://localhost:5000'
};
