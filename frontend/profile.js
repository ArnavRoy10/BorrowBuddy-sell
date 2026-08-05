// BorrowBuddy — Profile Page
const PROFILE_API = self.BORROWBUDDY_CONFIG.API_BASE_URL;

class ProfileManager {
    constructor() {
        const username = localStorage.getItem('username');
        if (!username) { window.location.href = 'login.html'; return; }
        this.token    = localStorage.getItem('authToken') || localStorage.getItem('token');
        this.username = username;
        this.user     = null;
        this.init();
    }

    async init() {
        await this.loadProfile();
        this.attachEventListeners();
        this.updateCartBadge();
    }

    async loadProfile() {
        const username = this.username;
        const email    = localStorage.getItem('email') || '';
        const saved    = JSON.parse(localStorage.getItem(`profile_${username}`) || '{}');

        const baseUser = {
            username,
            email:     saved.email     || email,
            firstName: saved.firstName || localStorage.getItem('firstName') || '',
            lastName:  saved.lastName  || localStorage.getItem('lastName')  || '',
            phone:     saved.phone     || '',
            location:  saved.location  || '',
            bio:       saved.bio       || '',
            avatar:    saved.avatar    || localStorage.getItem('avatar') || ''
        };

        this.user = baseUser;
        this.renderProfile(baseUser);

        // Enrich from backend if token available
        if (this.token) {
            try {
                const res  = await fetch(`${PROFILE_API}/api/auth/me`, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });
                const data = await res.json();
                if (res.ok && data.user) {
                    const merged = { ...baseUser, ...data.user, email: data.user.email || baseUser.email };
                    this.user = merged;
                    this.renderProfile(merged);
                    // Persist into localStorage
                    const current = JSON.parse(localStorage.getItem(`profile_${username}`) || '{}');
                    localStorage.setItem(`profile_${username}`, JSON.stringify({ ...current, ...merged }));
                    if (data.user.email) localStorage.setItem('email', data.user.email);
                }
            } catch (err) {
                console.warn('Backend profile fetch failed, using localStorage:', err.message);
            }
        }
    }

    renderProfile(user) {
        const set    = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || ''; };
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value      = val || ''; };

        const username = user.username || this.username;
        const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || username;
        const email    = user.email || localStorage.getItem('email') || '';

        // ── Display elements ─────────────────────────────────────────
        set('profileName',     fullName);   // <h1 id="profileName">
        set('profileEmail',    email);      // <span id="profileEmail">
        set('profilePhone',    user.phone    || 'Not set');
        set('profileLocation', user.location || 'Not set');
        set('profileBio',      user.bio      || 'No bio yet');
        // These may or may not exist — safe either way
        set('profileUsername', username);
        set('profileFullName', fullName);

        // Avatar
        const avatarEl = document.getElementById('profileAvatar');
        if (avatarEl) {
            if (user.avatar && user.avatar.startsWith('http')) {
                avatarEl.innerHTML = `<img src="${user.avatar}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
            } else {
                avatarEl.textContent = (user.firstName || username || 'U').charAt(0).toUpperCase();
            }
        }

        // ── Stats ────────────────────────────────────────────────────
        const borrowed = JSON.parse(localStorage.getItem(`borrowed_${username}`) || '[]');
        const lent     = JSON.parse(localStorage.getItem(`lent_${username}`)     || '[]');
        const items    = JSON.parse(localStorage.getItem(`items_${username}`)    || '[]');
        set('statBorrowed', borrowed.length);
        set('statLent',     lent.length);

        let totalStars = 0, totalReviews = 0;
        items.forEach(item => {
            const reviews = JSON.parse(localStorage.getItem('reviews_' + (item.id || item._id)) || '[]');
            reviews.forEach(r => { totalStars += (r.rating || 0); totalReviews++; });
        });
        set('statRating', totalReviews > 0 ? (totalStars / totalReviews).toFixed(1) : '—');

        // ── Form fields (personalInfoForm) ───────────────────────────
        // Only pre-fill if the field is not currently focused (don't interrupt typing)
        const active = document.activeElement;
        const fillIfNotFocused = (id, val) => {
            const el = document.getElementById(id);
            if (el && el !== active) el.value = val || '';
        };
        fillIfNotFocused('fullName', fullName);
        fillIfNotFocused('phone',    user.phone    || '');
        fillIfNotFocused('bio',      user.bio      || '');
        setVal('email', email); // always fill email (disabled field)
    }

    attachEventListeners() {
        const form = document.getElementById('personalInfoForm');
        if (form) form.addEventListener('submit', (e) => this.saveProfile(e));

        // Also support modal form if present
        const editForm = document.getElementById('editProfileForm');
        if (editForm) editForm.addEventListener('submit', (e) => this.saveProfile(e));

        document.querySelectorAll('[onclick*="logout"], .logout-btn, #logoutBtn').forEach(btn => {
            btn.onclick = () => this.logout();
        });
    }

    async saveProfile(e) {
        e.preventDefault();
        const username = this.username;

        // ── Read form values ─────────────────────────────────────────
        const fullNameVal = (document.getElementById('fullName')?.value || '').trim();
        const nameParts   = fullNameVal.split(/\s+/);
        const firstName   = nameParts[0] || this.user?.firstName || '';
        const lastName    = nameParts.slice(1).join(' ') || this.user?.lastName || '';

        const phone    = (document.getElementById('phone')?.value    || '').trim();
        const bio      = (document.getElementById('bio')?.value      || '').trim();
        const location = (document.getElementById('location')?.value || '').trim();

        // Guard: if fullName is empty, keep existing name
        const payload = {
            firstName: firstName || this.user?.firstName || '',
            lastName:  lastName  || '',
            phone,
            bio,
            location
        };

        const saveBtn = e.target.querySelector('button[type="submit"]');
        if (saveBtn) {
            saveBtn.disabled    = true;
            saveBtn.innerHTML   = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        }

        // ── 1. Update in-memory user immediately ─────────────────────
        this.user = { ...this.user, ...payload };

        // ── 2. Save to localStorage ──────────────────────────────────
        const savedKey = `profile_${username}`;
        const existing = JSON.parse(localStorage.getItem(savedKey) || '{}');
        const updated  = {
            ...existing,
            ...payload,
            username,
            email: existing.email || localStorage.getItem('email') || ''
        };
        localStorage.setItem(savedKey, JSON.stringify(updated));

        // ── 3. Re-render with new values ─────────────────────────────
        this.renderProfile(this.user);

        // ── 4. Try backend ───────────────────────────────────────────
        if (this.token) {
            try {
                const res  = await fetch(`${PROFILE_API}/api/auth/updateprofile`, {
                    method:  'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                    body:    JSON.stringify(payload)
                });
                const data = await res.json();
                if (res.ok && data.user) {
                    this.user = { ...this.user, ...data.user };
                    localStorage.setItem(savedKey, JSON.stringify({ ...updated, ...data.user }));
                    this.renderProfile(this.user);
                } else {
                    console.warn('Backend updateprofile:', data.message);
                }
            } catch (err) {
                console.warn('Backend save failed, saved locally:', err.message);
            }
        }

        // ── 5. Show success on button ────────────────────────────────
        if (saveBtn) {
            saveBtn.disabled  = false;
            saveBtn.innerHTML = '<i class="fas fa-check"></i> Saved!';
            saveBtn.style.background = '#10b981';
            setTimeout(() => {
                saveBtn.innerHTML        = '<i class="fas fa-save"></i> Save Changes';
                saveBtn.style.background = '';
            }, 2000);
        }

        // Close modal if one is open
        document.getElementById('editProfileModal')?.classList.add('hidden');
    }

    updateCartBadge() {
        const cart  = JSON.parse(localStorage.getItem('cart') || '[]');
        const badge = document.getElementById('cartBadge');
        if (badge) {
            badge.textContent  = cart.length;
            badge.style.display = cart.length > 0 ? 'inline-block' : 'none';
        }
    }

    logout() {
        ['token','authToken','username','isLoggedIn','_bp'].forEach(k => localStorage.removeItem(k));
        window.location.href = 'index.html';
    }
}

document.addEventListener('DOMContentLoaded', () => { new ProfileManager(); });
window.logout = () => {
    ['token','authToken','username','isLoggedIn','_bp'].forEach(k => localStorage.removeItem(k));
    window.location.href = 'index.html';
};