// Authentication System - ENHANCED VERSION WITH SECURITY IMPROVEMENTS

// Constants
const API_BASE_URL = self.BORROWBUDDY_CONFIG.API_BASE_URL;
const REDIRECT_DELAY_MS = 1000;
const SIGNUP_REDIRECT_DELAY_MS = 1500;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Secure hash function with salt
async function secureHash(password, salt = null) {
    // Generate salt if not provided
    if (!salt) {
        const saltBuffer = crypto.getRandomValues(new Uint8Array(16));
        salt = Array.from(saltBuffer).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return { hash, salt };
}

// Enhanced input sanitization
function sanitizeInput(input) {
    if (!input) return '';
    return input.trim()
        .replace(/[<>]/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '');
}

// Improved email validation
function isValidEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
}

// Safe localStorage operations
function safeGetFromStorage(key, defaultValue = null) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    } catch (error) {
        console.error(`Error reading from localStorage (${key}):`, error);
        return defaultValue;
    }
}

function safeSetToStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        if (error.name === 'QuotaExceededError') {
            showError('Storage quota exceeded. Please clear some data.');
        } else {
            console.error(`Error writing to localStorage (${key}):`, error);
            showError('Failed to save data. Please try again.');
        }
        return false;
    }
}

// Rate limiting for login attempts
class LoginRateLimiter {
    static getAttempts(username) {
        const attempts = safeGetFromStorage(`login_attempts_${username}`, { count: 0, timestamp: Date.now() });
        
        // Reset if lockout period has passed
        if (Date.now() - attempts.timestamp > LOCKOUT_DURATION_MS) {
            return { count: 0, timestamp: Date.now() };
        }
        
        return attempts;
    }
    
    static recordAttempt(username) {
        const attempts = this.getAttempts(username);
        attempts.count += 1;
        attempts.timestamp = Date.now();
        safeSetToStorage(`login_attempts_${username}`, attempts);
        return attempts;
    }
    
    static resetAttempts(username) {
        localStorage.removeItem(`login_attempts_${username}`);
    }
    
    static isLocked(username) {
        const attempts = this.getAttempts(username);
        return attempts.count >= MAX_LOGIN_ATTEMPTS && 
               (Date.now() - attempts.timestamp) < LOCKOUT_DURATION_MS;
    }
    
    static getRemainingLockoutTime(username) {
        const attempts = this.getAttempts(username);
        const elapsed = Date.now() - attempts.timestamp;
        const remaining = LOCKOUT_DURATION_MS - elapsed;
        return Math.ceil(remaining / 1000 / 60); // Minutes
    }
}

// Check if user is logged in
document.addEventListener('DOMContentLoaded', () => {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const currentPage = window.location.pathname;
    
    if (isLoggedIn && (currentPage.includes('login.html') || currentPage.includes('signup.html'))) {
        window.location.href = 'dashboard-enhanced.html';
    }
});

// LOGIN FORM
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const username = sanitizeInput(document.getElementById('username')?.value);
        const password = document.getElementById('password')?.value;

        if (!username || !password) {
            showError('Please fill in all fields');
            return;
        }

        // Check if account is locked
        if (LoginRateLimiter.isLocked(username)) {
            const remainingMinutes = LoginRateLimiter.getRemainingLockoutTime(username);
            showError(`Account temporarily locked. Try again in ${remainingMinutes} minutes.`);
            return;
        }

        const users = safeGetFromStorage('users', {});

        if (users[username]) {
            // Get stored password data
            const userData = users[username];
            
            // Handle both old (unsalted) and new (salted) passwords
            let isPasswordValid = false;
            
            if (userData.salt) {
                // New salted password
                const { hash } = await secureHash(password, userData.salt);
                isPasswordValid = userData.password === hash;
            } else {
                // Legacy unsalted password - auto-upgrade on successful login
                const encoder = new TextEncoder();
                const data = encoder.encode(password);
                const hashBuffer = await crypto.subtle.digest('SHA-256', data);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                const legacyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                isPasswordValid = userData.password === legacyHash;
                
                if (isPasswordValid) {
                    // Upgrade to salted password
                    const { hash, salt } = await secureHash(password);
                    users[username].password = hash;
                    users[username].salt = salt;
                    safeSetToStorage('users', users);
                }
            }
            
            if (isPasswordValid) {
                // Reset login attempts
                LoginRateLimiter.resetAttempts(username);
                
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('username', username);
                localStorage.setItem('email', users[username].email);
                localStorage.setItem('_bp', password); // temp — used once to get JWT

                // Fetch JWT token from backend (plain password is available here)
                try {
                    // Try login first
                    let tokenRes = await fetch(`${API_BASE_URL}/api/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });
                    let tokenData = await tokenRes.json();

                    // If login failed (user not in MongoDB yet), register them first
                    if (!tokenRes.ok || !tokenData.token) {
                        const userEmail = users[username].email || `${username}@borrowbuddy.local`;
                        await fetch(`${API_BASE_URL}/api/auth/register`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ username, email: userEmail, password })
                        });
                        // Now login again
                        tokenRes = await fetch(`${API_BASE_URL}/api/auth/login`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ username, password })
                        });
                        tokenData = await tokenRes.json();
                    }

                    if (tokenData.token) {
                        localStorage.setItem('authToken', tokenData.token);
                        console.log('✅ JWT token saved');
                    }
                } catch (e) {
                    console.warn('Could not fetch JWT from backend:', e.message);
                }

                showSuccess('Login successful! Redirecting...');

                setTimeout(() => {
                    window.location.href = 'dashboard-enhanced.html';
                }, REDIRECT_DELAY_MS);
            } else {
                const attempts = LoginRateLimiter.recordAttempt(username);
                const remaining = MAX_LOGIN_ATTEMPTS - attempts.count;
                
                if (remaining > 0) {
                    showError(`Invalid username or password. ${remaining} attempts remaining.`);
                } else {
                    showError('Too many failed attempts. Account locked for 15 minutes.');
                }
            }
        } else {
            // Still record attempt for non-existent users to prevent enumeration
            LoginRateLimiter.recordAttempt(username);
            showError('Invalid username or password');
        }
    });
}

// SIGNUP FORM
const signupForm = document.getElementById('signupForm');
if (signupForm) {
    signupForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const username = sanitizeInput(document.getElementById('username')?.value);
        const email = sanitizeInput(document.getElementById('email')?.value);
        const password = document.getElementById('password')?.value;
        const confirmPassword = document.getElementById('confirmPassword')?.value;
        const termsCheckbox = document.getElementById('termsAccepted');

        clearMessages();

        // Validation
        if (!username) {
            showError('Please enter a username');
            return;
        }

        if (username.length < 3) {
            showError('Username must be at least 3 characters');
            return;
        }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            showError('Username can only contain letters, numbers, and underscores');
            return;
        }

        if (!email) {
            showError('Please enter your email');
            return;
        }

        if (!isValidEmail(email)) {
            showError('Please enter a valid email');
            return;
        }

        if (!password) {
            showError('Please enter a password');
            return;
        }

        if (password.length < 8) {
            showError('Password must be at least 8 characters');
            return;
        }

        // Check password strength
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        
        if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
            showError('Password must contain uppercase, lowercase, and numbers');
            return;
        }

        if (password !== confirmPassword) {
            showError('Passwords do not match');
            return;
        }

        if (!termsCheckbox || !termsCheckbox.checked) {
            showError('Please agree to Terms & Conditions');
            return;
        }

        // Check users
        const users = safeGetFromStorage('users', {});

        if (users[username]) {
            showError('Username already taken');
            return;
        }

        // Check email - case insensitive
        const emailLower = email.toLowerCase();
        for (let key in users) {
            if (users[key].email && users[key].email.toLowerCase() === emailLower) {
                showError('Email already registered. Please login instead.');
                return;
            }
        }

        // Hash password with salt
        const { hash, salt } = await secureHash(password);

        // Create user
        users[username] = {
            username: username,
            email: email,
            password: hash,
            salt: salt,
            createdAt: new Date().toISOString()
        };

        if (!safeSetToStorage('users', users)) {
            return;
        }

        // Create profile
        const profile = {
            username: username,
            email: email,
            fullName: username,
            bio: '',
            phone: '',
            location: '',
            avatar: username.substring(0, 2).toUpperCase(),
            stats: {
                itemsBorrowed: 0,
                itemsLent: 0,
                rating: 5.0,
                reviewCount: 0
            }
        };
        safeSetToStorage(`profile_${username}`, profile);

        // Auto login
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('username', username);
        localStorage.setItem('email', email);
        localStorage.setItem('_bp', password); // temp — used once to get JWT

        // Register with backend and store JWT token (plain password available here)
        try {
            const referralCode = new URLSearchParams(window.location.search).get('ref') || localStorage.getItem('pendingReferralCode') || '';
            const regRes = await fetch(`${API_BASE_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password, referralCode })
            });
            const regData = await regRes.json();
            if (regData.token) {
                localStorage.setItem('authToken', regData.token);
            }
            localStorage.removeItem('pendingReferralCode');
        } catch (e) {
            console.warn('Backend registration failed:', e.message);
        }

        showSuccess('Account created! Redirecting...');

        setTimeout(() => {
            window.location.href = 'dashboard-enhanced.html';
        }, SIGNUP_REDIRECT_DELAY_MS);
    });
}

// Show error message
function showError(message) {
    clearMessages();

    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = `
        background: #fee2e2;
        color: #dc2626;
        padding: 1rem;
        border-radius: 8px;
        margin-bottom: 1rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        animation: slideIn 0.3s ease;
    `;
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <span>${message}</span>
    `;

    const form = document.querySelector('.auth-form');
    if (form) {
        form.insertBefore(errorDiv, form.firstChild);
    }
}

// Show success message
function showSuccess(message) {
    clearMessages();

    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.style.cssText = `
        background: #d1fae5;
        color: #059669;
        padding: 1rem;
        border-radius: 8px;
        margin-bottom: 1rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        animation: slideIn 0.3s ease;
    `;
    successDiv.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${message}</span>
    `;

    const form = document.querySelector('.auth-form');
    if (form) {
        form.insertBefore(successDiv, form.firstChild);
    }
}

// Clear messages
function clearMessages() {
    document.querySelectorAll('.error-message, .success-message').forEach(msg => {
        msg.remove();
    });
}

// Logout function with confirmation
async function logout() {
    const confirmLogout = await showConfirmDialog(
        'Are you sure you want to logout?',
        'Logout',
        'Cancel'
    );
    
    if (confirmLogout) {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('username');
        localStorage.removeItem('email');
        localStorage.removeItem('authToken');
        localStorage.removeItem('_bp');
        window.location.href = 'index.html';
    }
}

// Confirm dialog helper
function showConfirmDialog(message, confirmText = 'Confirm', cancelText = 'Cancel') {
    return new Promise((resolve) => {
        const dialog = document.createElement('div');
        dialog.className = 'confirm-dialog';
        dialog.innerHTML = `
            <div class="dialog-overlay" style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                animation: fadeIn 0.2s ease;
            ">
                <div class="dialog-content" style="
                    background: white;
                    padding: 2rem;
                    border-radius: 12px;
                    max-width: 400px;
                    width: 90%;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
                    animation: slideUp 0.3s ease;
                ">
                    <h3 style="margin: 0 0 1rem 0; color: #1f2937;">Confirm Action</h3>
                    <p style="margin: 0 0 1.5rem 0; color: #6b7280;">${message}</p>
                    <div class="dialog-actions" style="
                        display: flex;
                        gap: 1rem;
                        justify-content: flex-end;
                    ">
                        <button class="btn-cancel" style="
                            padding: 0.75rem 1.5rem;
                            border: 1px solid #d1d5db;
                            background: white;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 1rem;
                        ">${cancelText}</button>
                        <button class="btn-confirm" style="
                            padding: 0.75rem 1.5rem;
                            border: none;
                            background: #6366f1;
                            color: white;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 1rem;
                        ">${confirmText}</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        const btnConfirm = dialog.querySelector('.btn-confirm');
        const btnCancel = dialog.querySelector('.btn-cancel');
        
        btnConfirm.onclick = () => {
            dialog.remove();
            resolve(true);
        };
        
        btnCancel.onclick = () => {
            dialog.remove();
            resolve(false);
        };
    });
}

// Password toggle
document.querySelectorAll('.password-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const input = btn.previousElementSibling;
        if (input && input.type) {
            input.type = input.type === 'password' ? 'text' : 'password';
            btn.innerHTML = input.type === 'password' ? 
                '<i class="fas fa-eye"></i>' : 
                '<i class="fas fa-eye-slash"></i>';
        }
    });
});

// Password strength indicator
const passwordInput = document.getElementById('password');
if (passwordInput && document.getElementById('signupForm')) {
    const strengthIndicator = document.createElement('div');
    strengthIndicator.className = 'password-strength';
    strengthIndicator.style.cssText = 'margin-top: 0.5rem; font-size: 0.875rem;';
    passwordInput.parentNode.insertBefore(strengthIndicator, passwordInput.nextSibling);
    
    passwordInput.addEventListener('input', (e) => {
        const password = e.target.value;
        const strength = calculatePasswordStrength(password);
        
        let color, text;
        if (strength < 2) {
            color = '#ef4444';
            text = 'Weak';
        } else if (strength < 4) {
            color = '#f97316';
            text = 'Medium';
        } else {
            color = '#10b981';
            text = 'Strong';
        }
        
        strengthIndicator.innerHTML = `<span style="color: ${color};"><i class="fas fa-shield-alt"></i> Password Strength: ${text}</span>`;
    });
}

function calculatePasswordStrength(password) {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    return strength;
}

// Social handlers - Google OAuth
// ⚠️ FLOW: Frontend(5500) → Backend(5000) → Google → Backend(5000) → Frontend(5500)
const AUTH_API_URL = self.BORROWBUDDY_CONFIG.API_BASE_URL;

async function handleGoogleLogin() {
    await initiateGoogleOAuth();
}

async function handleGoogleSignup() {
    await initiateGoogleOAuth();
}

async function initiateGoogleOAuth() {
    // Show loading on button
    const googleBtns = document.querySelectorAll('.btn-google');
    googleBtns.forEach(btn => {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
    });

    try {
        // Step 1: Check if backend is running on port 5000
        const health = await fetch(`${AUTH_API_URL}/health`, { signal: AbortSignal.timeout(3000) });

        if (!health.ok) throw new Error('Backend not healthy');

        // Step 2: Backend is running — redirect to Google via backend
        console.log('✅ Backend running. Redirecting to Google OAuth...');
        window.location.href = `${AUTH_API_URL}/api/auth/google`;

    } catch (error) {

        // Restore buttons
        googleBtns.forEach(btn => {
            btn.disabled = false;
            btn.innerHTML = '<i class="fab fa-google"></i> Continue with Google';
        });

        if (error.name === 'TimeoutError' || error.message.includes('fetch') || error.message.includes('Failed')) {
            showGoogleError('backend_offline');
        } else {
            showGoogleError('unknown');
        }
    }
}

function showGoogleError(type) {
    // Remove any existing error
    document.getElementById('googleErrorBox')?.remove();

    const box = document.createElement('div');
    box.id = 'googleErrorBox';
    box.style.cssText = `
        background: #fef2f2;
        border: 2px solid #fca5a5;
        border-radius: 10px;
        padding: 1.25rem 1.5rem;
        margin: 1rem 0;
        font-size: 0.9rem;
        line-height: 1.6;
        color: #7f1d1d;
    `;

    if (type === 'backend_offline') {
        box.innerHTML = `
            <strong>⚠️ Backend Server Not Running</strong><br><br>
            You must start the backend server first:<br><br>
            <code style="background:#fee2e2;padding:4px 8px;border-radius:4px;display:block;margin:4px 0;">cd backend</code>
            <code style="background:#fee2e2;padding:4px 8px;border-radius:4px;display:block;margin:4px 0;">npm install</code>
            <code style="background:#fee2e2;padding:4px 8px;border-radius:4px;display:block;margin:4px 0;">node server.js</code>
            <br>
            <strong>Also check:</strong> Google Cloud Console → Credentials → Authorized Redirect URIs must include:<br>
            <code style="background:#fee2e2;padding:4px 8px;border-radius:4px;display:block;margin:4px 0;word-break:break-all;">http://localhost:5000/api/auth/google/callback</code>
            <small style="color:#991b1b;">❌ NOT http://localhost:5500/... — that causes the 404 error</small>
        `;
    } else {
        box.innerHTML = `<strong>❌ Google Sign-In Failed</strong><br>Please try again or use email/password login.`;
    }

    // Insert after the Google button
    const socialDiv = document.querySelector('.social-login') || document.querySelector('.btn-google')?.parentElement;
    if (socialDiv) socialDiv.after(box);
    else document.querySelector('.auth-form')?.appendChild(box);
}

// Make functions global
window.logout = logout;
window.handleGoogleLogin = handleGoogleLogin;
window.handleGoogleSignup = handleGoogleSignup;
window.showConfirmDialog = showConfirmDialog;

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateY(-10px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
    .btn-cancel:hover { background: #f3f4f6 !important; }
    .btn-confirm:hover { background: #4f46e5 !important; }
`;
document.head.appendChild(style);