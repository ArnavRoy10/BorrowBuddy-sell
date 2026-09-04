# BorrowBuddy

A peer-to-peer item lending/borrowing web app — browse items, borrow from your community,
list your own items to lend, chat with owners, and manage transactions, all with a
premium animated UI.

- **Frontend:** Vanilla HTML, CSS, JavaScript — no framework, no build step, no bundler.
  Just static files you can open, edit, or upload anywhere.
- **Backend:** Node.js + Express + MongoDB (Mongoose), with JWT auth, Google OAuth,
  Razorpay payments, Cloudinary image uploads, and email notifications.

---

## 1. What you need before you start

You'll need free accounts with these services (all have generous free tiers):

| Service | What it's for | Get it at |
|---|---|---|
| MongoDB Atlas | Database | https://www.mongodb.com/cloud/atlas |
| Razorpay | Payments (deposits, service fees) | https://dashboard.razorpay.com/app/keys |
| Cloudinary | Item photo uploads | https://console.cloudinary.com |
| Gmail (or any SMTP) | Notification emails | Use a Gmail [App Password](https://myaccount.google.com/apppasswords), not your real password |
| Google Cloud Console | *(Optional)* "Sign in with Google" | https://console.cloud.google.com/apis/credentials |
| Twilio | *(Optional)* SMS/phone verification | https://www.twilio.com |

You'll also need [Node.js](https://nodejs.org) (v18 or newer) installed.

---

## 2. Backend setup

```bash
cd backend
npm install
```

Copy the example environment file and fill in your own values:

```bash
cp .env.example .env
```

Open `.env` and fill in every `REQUIRED` value (MongoDB URI, JWT secrets, Razorpay keys,
Cloudinary credentials, email). Leave `OPTIONAL` values (Google OAuth, Twilio) as `dummy`
if you don't need those features yet — the app works fine without them.

Start the backend:

```bash
npm start          # production
npm run dev         # development, auto-restarts on file changes (requires nodemon)
```

By default it runs on `http://localhost:5000`.

---

## 3. Frontend setup

The frontend is plain static files — no `npm install`, no build step.

**Point it at your backend:** open `frontend/config.js` and confirm the URL matches
where your backend is running:

```js
self.BORROWBUDDY_CONFIG = {
    API_BASE_URL: 'http://localhost:5000'   // change this if you deploy the backend elsewhere
};
```

**Run it locally:** you can't just double-click the HTML files (the browser will block
some features due to `file://` restrictions). Serve the folder instead:

```bash
cd frontend
npx serve .
# or: python3 -m http.server 5500
# or use the VS Code "Live Server" extension
```

Then open the served address (e.g. `http://localhost:5500` or `http://localhost:3000`)
in your browser. Start at `index.html`.

---

## 4. Deploying

- **Backend:** any Node host works (Render, Railway, Fly.io, etc.). Set all the same
  environment variables from your `.env` file in your host's dashboard — don't upload
  the `.env` file itself.
- **Frontend:** any static host works (Vercel, Netlify, GitHub Pages, Render static site,
  etc.). After deploying, update `frontend/config.js`'s `API_BASE_URL` to your deployed
  backend's URL.
- Update `FRONTEND_URL` in the backend's environment variables to match your deployed
  frontend's URL (used for CORS and email links).

---

## 5. Project structure

```
BorrowBuddy-sell-main/
├── backend/
│   ├── config/         # DB connection, passport/OAuth config
│   ├── controllers/     # Route handler logic
│   ├── middleware/      # Auth, error handling, uploads
│   ├── models/           # Mongoose schemas
│   ├── routes/           # API endpoints
│   ├── utils/            # Helpers (email, tokens, etc.)
│   ├── .env.example
│   └── server.js
└── frontend/
    ├── index.html         # Landing page
    ├── browse.html        # Browse/search items
    ├── item-details.html  # Single item view
    ├── dashboard-enhanced.html
    ├── login.html / signup.html
    ├── my-items.html / my-lent.html / my-borrowed.html
    ├── cart.html / checkout.html / payment.html
    ├── messages.html / chat.html
    ├── settings.html / profile.html
    ├── ... (37 pages total)
    ├── styles.css          # Core sitewide styles
    ├── premium.css/.js     # Shared animation/visual effects layer
    ├── config.js           # ← Only file you need to edit to change the API URL
    └── manifest.json / sw.js   # PWA support (installable, works offline)
```

---

## 6. Notes

- This is a **multi-page site** (real `.html` files with normal navigation), not a
  single-page app — no client-side router to configure.
- The frontend is a installable **PWA**: it has a manifest and service worker, so it can
  be "installed" on mobile/desktop and has basic offline support.
- No secrets are included anywhere in this package — `backend/.env` is git-ignored and
  was never included; only `.env.example` (placeholders) is provided.

---

## License

This code is sold for your use per the terms of the marketplace you purchased it from.
See your purchase/license terms for what's permitted (personal use, resale, etc.).
