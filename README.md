# BorrowBuddy

A peer-to-peer item lending/borrowing web app — browse items, borrow from your community,
list your own items to lend, chat with owners, and manage transactions.

- **Frontend:** Vanilla HTML, CSS, JavaScript — no framework, no build step.
- **Backend:** Node.js + Express + MongoDB (Mongoose), with JWT auth, Google OAuth,
  Razorpay payments, Cloudinary image uploads, and email notifications.

This guide walks through getting BorrowBuddy **fully live on the internet** —
a real backend, a real frontend, both publicly accessible.

---

## Before you start

Create free accounts with these services and keep the credentials handy:

| Service | What it's for | Get it at |
|---|---|---|
| GitHub | Hosting your code so Render/Vercel can deploy it | https://github.com |
| MongoDB Atlas | Database | https://www.mongodb.com/cloud/atlas |
| Render | Hosting the backend | https://render.com |
| Vercel (or Netlify) | Hosting the frontend | https://vercel.com |
| Razorpay | Payments (deposits, service fees) | https://dashboard.razorpay.com/app/keys |
| Cloudinary | Item photo uploads | https://console.cloudinary.com |
| Gmail | Notification emails — use an [App Password](https://myaccount.google.com/apppasswords), not your real one | — |
| Google Cloud Console | *(Optional)* "Sign in with Google" | https://console.cloud.google.com/apis/credentials |
| Twilio | *(Optional)* SMS/phone verification | https://www.twilio.com |

---

## 1. Push the code to GitHub

```bash
cd BorrowBuddy-sell-main
git init
git add .
git commit -m "Initial commit"
```

Create a new (empty) repository on GitHub, then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

---

## 2. Deploy the backend — Render

1. Go to Render → **New** → **Web Service** → connect your GitHub repo.
2. **Root directory:** `backend`
3. **Build command:** `npm install`
4. **Start command:** `npm start`
5. Under **Environment**, add every variable from `backend/.env.example`, filled in
   with your real values:
   - `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRE`, `SESSION_SECRET` (required)
   - `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (required for payments)
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_UPLOAD_PRESET` (required for photo uploads)
   - `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM_NAME` (required for notification emails)
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` — leave as
     `dummy` if you don't need Google sign-in yet
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` — optional
   - **Leave `FRONTEND_URL` blank for now** — you'll come back and set it in step 4.
6. Deploy. Once it's live, copy the URL Render gives you —
   e.g. `https://your-backend.onrender.com`. You'll need this next.

---

## 3. Point the frontend at your backend

Open `frontend/config.js`:

```js
self.BORROWBUDDY_CONFIG = {
    API_BASE_URL: 'https://your-backend.onrender.com'   // ← your real Render URL from step 2
};
```

---

## 4. Deploy the frontend — Vercel

1. Go to Vercel → **Add New** → **Project** → import the same GitHub repo.
2. **Root directory:** `frontend`
3. **Framework preset:** Other (it's static files — no build command needed).
4. Deploy. Copy the URL you get — e.g. `https://your-app.vercel.app`.

*(Netlify, GitHub Pages, or any static host work the same way — the only
requirement is that the whole `frontend/` folder is served as-is.)*

---

## 5. Connect the two — fix CORS

Your backend only accepts requests from origins it explicitly allows
(see `backend/server.js`). Right now your live frontend isn't on that list yet.

1. Go back to your Render backend → **Environment**.
2. Set `FRONTEND_URL` = your Vercel URL from step 4 (exact match — same
   `https://`, no trailing slash).
3. Save. Render will redeploy automatically with the new value.

---

## 6. Test it

- Open your Vercel URL.
- Sign up for a test account.
- Browse items, try listing an item with a photo, add something to cart.
- If anything fails silently, open your browser's dev tools → **Network** tab and
  look for CORS errors — almost always caused by step 5 being skipped or the
  URLs not matching exactly.

---

## Redeploying after changes

- **Backend or frontend code changes:** just `git push` — both Render and Vercel
  auto-deploy on push to your connected branch.
- **Changed an environment variable:** update it in Render's dashboard directly;
  no `.env` file is ever uploaded or committed.

---

## Project structure

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
    ├── index.html              # Landing page
    ├── browse.html             # Browse/search items
    ├── item-details.html       # Single item view
    ├── dashboard-enhanced.html # User dashboard
    ├── login.html / signup.html
    ├── my-items.html / my-lent.html / my-borrowed.html
    ├── cart.html / checkout.html / payment.html
    ├── messages.html / chat.html
    ├── settings.html / profile.html
    ├── ... (37 pages total)
    ├── styles.css              # Core sitewide styles
    ├── premium.css / premium.js  # Shared animation/visual effects layer
    ├── config.js                # ← Edit this to change which backend the site talks to
    └── manifest.json / sw.js     # PWA support (installable, works offline)
```
