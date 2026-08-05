// BorrowBuddy — Phone OTP Verification Widget
// Include this after profile.js on profile.html

const PHONE_VERIFY_API = self.BORROWBUDDY_CONFIG.API_BASE_URL + '/api/auth';

document.addEventListener('DOMContentLoaded', () => {
    // Wait briefly for profile.js to finish rendering the profile first
    setTimeout(injectVerificationBadge, 600);
});

function getAuthToken() {
    return localStorage.getItem('authToken') || localStorage.getItem('token');
}

// ── Inject badge next to the Phone Number label on the profile form ─
function injectVerificationBadge() {
    const phoneLabel = document.querySelector('label[for="phone"]');
    if (!phoneLabel || document.getElementById('phoneVerifyBadge')) return;

    const username = localStorage.getItem('username');
    const profile  = JSON.parse(localStorage.getItem(`profile_${username}`) || '{}');
    const isVerified = profile.phoneVerified === true;

    const badge = document.createElement('span');
    badge.id = 'phoneVerifyBadge';
    badge.style.cssText = `
        display:inline-flex;align-items:center;gap:.3rem;
        margin-left:.5rem;padding:.15rem .55rem;border-radius:20px;
        font-size:.7rem;font-weight:700;cursor:${isVerified ? 'default' : 'pointer'};
        background:${isVerified ? '#d1fae5' : '#fef3c7'};
        color:${isVerified ? '#059669' : '#92400e'};
        border:1px solid ${isVerified ? '#6ee7b7' : '#fde68a'};
        transition:opacity .15s;
    `;
    badge.innerHTML = isVerified
        ? `<i class="fas fa-check-circle"></i> Verified`
        : `<i class="fas fa-exclamation-circle"></i> Verify Phone`;

    if (!isVerified) {
        badge.addEventListener('mouseenter', () => badge.style.opacity = '.8');
        badge.addEventListener('mouseleave', () => badge.style.opacity = '1');
        badge.addEventListener('click', openVerifyModal);
    }

    phoneLabel.appendChild(badge);

    // Also fetch live status from backend to stay in sync
    refreshVerificationStatus();
}

async function refreshVerificationStatus() {
    const token = getAuthToken();
    if (!token) return;
    try {
        const res  = await fetch(`${PHONE_VERIFY_API}/me`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (res.ok && data.user) {
            const username = localStorage.getItem('username');
            const key      = `profile_${username}`;
            const existing = JSON.parse(localStorage.getItem(key) || '{}');
            localStorage.setItem(key, JSON.stringify({ ...existing, phoneVerified: data.user.phoneVerified }));

            // Update badge if status differs from what's shown
            const badge = document.getElementById('phoneVerifyBadge');
            if (badge && data.user.phoneVerified) {
                badge.style.background = '#d1fae5';
                badge.style.color      = '#059669';
                badge.style.borderColor= '#6ee7b7';
                badge.style.cursor     = 'default';
                badge.innerHTML = `<i class="fas fa-check-circle"></i> Verified`;
                badge.replaceWith(badge.cloneNode(true)); // strips click listener
            }
        }
    } catch (e) { /* silent fail — badge just won't update live */ }
}

// ── Verification Modal ──────────────────────────────────────────────
function openVerifyModal() {
    if (document.getElementById('phoneVerifyModal')) return;

    const phoneInput = document.getElementById('phone') || document.getElementById('editPhone');
    const currentPhone = phoneInput?.value || JSON.parse(localStorage.getItem(`profile_${localStorage.getItem('username')}`) || '{}').phone || '';

    const modal = document.createElement('div');
    modal.id = 'phoneVerifyModal';
    modal.style.cssText = `
        position:fixed;inset:0;z-index:99999;
        background:rgba(15,23,42,.7);backdrop-filter:blur(4px);
        display:flex;align-items:center;justify-content:center;padding:1rem;
    `;
    modal.innerHTML = `
        <div style="background:white;border-radius:20px;width:100%;max-width:400px;padding:2rem;box-shadow:0 32px 80px rgba(0,0,0,.35);text-align:center">
            <div style="font-size:2.5rem;margin-bottom:.5rem">📱</div>
            <h2 style="margin:0 0 .5rem;color:#1f2937;font-size:1.2rem">Verify Your Phone</h2>
            <p style="color:#6b7280;font-size:.85rem;margin-bottom:1.5rem;line-height:1.5">
                We'll send a 6-digit code to confirm this number and add a verified badge to your profile.
            </p>

            <div id="verifyStep1">
                <input type="tel" id="verifyPhoneInput" value="${currentPhone}" placeholder="+91 98765 43210"
                    style="width:100%;padding:.75rem;border:1.5px solid #e5e7eb;border-radius:10px;font-size:1rem;text-align:center;outline:none;margin-bottom:1rem">
                <div id="sendOtpError" style="color:#ef4444;font-size:.8rem;margin-bottom:.75rem;display:none"></div>
                <button id="sendOtpBtn" style="width:100%;padding:.8rem;background:linear-gradient(135deg,#2563eb,#7c3aed);color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:.95rem">
                    <i class="fas fa-paper-plane"></i> Send Verification Code
                </button>
            </div>

            <div id="verifyStep2" style="display:none">
                <p style="font-size:.8rem;color:#6b7280;margin-bottom:1rem" id="otpSentTo"></p>
                <div style="display:flex;gap:.5rem;justify-content:center;margin-bottom:1rem">
                    <input type="text" id="otpDigits" maxlength="6" placeholder="000000"
                        style="width:160px;padding:.75rem;border:1.5px solid #e5e7eb;border-radius:10px;font-size:1.4rem;text-align:center;letter-spacing:.5rem;outline:none;font-weight:700">
                </div>
                <div id="verifyOtpError" style="color:#ef4444;font-size:.8rem;margin-bottom:.75rem;display:none"></div>
                <button id="verifyOtpBtn" style="width:100%;padding:.8rem;background:#10b981;color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:.95rem;margin-bottom:.6rem">
                    <i class="fas fa-check"></i> Verify Code
                </button>
                <button id="resendOtpBtn" style="width:100%;padding:.6rem;background:none;border:none;color:#2563eb;font-weight:600;cursor:pointer;font-size:.82rem">
                    Didn't receive it? Resend
                </button>
            </div>

            <button id="closeVerifyModal" style="margin-top:1rem;background:none;border:none;color:#9ca3af;font-size:.82rem;cursor:pointer">Cancel</button>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('closeVerifyModal').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.getElementById('sendOtpBtn').addEventListener('click', handleSendOtp);
    document.getElementById('resendOtpBtn').addEventListener('click', handleResendOtp);
    document.getElementById('verifyOtpBtn').addEventListener('click', handleVerifyOtp);

    document.getElementById('otpDigits')?.addEventListener('input', e => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
    });
}

async function handleSendOtp() {
    const phone = document.getElementById('verifyPhoneInput').value.trim();
    const errEl = document.getElementById('sendOtpError');
    errEl.style.display = 'none';

    if (!phone || phone.replace(/\D/g, '').length < 8) {
        errEl.textContent = 'Please enter a valid phone number';
        errEl.style.display = 'block';
        return;
    }

    const btn = document.getElementById('sendOtpBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

    try {
        const res  = await fetch(`${PHONE_VERIFY_API}/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
            body: JSON.stringify({ phone })
        });
        const data = await res.json();

        if (!res.ok) {
            errEl.textContent = data.message || 'Failed to send OTP';
            errEl.style.display = 'block';
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Verification Code';
            return;
        }

        document.getElementById('verifyStep1').style.display = 'none';
        document.getElementById('verifyStep2').style.display = 'block';
        document.getElementById('otpSentTo').textContent = data.dev
            ? `Dev mode: check your backend console for the OTP`
            : `Code sent to ${phone}`;
        document.getElementById('otpDigits').focus();

    } catch (e) {
        errEl.textContent = 'Network error. Please try again.';
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Verification Code';
    }
}

async function handleResendOtp() {
    const btn = document.getElementById('resendOtpBtn');
    btn.disabled = true;
    btn.textContent = 'Resending...';

    try {
        const res  = await fetch(`${PHONE_VERIFY_API}/resend-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` }
        });
        const data = await res.json();
        document.getElementById('otpSentTo').textContent = data.dev
            ? 'Dev mode: check your backend console for the new OTP'
            : 'New code sent!';
    } catch(e) {}

    btn.disabled = false;
    btn.textContent = "Didn't receive it? Resend";
}

async function handleVerifyOtp() {
    const otp   = document.getElementById('otpDigits').value.trim();
    const errEl = document.getElementById('verifyOtpError');
    errEl.style.display = 'none';

    if (otp.length !== 6) {
        errEl.textContent = 'Please enter the 6-digit code';
        errEl.style.display = 'block';
        return;
    }

    const btn = document.getElementById('verifyOtpBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';

    try {
        const res  = await fetch(`${PHONE_VERIFY_API}/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
            body: JSON.stringify({ otp })
        });
        const data = await res.json();

        if (!res.ok) {
            errEl.textContent = data.message || 'Verification failed';
            errEl.style.display = 'block';
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check"></i> Verify Code';
            return;
        }

        // Success — update localStorage and badge
        const username = localStorage.getItem('username');
        const key      = `profile_${username}`;
        const existing = JSON.parse(localStorage.getItem(key) || '{}');
        localStorage.setItem(key, JSON.stringify({ ...existing, phoneVerified: true }));

        document.getElementById('phoneVerifyModal').remove();
        showSuccessToast();

        // Refresh badge
        document.getElementById('phoneVerifyBadge')?.remove();
        injectVerificationBadge();

    } catch (e) {
        errEl.textContent = 'Network error. Please try again.';
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check"></i> Verify Code';
    }
}

function showSuccessToast() {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);
        background:#10b981;color:white;padding:.9rem 1.5rem;border-radius:12px;
        font-weight:700;font-size:.9rem;z-index:99999;
        box-shadow:0 8px 30px rgba(0,0,0,.2);white-space:nowrap;
    `;
    toast.innerHTML = '<i class="fas fa-check-circle"></i> Phone number verified! ✓';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}