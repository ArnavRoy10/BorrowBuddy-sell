// Recent Items Management

class RecentItems {
    constructor() {
        this.maxItems = 10;
        this.init();
    }

    init() {
        this.loadRecentItems();
    }

    addRecentItem(item) {
        const username = localStorage.getItem('username');
        if (!username) return;

        let recentItems = JSON.parse(localStorage.getItem(`recent_${username}`) || '[]');

        // Remove if already exists
        recentItems = recentItems.filter(i => i.id !== item.id);

        // Add to beginning
        recentItems.unshift({
            ...item,
            viewedAt: new Date().toISOString()
        });

        // Keep only max items
        recentItems = recentItems.slice(0, this.maxItems);

        localStorage.setItem(`recent_${username}`, JSON.stringify(recentItems));
    }

    loadRecentItems() {
        const username = localStorage.getItem('username');
        if (!username) return [];

        const recentItems = JSON.parse(localStorage.getItem(`recent_${username}`) || '[]');
        return recentItems;
    }

    displayRecentItems(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const items = this.loadRecentItems();

        if (items.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: var(--text-gray);">
                    <i class="fas fa-history" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <h3 style="color: var(--text-dark); margin-bottom: 0.5rem;">No Recent Items</h3>
                    <p>Items you view will appear here</p>
                    <a href="browse.html" class="btn btn-primary" style="margin-top: 1.5rem; display: inline-flex;">
                        <i class="fas fa-search"></i> Browse Items
                    </a>
                </div>
            `;
            return;
        }

        container.innerHTML = items.map(item => `
            <div class="item-card">
                <div class="item-image-wrapper">
                    <img src="${item.image}" alt="${item.name}" class="item-image">
                    <button class="favorite-btn" onclick="toggleFavorite(${item.id})">
                        <i class="far fa-heart"></i>
                    </button>
                    <span class="condition-badge condition-${item.condition || 'good'}">
                        ${item.condition ? item.condition.charAt(0).toUpperCase() + item.condition.slice(1) : 'Good'}
                    </span>
                </div>
                <div class="item-content">
                    <h3 class="item-title">${item.name}</h3>
                    <div class="item-meta">
                        <span><i class="fas fa-user"></i> ${item.owner}</span>
                        <span><i class="fas fa-star"></i> ${item.rating || 5.0}</span>
                    </div>
                    <p class="item-description">${item.description || 'No description available'}</p>
                    <div class="item-footer">
                        <div class="item-price">
                            <span class="price">${item.price}</span>
                            ${item.securityDeposit && parseFloat(item.securityDeposit) > 0 ? 
                                `<span class="deposit">Deposit: ₹${parseFloat(item.securityDeposit).toFixed(2)}</span>` 
                                : ''}
                        </div>
                        <div class="item-actions">
                            <button class="btn-small btn-primary" onclick="addToCart(${item.id})">
                                <i class="fas fa-cart-plus"></i> Add to Cart
                            </button>
                        </div>
                    </div>
                    <div style="margin-top: 0.75rem; font-size: 0.8rem; color: var(--text-gray);">
                        <i class="fas fa-clock"></i> Viewed ${this.getTimeAgo(item.viewedAt)}
                    </div>
                </div>
            </div>
        `).join('');
    }

    getTimeAgo(dateString) {
        const now = new Date();
        const date = new Date(dateString);
        const seconds = Math.floor((now - date) / 1000);

        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
        return date.toLocaleDateString();
    }

    clearRecentItems() {
        const username = localStorage.getItem('username');
        if (!username) return;

        if (confirm('Clear all recent items?')) {
            localStorage.removeItem(`recent_${username}`);
            this.displayRecentItems('recentItemsGrid');
            
            if (window.dashboardUtils) {
                window.dashboardUtils.showNotification('Recent items cleared', 'success');
            }
        }
    }
}

// Initialize
let recentItemsManager;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        recentItemsManager = new RecentItems();
    });
} else {
    recentItemsManager = new RecentItems();
}