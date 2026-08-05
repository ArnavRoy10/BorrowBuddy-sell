// Dashboard Common Functionality

// Check authentication
function checkAuth() {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (isLoggedIn !== 'true') {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Get current username
function getCurrentUsername() {
    return localStorage.getItem('username') || 'User';
}

// Update navigation
function updateNavigation() {
    const username = getCurrentUsername();
    
    // Update username displays
    document.querySelectorAll('#usernameDisplay, .username-display').forEach(el => {
        el.textContent = username;
    });

    // Update cart badge
    updateCartBadge();
}

// Update cart badge
function updateCartBadge() {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const count = cart.length;
    
    document.querySelectorAll('#cartBadge, .cart-badge').forEach(badge => {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-block' : 'none';
    });
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// Format date time
function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleDateString('en-US', options);
}

// Calculate days between dates
function calculateDays(fromDate, toDate) {
    if (!fromDate || !toDate) return 0;
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const diffTime = Math.abs(to - from);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays || 1;
}

// Calculate total price
function calculatePrice(priceString, days) {
    if (!priceString || priceString === 'Free') return 0;
    
    // Extract numeric value from price string (e.g., "₹5/day" -> 5)
    const priceMatch = priceString.match(/[\d.]+/);
    const pricePerDay = priceMatch ? parseFloat(priceMatch[0]) : 0;
    
    return pricePerDay * days;
}

// Show notification
function showNotification(message, type = 'info') {
    // Remove existing notifications
    document.querySelectorAll('.notification-toast').forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = 'notification-toast';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f97316' : '#3b82f6'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        animation: slideInRight 0.3s ease;
        max-width: 400px;
    `;
    
    const icon = type === 'success' ? 'check-circle' : 
                 type === 'error' ? 'times-circle' : 
                 type === 'warning' ? 'exclamation-circle' : 'info-circle';
    
    notification.innerHTML = `
        <i class="fas fa-${icon}" style="font-size: 1.5rem;"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add notification animations to page
if (!document.getElementById('notification-animations')) {
    const style = document.createElement('style');
    style.id = 'notification-animations';
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

// Confirm dialog
function confirmDialog(message) {
    return confirm(message);
}

// Mobile navigation toggle
function setupMobileNav() {
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');
    
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) {
                navMenu.classList.remove('active');
            }
        });

        // Close menu when clicking a link
        navMenu.querySelectorAll('.nav-item').forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
            });
        });
    }
}

// Initialize common dashboard features
function initDashboard() {
    if (checkAuth()) {
        updateNavigation();
        setupMobileNav();
    }
}

// Load user profile
function loadUserProfile() {
    const username = getCurrentUsername();
    const profile = JSON.parse(localStorage.getItem(`profile_${username}`) || '{}');
    return profile;
}

// Save user profile
function saveUserProfile(profile) {
    const username = getCurrentUsername();
    localStorage.setItem(`profile_${username}`, JSON.stringify(profile));
}

// Get user statistics
function getUserStats() {
    const username = getCurrentUsername();
    
    const borrowed = JSON.parse(localStorage.getItem(`borrowed_${username}`) || '[]');
    const lent = JSON.parse(localStorage.getItem(`lent_${username}`) || '[]');
    const items = JSON.parse(localStorage.getItem(`items_${username}`) || '[]');
    const requests = JSON.parse(localStorage.getItem(`requests_${username}`) || '[]');
    
    return {
        itemsBorrowed: borrowed.length,
        itemsLent: lent.length,
        itemsListed: items.length,
        pendingRequests: requests.filter(r => r.status === 'pending').length,
        totalRequests: requests.length
    };
}

// Truncate text
function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Generate random ID
function generateId() {
    return Date.now() + Math.random().toString(36).substr(2, 9);
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Search filter
function searchFilter(items, searchTerm, searchFields) {
    if (!searchTerm) return items;
    
    const term = searchTerm.toLowerCase();
    return items.filter(item => {
        return searchFields.some(field => {
            const value = item[field];
            return value && value.toString().toLowerCase().includes(term);
        });
    });
}

// Sort items
function sortItems(items, sortBy, order = 'asc') {
    return [...items].sort((a, b) => {
        let aVal = a[sortBy];
        let bVal = b[sortBy];
        
        // Handle dates
        if (sortBy.includes('date') || sortBy.includes('Date') || sortBy.includes('At')) {
            aVal = new Date(aVal).getTime();
            bVal = new Date(bVal).getTime();
        }
        
        // Handle numbers
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return order === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        // Handle strings
        if (typeof aVal === 'string' && typeof bVal === 'string') {
            return order === 'asc' 
                ? aVal.localeCompare(bVal) 
                : bVal.localeCompare(aVal);
        }
        
        return 0;
    });
}

// Format currency
function formatCurrency(amount) {
    if (typeof amount !== 'number') {
        amount = parseFloat(amount) || 0;
    }
    return `₹${amount.toFixed(2)}`;
}

// Get status badge HTML
function getStatusBadge(status) {
    const statusMap = {
        'pending': { color: '#f97316', icon: 'clock', text: 'Pending' },
        'approved': { color: '#10b981', icon: 'check-circle', text: 'Approved' },
        'rejected': { color: '#ef4444', icon: 'times-circle', text: 'Rejected' },
        'active': { color: '#3b82f6', icon: 'play-circle', text: 'Active' },
        'completed': { color: '#6366f1', icon: 'check-double', text: 'Completed' },
        'cancelled': { color: '#94a3b8', icon: 'ban', text: 'Cancelled' }
    };
    
    const statusInfo = statusMap[status.toLowerCase()] || statusMap['pending'];
    
    return `
        <span style="
            display: inline-flex;
            align-items: center;
            gap: 0.375rem;
            padding: 0.375rem 0.875rem;
            background: ${statusInfo.color}20;
            color: ${statusInfo.color};
            border-radius: 50px;
            font-size: 0.85rem;
            font-weight: 600;
        ">
            <i class="fas fa-${statusInfo.icon}"></i>
            ${statusInfo.text}
        </span>
    `;
}

// Empty state HTML
function getEmptyStateHTML(icon, title, message, buttonText, buttonLink) {
    return `
        <div style="
            text-align: center;
            padding: 4rem 2rem;
            color: #64748b;
        ">
            <i class="fas fa-${icon}" style="
                font-size: 4rem;
                margin-bottom: 1.5rem;
                opacity: 0.5;
            "></i>
            <h3 style="
                font-size: 1.5rem;
                color: #1e293b;
                margin-bottom: 1rem;
            ">${title}</h3>
            <p style="
                font-size: 1.1rem;
                margin-bottom: 2rem;
                line-height: 1.6;
            ">${message}</p>
            ${buttonText && buttonLink ? `
                <a href="${buttonLink}" class="btn btn-primary">
                    <i class="fas fa-plus"></i> ${buttonText}
                </a>
            ` : ''}
        </div>
    `;
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    initDashboard();
}

// Export functions for use in other scripts
window.dashboardUtils = {
    checkAuth,
    getCurrentUsername,
    updateNavigation,
    updateCartBadge,
    formatDate,
    formatDateTime,
    calculateDays,
    calculatePrice,
    showNotification,
    confirmDialog,
    loadUserProfile,
    saveUserProfile,
    getUserStats,
    truncateText,
    generateId,
    debounce,
    searchFilter,
    sortItems,
    formatCurrency,
    getStatusBadge,
    getEmptyStateHTML
};