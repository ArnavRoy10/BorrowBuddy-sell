// =================================================================
// BORROWBUDDY AUTHENTICATION - WITH OAUTH SUPPORT
// =================================================================

// Configuration - Update this URL to match your backend
const BACKEND_URL = self.BORROWBUDDY_CONFIG.API_BASE_URL;

// Constants
const REDIRECT_DELAY_MS = 1000;
const SIGNUP_REDIRECT_DELAY_MS = 1500;

// =================================================================
// OAUTH HANDLERS
// =================================================================

// Google OAuth Handler
function handleGoogleLogin() {
    console.log('🔐 Initiating Google OAuth...');
    window.location.href = `${BACKEND_URL}/api/auth/google`;
}

function handleGoogleSignup() {
    console.log('🔐 Initiating Google OAuth...');
    window.location.href = `${BACKEND_URL}/api/auth/google`;
}

// Facebook OAuth Handler
function handleFacebookLogin() {
    console.log('🔐 Initiating Facebook OAuth...');
    window.location.href = `${BACKEND_URL}/api/auth/facebook`;
}

function handleFacebookSignup() {
    console.log('🔐 Initiating Facebook OAuth...');
    window.location.href = `${BACKEND_URL}/api/auth/facebook`;
}

// =================================================================
// UTILITY FUNCTIONS
// =================================================================

// Input sanitization
function sanitizeInput(input) {
    if (!input) return '';
    return input.trim()
        .replace(/[<>]/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '');
}

// Email validation
function isValidEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
}

// Show error message
function showError(message) {
    clearMessages();

    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = `
        background: #fee2e2;
        color: #991b1b;
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

// =================================================================
// LOGIN FORM HANDLER
// =================================================================

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

        try {
            const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (data.success) {
                // Store authentication data
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('username', data.user.username);
                localStorage.setItem('email', data.user.email);
                localStorage.setItem('userId', data.user._id || data.user.id || '');
                
                if (data.user.firstName) localStorage.setItem('firstName', data.user.firstName);
                if (data.user.lastName) localStorage.setItem('lastName', data.user.lastName);
                if (data.user.avatar) localStorage.setItem('avatar', data.user.avatar);

                showSuccess('Login successful! Redirecting...');

                setTimeout(() => {
                    window.location.href = 'dashboard-enhanced.html';
                }, REDIRECT_DELAY_MS);
            } else {
                showError(data.message || 'Login failed. Please try again.');
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('Unable to connect to server. Please try again later.');
        }
    });
}

// =================================================================
// SIGNUP FORM HANDLER
// =================================================================

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
            showError('Please enter a valid email address');
            return;
        }

        if (!password) {
            showError('Please enter a password');
            return;
        }

        if (password.length < 6) {
            showError('Password must be at least 6 characters');
            return;
        }

        if (password !== confirmPassword) {
            showError('Passwords do not match');
            return;
        }

        if (!termsCheckbox || !termsCheckbox.checked) {
            showError('Please accept the Terms & Conditions');
            return;
        }

        try {
            const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();

            if (data.success) {
                // Store authentication data
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('username', data.user.username);
                localStorage.setItem('email', data.user.email);
                localStorage.setItem('userId', data.user._id || data.user.id || '');
                
                if (data.user.firstName) localStorage.setItem('firstName', data.user.firstName);
                if (data.user.lastName) localStorage.setItem('lastName', data.user.lastName);
                if (data.user.avatar) localStorage.setItem('avatar', data.user.avatar);

                showSuccess('Account created successfully! Redirecting...');

                setTimeout(() => {
                    window.location.href = 'dashboard-enhanced.html';
                }, SIGNUP_REDIRECT_DELAY_MS);
            } else {
                showError(data.message || 'Registration failed. Please try again.');
            }
        } catch (error) {
            console.error('Signup error:', error);
            showError('Unable to connect to server. Please try again later.');
        }
    });
}

// =================================================================
// PAGE LOAD CHECK
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const currentPage = window.location.pathname;
    
    if (isLoggedIn && (currentPage.includes('login.html') || currentPage.includes('signup.html'))) {
        window.location.href = 'dashboard-enhanced.html';
    }
});

// =================================================================
// LOGOUT FUNCTION
// =================================================================

async function logout() {
    const confirmLogout = confirm('Are you sure you want to logout?');
    
    if (confirmLogout) {
        try {
            // Call backend logout endpoint
            await fetch(`${BACKEND_URL}/api/auth/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                credentials: 'include'
            });
        } catch (error) {
            console.error('Logout error:', error);
        }

        // Clear local storage
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('username');
        localStorage.removeItem('email');
        localStorage.removeItem('authToken');
        localStorage.removeItem('firstName');
        localStorage.removeItem('lastName');
        localStorage.removeItem('avatar');
        
        window.location.href = 'index.html';
    }
}

// =================================================================
// PASSWORD TOGGLE
// =================================================================

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

// =================================================================
// PASSWORD STRENGTH INDICATOR
// =================================================================

const passwordInput = document.getElementById('password');
if (passwordInput && document.getElementById('signupForm')) {
    passwordInput.addEventListener('input', (e) => {
        const password = e.target.value;
        const strength = calculatePasswordStrength(password);
        
        const strengthIndicator = document.getElementById('passwordStrength');
        if (!strengthIndicator) return;

        const strengthBar = strengthIndicator.querySelector('.strength-bar');
        const strengthText = strengthIndicator.querySelector('.strength-text');
        
        let color, text, width;
        if (strength < 2) {
            color = '#ef4444';
            text = 'Weak';
            width = '33%';
        } else if (strength < 4) {
            color = '#f97316';
            text = 'Medium';
            width = '66%';
        } else {
            color = '#10b981';
            text = 'Strong';
            width = '100%';
        }
        
        if (strengthBar) {
            strengthBar.style.width = password.length ? width : '0%';
            strengthBar.style.background = color;
        }
        
        if (strengthText) {
            strengthText.textContent = password.length ? text : '';
            strengthText.style.color = color;
        }
    });
}

function calculatePasswordStrength(password) {
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    return strength;
}

// =================================================================
// MAKE FUNCTIONS GLOBAL
// =================================================================

window.logout = logout;
window.handleGoogleLogin = handleGoogleLogin;
window.handleFacebookLogin = handleFacebookLogin;
window.handleGoogleSignup = handleGoogleSignup;
window.handleFacebookSignup = handleFacebookSignup;

// =================================================================
// CSS ANIMATIONS
// =================================================================

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateY(-10px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
`;
document.head.appendChild(style);

console.log('✅ BorrowBuddy Authentication System Loaded');
console.log('🔗 Backend URL:', BACKEND_URL);