// BorrowBuddy — Referral System (Points-based)
// Include on: signup.html (captures ?ref= code) AND dashboard-enhanced.html (share widget)

const REFERRAL_API = self.BORROWBUDDY_CONFIG.API_BASE_URL + '/api/auth';

// ── Capture referral code from URL on ANY page, store for later ────
(function captureReferralCode() {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) {
        localStorage.setItem('pendingReferralCode', ref.toUpperCase());
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    // ── On signup.html: show banner if a referral code is pending ──
    const banner = document.getElementById('referralBanner');
    if (banner) {
        const pendingCode = new URLSearchParams(window.location.search).get('ref') || localStorage.getItem('pendingReferralCode');
        if (pendingCode) {
            fetch(`${REFERRAL_API}/validate-referral/${pendingCode}`)
                .then(r => r.json())
                .then(data => {
                    if (data.valid) {
                        document.getElementById('referrerNameText').textContent = data.referrerName;
                        banner.style.display = 'block';
                    }
                })
                .catch(() => {});
        }
    }

    // ── On dashboard/profile: inject the "Invite & Earn" widget ────
    injectReferralWidget();

    // ── On EVERY page: inject a persistent points badge in navbar ──
    injectPointsBadge();
    setTimeout(injectPointsBadge, 500);
    setTimeout(injectPointsBadge, 1000);
});

// ── Persistent points badge — shows on every page's navbar ──────────
async function injectPointsBadge() {
    if (document.getElementById('pointsBadgeNav')) return;
    const token = getAuthToken();
    if (!token) return;

    const navMenu = document.querySelector('#navMenu, .nav-menu, .navbar .nav-container > div:last-child');
    if (!navMenu) return;

    const badge = document.createElement('div');
    badge.id = 'pointsBadgeNav';
    badge.title = 'Your BorrowBuddy points — click to view';
    badge.style.cssText = `
        display:flex;align-items:center;gap:.35rem;cursor:pointer;
        padding:.35rem .7rem;border-radius:20px;
        background:linear-gradient(135deg,#fef3c7,#fde68a);
        color:#92400e;font-weight:700;font-size:.8rem;
        margin:0 .35rem;transition:transform .15s;
    `;
    badge.innerHTML = `<i class="fas fa-star" style="font-size:.75rem"></i> <span id="pointsBadgeValue">…</span>`;
    badge.addEventListener('mouseenter', () => badge.style.transform = 'scale(1.05)');
    badge.addEventListener('mouseleave', () => badge.style.transform = 'scale(1)');
    badge.addEventListener('click', () => { window.location.href = 'dashboard-enhanced.html#referralWidgetContainer'; });

    // Insert near the start of the nav menu (before Logout, after other links)
    const logoutLink = navMenu.querySelector('a[onclick*="logout"], a[href*="logout"]');
    if (logoutLink) navMenu.insertBefore(badge, logoutLink);
    else navMenu.appendChild(badge);

    try {
        const res  = await fetch(`${REFERRAL_API}/referral-stats`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (res.ok) {
            document.getElementById('pointsBadgeValue').textContent = data.creditsBalance;
        }
    } catch (e) { /* leave as … if it fails */ }
}

function getAuthToken() {
    return localStorage.getItem('authToken') || localStorage.getItem('token');
}

// ── Inject referral widget wherever #referralWidgetContainer exists ─
async function injectReferralWidget() {
    const container = document.getElementById('referralWidgetContainer');
    if (!container) return;

    const token = getAuthToken();
    if (!token) return;

    container.innerHTML = `
        <div style="background:white;border:1px solid #e5e7eb;border-radius:16px;padding:1.5rem;text-align:center">
            <i class="fas fa-spinner fa-spin" style="color:#2563eb;font-size:1.5rem"></i>
        </div>`;

    try {
        const res  = await fetch(`${REFERRAL_API}/referral-stats`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (!res.ok) { container.innerHTML = ''; return; }

        const referralLink = `${window.location.origin}/signup.html?ref=${data.referralCode}`;
        const canUnlock     = data.creditsBalance >= 100;
        const unlocksReady  = Math.floor(data.creditsBalance / 100);

        container.innerHTML = `
        <div style="background:linear-gradient(135deg,#2563eb,#7c3aed);border-radius:16px;padding:1.5rem;color:white">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
                <div>
                    <div style="font-size:1.05rem;font-weight:700">🎁 Invite Friends, Earn Points</div>
                    <div style="font-size:.8rem;opacity:.85;margin-top:.2rem">Get 100 points for every friend who joins</div>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:1.25rem">
                <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:.75rem;text-align:center">
                    <div style="font-size:1.4rem;font-weight:800"><i class="fas fa-star" style="font-size:1rem;margin-right:.2rem"></i>${data.creditsBalance}</div>
                    <div style="font-size:.7rem;opacity:.8">Points Balance</div>
                </div>
                <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:.75rem;text-align:center">
                    <div style="font-size:1.4rem;font-weight:800">${data.referralCount}</div>
                    <div style="font-size:.7rem;opacity:.8">Friends Joined</div>
                </div>
            </div>

            <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:.6rem .875rem;font-size:.78rem;margin-bottom:1rem;text-align:center">
                ${canUnlock
                    ? `⚡ You can unlock <strong>${unlocksReady}</strong> item${unlocksReady!==1?'s':''} instantly using points — no payment needed!`
                    : `⚡ Earn ${100 - data.creditsBalance} more points to unlock an item instantly for free`
                }
            </div>

            <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:.6rem .875rem;display:flex;align-items:center;gap:.6rem;margin-bottom:.875rem">
                <input readonly id="referralLinkInput" value="${referralLink}" style="
                    flex:1;background:none;border:none;color:white;font-size:.8rem;outline:none;
                    text-overflow:ellipsis;overflow:hidden;white-space:nowrap;
                ">
                <button id="copyReferralBtn" style="
                    background:white;color:#2563eb;border:none;padding:.4rem .8rem;
                    border-radius:8px;font-weight:700;font-size:.75rem;cursor:pointer;flex-shrink:0;
                ">
                    <i class="fas fa-copy"></i> Copy
                </button>
            </div>

            <div style="display:flex;gap:.5rem">
                <button id="shareWhatsAppBtn" style="
                    flex:1;padding:.6rem;background:#25D366;color:white;border:none;border-radius:10px;
                    font-weight:700;font-size:.82rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:.4rem;
                ">
                    <i class="fab fa-whatsapp"></i> Share
                </button>
                <button id="shareNativeBtn" style="
                    flex:1;padding:.6rem;background:rgba(255,255,255,.2);color:white;border:1px solid rgba(255,255,255,.3);border-radius:10px;
                    font-weight:700;font-size:.82rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:.4rem;
                ">
                    <i class="fas fa-share-alt"></i> More
                </button>
            </div>

            <div style="font-size:.72rem;opacity:.7;margin-top:.875rem;text-align:center">
                Your code: <strong style="letter-spacing:.05em">${data.referralCode}</strong>
            </div>
        </div>`;

        document.getElementById('copyReferralBtn').addEventListener('click', () => {
            navigator.clipboard.writeText(referralLink).then(() => {
                const btn = document.getElementById('copyReferralBtn');
                btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy"></i> Copy'; }, 2000);
            });
        });

        document.getElementById('shareWhatsAppBtn').addEventListener('click', () => {
            const text = encodeURIComponent(`Hey! Join me on BorrowBuddy — a great way to borrow and lend items in our community. Sign up with my link and we both get 100 bonus points! ${referralLink}`);
            window.open(`https://wa.me/?text=${text}`, '_blank');
        });

        document.getElementById('shareNativeBtn').addEventListener('click', () => {
            if (navigator.share) {
                navigator.share({
                    title: 'Join me on BorrowBuddy!',
                    text: 'Sign up with my referral link and we both get 100 bonus points!',
                    url: referralLink
                }).catch(() => {});
            } else {
                navigator.clipboard.writeText(referralLink);
                alert('Link copied to clipboard!');
            }
        });

    } catch (e) {
        container.innerHTML = '';
        console.warn('Referral widget failed to load:', e.message);
    }
}