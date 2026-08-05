// Main Application Script

// Global utility functions
window.app = {
    // Initialize application
    init() {
        this.setupEventListeners();
        this.checkAuth();
        this.updateCartBadge();
    },

    // Setup global event listeners
    setupEventListeners() {
        // Mobile navigation
        const navToggle = document.getElementById('navToggle');
        const navMenu = document.getElementById('navMenu');
        
        if (navToggle && navMenu) {
            navToggle.addEventListener('click', () => {
                navMenu.classList.toggle('active');
            });

            // Close on outside click
            document.addEventListener('click', (e) => {
                if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) {
                    navMenu.classList.remove('active');
                }
            });
        }

        // Smooth scroll for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                const href = this.getAttribute('href');
                if (href !== '#') {
                    e.preventDefault();
                    const target = document.querySelector(href);
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            });
        });
    },

    // Check authentication status
    checkAuth() {
        const isLoggedIn = localStorage.getItem('isLoggedIn');
        const currentPage = window.location.pathname.split('/').pop();
        
        const publicPages = ['index.html', 'login.html', 'signup.html', 'forgot-password.html', 'about.html', 'contact.html', 'faq.html', 'terms.html', 'privacy.html', ''];
        
        if (!publicPages.includes(currentPage) && isLoggedIn !== 'true') {
            window.location.href = 'login.html';
        }
    },

    // Update cart badge
    updateCartBadge() {
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        const badges = document.querySelectorAll('#cartBadge, .cart-badge');
        
        badges.forEach(badge => {
            badge.textContent = cart.length;
            badge.style.display = cart.length > 0 ? 'inline-block' : 'none';
        });
    },

    // Add to cart
    addToCart(itemId) {
        const isLoggedIn = localStorage.getItem('isLoggedIn');
        
        if (isLoggedIn !== 'true') {
            this.showNotification('Please login to add items to cart', 'warning');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);
            return;
        }

        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        
        // Find item
        const allItems = this.getAllItems();
        const item = allItems.find(i => i.id === parseInt(itemId));
        
        if (!item) {
            this.showNotification('Item not found', 'error');
            return;
        }

        // Check if already in cart
        if (cart.find(i => i.id === item.id)) {
            this.showNotification('Item already in cart!', 'warning');
            return;
        }

        // Add to cart
        cart.push(item);
        localStorage.setItem('cart', JSON.stringify(cart));
        
        this.showNotification('Added to cart!', 'success');
        this.updateCartBadge();
    },

    // Get all items
    getAllItems() {
        const browseItems = JSON.parse(localStorage.getItem('browseItems') || '[]');
        const users = JSON.parse(localStorage.getItem('users') || '{}');
        const userItems = [];
        
        Object.keys(users).forEach(username => {
            const items = JSON.parse(localStorage.getItem(`items_${username}`) || '[]');
            userItems.push(...items);
        });

        return [...browseItems, ...userItems];
    },

    // Toggle favorite
    toggleFavorite(itemId) {
        const username = localStorage.getItem('username');
        if (!username) {
            this.showNotification('Please login to favorite items', 'warning');
            return;
        }

        let favorites = JSON.parse(localStorage.getItem(`favorites_${username}`) || '[]');
        
        if (favorites.includes(itemId)) {
            favorites = favorites.filter(id => id !== itemId);
            this.showNotification('Removed from favorites', 'info');
        } else {
            favorites.push(itemId);
            this.showNotification('Added to favorites', 'success');
        }

        localStorage.setItem(`favorites_${username}`, JSON.stringify(favorites));
        
        // Update UI
        const btn = event.currentTarget;
        const icon = btn.querySelector('i');
        if (icon) {
            icon.className = favorites.includes(itemId) ? 'fas fa-heart' : 'far fa-heart';
        }
    },

    // Show notification
    showNotification(message, type = 'info') {
        // Remove existing notifications
        document.querySelectorAll('.app-notification').forEach(n => n.remove());

        const notification = document.createElement('div');
        notification.className = 'app-notification';
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
            animation: slideInRight 0.3s ease;
            display: flex;
            align-items: center;
            gap: 0.75rem;
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
    },

    // Format currency
    formatCurrency(amount) {
        if (typeof amount !== 'number') {
            amount = parseFloat(amount) || 0;
        }
        return `₹${amount.toFixed(2)}`;
    },

    // Format date
    formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    },

    // Get initials
    getInitials(name) {
        if (!name) return 'U';
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return parts[0][0] + parts[1][0];
        }
        return name.substring(0, 2).toUpperCase();
    }
};

// Global functions for inline handlers
function addToCart(itemId) {
    window.app.addToCart(itemId);
}

function toggleFavorite(itemId) {
    window.app.toggleFavorite(itemId);
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('username');
        window.location.href = 'login.html';
    }
}

// Add notification animations
if (!document.getElementById('app-animations')) {
    const style = document.createElement('style');
    style.id = 'app-animations';
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

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app.init();
    });
} else {
    window.app.init();
}