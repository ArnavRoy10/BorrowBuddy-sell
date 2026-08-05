// Shared Utility Functions
// Use this file to avoid code duplication across your project

// ==================== LOGGER ====================
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export const logger = {
    log: (...args) => isDevelopment && console.log(...args),
    warn: (...args) => isDevelopment && console.warn(...args),
    error: (...args) => console.error(...args) // Always log errors
};

// ==================== STORAGE ====================

/**
 * Safely get data from localStorage with error handling
 * @param {string} key - The localStorage key
 * @param {*} defaultValue - Default value if key doesn't exist or parsing fails
 * @returns {*} Parsed data or default value
 */
export function safeGetFromStorage(key, defaultValue = null) {
    try {
        const data = localStorage.getItem(key);
        if (!data) return defaultValue;
        
        const parsed = JSON.parse(data);
        
        // Validate data type matches default value type
        if (Array.isArray(defaultValue) && !Array.isArray(parsed)) {
            logger.error(`Invalid data format for ${key}, expected array`);
            return defaultValue;
        }
        
        return parsed;
    } catch (error) {
        logger.error(`Error reading from localStorage (${key}):`, error);
        return defaultValue;
    }
}

/**
 * Safely set data to localStorage with error handling
 * @param {string} key - The localStorage key
 * @param {*} value - Value to store
 * @returns {boolean} True if successful, false otherwise
 */
export function safeSetToStorage(key, value) {
    try {
        const stringValue = JSON.stringify(value);
        const sizeInBytes = new Blob([stringValue]).size;
        const sizeInMB = sizeInBytes / (1024 * 1024);
        
        // Warn if approaching localStorage limit
        if (sizeInMB > 4) {
            logger.warn(`Data size (${sizeInMB.toFixed(2)}MB) approaching localStorage limit`);
        }
        
        localStorage.setItem(key, stringValue);
        return true;
    } catch (error) {
        if (error.name === 'QuotaExceededError') {
            logger.error('localStorage quota exceeded');
            showNotification('Storage full. Please clear some data.', 'error');
        } else {
            logger.error(`Error writing to localStorage (${key}):`, error);
            showNotification('Failed to save data. Please try again.', 'error');
        }
        return false;
    }
}

// ==================== INPUT VALIDATION ====================

/**
 * Sanitize user input to prevent XSS
 * @param {string} input - User input string
 * @returns {string} Sanitized string
 */
export function sanitizeInput(input) {
    if (!input) return '';
    return input.trim().replace(/[<>]/g, '');
}

/**
 * Escape HTML to prevent XSS when inserting into DOM
 * @param {string} text - Text to escape
 * @returns {string} HTML-escaped text
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {boolean} True if valid
 */
export function isValidEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
}

/**
 * Validate date range
 * @param {string} fromDate - Start date (YYYY-MM-DD)
 * @param {string} toDate - End date (YYYY-MM-DD)
 * @param {number} maxDays - Maximum allowed days (default 30)
 * @returns {object} { valid: boolean, message: string, days?: number }
 */
export function validateDateRange(fromDate, toDate, maxDays = 30) {
    if (!fromDate || !toDate) {
        return { valid: false, message: 'Please select both start and end dates' };
    }

    const from = new Date(fromDate);
    const to = new Date(toDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        return { valid: false, message: 'Invalid date format' };
    }
    
    if (from < today) {
        return { valid: false, message: 'Start date cannot be in the past' };
    }
    
    if (to <= from) {
        return { valid: false, message: 'End date must be after start date' };
    }
    
    const daysDiff = Math.ceil((to - from) / (1000 * 60 * 60 * 24));
    if (daysDiff > maxDays) {
        return { valid: false, message: `Maximum period is ${maxDays} days` };
    }
    
    return { valid: true, days: daysDiff };
}

// ==================== NOTIFICATIONS ====================

/**
 * Show notification to user
 * @param {string} message - Message to display
 * @param {string} type - Type: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Duration in ms (default 3000)
 */
export function showNotification(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    
    const colors = {
        success: { bg: '#10b981', icon: 'check-circle' },
        error: { bg: '#ef4444', icon: 'times-circle' },
        warning: { bg: '#f97316', icon: 'exclamation-circle' },
        info: { bg: '#3b82f6', icon: 'info-circle' }
    };
    
    const style = colors[type] || colors.info;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${style.bg};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    `;
    
    notification.innerHTML = `<i class="fas fa-${style.icon}"></i> ${escapeHtml(message)}`;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

/**
 * Show error message in form
 * @param {string} message - Error message
 * @param {HTMLElement} container - Container to insert message
 */
export function showFormError(message, container) {
    clearFormMessages(container);
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'form-error-message';
    errorDiv.style.cssText = `
        background: #fee2e2;
        color: #dc2626;
        padding: 1rem;
        border-radius: 8px;
        margin-bottom: 1rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;
    `;
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <span>${escapeHtml(message)}</span>
    `;
    
    container.insertBefore(errorDiv, container.firstChild);
}

/**
 * Show success message in form
 * @param {string} message - Success message
 * @param {HTMLElement} container - Container to insert message
 */
export function showFormSuccess(message, container) {
    clearFormMessages(container);
    
    const successDiv = document.createElement('div');
    successDiv.className = 'form-success-message';
    successDiv.style.cssText = `
        background: #d1fae5;
        color: #059669;
        padding: 1rem;
        border-radius: 8px;
        margin-bottom: 1rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;
    `;
    successDiv.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${escapeHtml(message)}</span>
    `;
    
    container.insertBefore(successDiv, container.firstChild);
}

/**
 * Clear form messages
 * @param {HTMLElement} container - Container with messages
 */
export function clearFormMessages(container) {
    container.querySelectorAll('.form-error-message, .form-success-message').forEach(msg => {
        msg.remove();
    });
}

// ==================== HELPERS ====================

/**
 * Get initials from name
 * @param {string} name - Person's name
 * @returns {string} Initials (2 characters)
 */
export function getInitials(name) {
    if (!name || typeof name !== 'string') return 'U';
    
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

/**
 * Capitalize first letter
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
export function capitalizeFirst(str) {
    if (!str || typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format date to readable string
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date
 */
export function formatDate(date) {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid date';
    
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return d.toLocaleDateString('en-US', options);
}

/**
 * Calculate days between two dates
 * @param {string} fromDate - Start date
 * @param {string} toDate - End date
 * @returns {number} Number of days
 */
export function getDaysBetween(fromDate, toDate) {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const diffTime = Math.abs(to - from);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// ==================== ANIMATIONS ====================

// Add slide animations if not already present
if (!document.getElementById('utils-animations')) {
    const style = document.createElement('style');
    style.id = 'utils-animations';
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

// ==================== EXPORTS ====================
// If not using ES6 modules, you can make these global:
if (typeof window !== 'undefined') {
    window.utils = {
        logger,
        safeGetFromStorage,
        safeSetToStorage,
        sanitizeInput,
        escapeHtml,
        isValidEmail,
        validateDateRange,
        showNotification,
        showFormError,
        showFormSuccess,
        clearFormMessages,
        getInitials,
        capitalizeFirst,
        formatDate,
        getDaysBetween
    };
}