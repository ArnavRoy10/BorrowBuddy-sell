// Storage Sync System - Sync data across multiple tabs
// This file handles real-time synchronization between tabs

class StorageSync {
    constructor() {
        // Check if sync is enabled (default: true)
        this.syncEnabled = localStorage.getItem('multiTabSyncEnabled') !== 'false';
        this.username = localStorage.getItem('username');
        
        if (this.syncEnabled) {
            this.setupListeners();
            console.log('StorageSync ENABLED for user:', this.username);
        } else {
            console.log('StorageSync DISABLED - Multiple users can login in different tabs');
        }
    }

    setupListeners() {
        // Listen for storage changes from other tabs
        window.addEventListener('storage', (e) => {
            if (!this.syncEnabled) return;
            
            console.log('Storage change detected:', e.key);
            
            if (!e.key) {
                // localStorage was cleared
                this.handleStorageCleared();
                return;
            }

            // Handle different types of storage changes
            if (e.key.startsWith('requests_')) {
                this.handleRequestsChange(e);
            } else if (e.key.startsWith('lent_')) {
                this.handleLentItemsChange(e);
            } else if (e.key.startsWith('borrowed_')) {
                this.handleBorrowedItemsChange(e);
            } else if (e.key === 'cart') {
                this.handleCartChange(e);
            } else if (e.key === 'isLoggedIn' || e.key === 'username') {
                this.handleAuthChange(e);
            } else if (e.key.startsWith('items_')) {
                this.handleItemsChange(e);
            } else if (e.key.startsWith('conversations_')) {
                this.handleConversationsChange(e);
            }
        });
    }

    handleRequestsChange(e) {
        console.log('Requests changed:', e.key);
        
        // Reload requests page if it exists
        if (typeof requestsManager !== 'undefined') {
            console.log('Reloading requests...');
            requestsManager.loadAndRender();
        }
        
        // Update any request badges
        this.updateRequestBadges();
    }

    handleLentItemsChange(e) {
        console.log('Lent items changed:', e.key);
        
        // Reload lent items page if it exists
        if (typeof myLentItems !== 'undefined') {
            console.log('Reloading lent items...');
            myLentItems.lentItems = myLentItems.loadLentItems();
            myLentItems.renderItems();
            myLentItems.updateStats();
        }
    }

    handleBorrowedItemsChange(e) {
        console.log('Borrowed items changed:', e.key);
        
        // Reload borrowed items page if it exists
        if (typeof myBorrowedItems !== 'undefined') {
            console.log('Reloading borrowed items...');
            myBorrowedItems.borrowedItems = myBorrowedItems.loadBorrowedItems();
            myBorrowedItems.renderItems();
            myBorrowedItems.updateStats();
        }
    }

    handleCartChange(e) {
        console.log('Cart changed');
        
        // Update cart badge
        const cart = JSON.parse(e.newValue || '[]');
        document.querySelectorAll('#cartBadge, .cart-badge, #cartItemCount').forEach(badge => {
            badge.textContent = cart.length;
            if (badge.id !== 'cartItemCount') {
                badge.style.display = cart.length > 0 ? 'inline-block' : 'none';
            }
        });
        
        // Reload cart page if it exists
        if (typeof cartManager !== 'undefined') {
            console.log('Reloading cart...');
            cartManager.cart = cartManager.loadCart();
            cartManager.renderCart();
        }
    }

    handleAuthChange(e) {
        if (!this.syncEnabled) return;
        
        console.log('Auth state changed');
        
        if (e.key === 'isLoggedIn' && !e.newValue) {
            // User logged out in another tab
            console.log('User logged out in another tab, redirecting...');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 500);
        } else if (e.key === 'username' && e.newValue !== this.username) {
            // Different user logged in
            console.log('Different user logged in, reloading...');
            setTimeout(() => {
                window.location.reload();
            }, 500);
        }
    }

    handleItemsChange(e) {
        console.log('Items changed:', e.key);
        
        // Reload browse page if it exists
        if (typeof loadAllItems === 'function') {
            console.log('Reloading browse items...');
            loadAllItems();
        }
        
        // Reload my items page if it exists
        if (typeof myItemsManager !== 'undefined') {
            console.log('Reloading my items...');
            myItemsManager.items = myItemsManager.loadItems();
            myItemsManager.renderItems();
            myItemsManager.updateStats();
        }
    }

    handleConversationsChange(e) {
        console.log('Conversations changed:', e.key);
        
        // Reload messages page if it exists
        if (typeof messagesManager !== 'undefined') {
            console.log('Reloading conversations...');
            messagesManager.conversations = messagesManager.loadConversations();
            messagesManager.renderConversations();
        }
    }

    handleStorageCleared() {
        console.log('Storage cleared, redirecting to login...');
        window.location.href = 'login.html';
    }

    updateRequestBadges() {
        const username = localStorage.getItem('username');
        if (!username) return;
        
        const requests = JSON.parse(localStorage.getItem(`requests_${username}`) || '[]');
        const incomingCount = requests.filter(r => r.type === 'incoming' && r.status === 'pending').length;
        const outgoingCount = requests.filter(r => r.type === 'outgoing' && r.status === 'pending').length;
        
        const incomingBadge = document.getElementById('incomingCount');
        const outgoingBadge = document.getElementById('outgoingCount');
        
        if (incomingBadge) {
            incomingBadge.textContent = incomingCount;
            incomingBadge.style.display = incomingCount > 0 ? 'inline-block' : 'none';
        }
        
        if (outgoingBadge) {
            outgoingBadge.textContent = outgoingCount;
            outgoingBadge.style.display = outgoingCount > 0 ? 'inline-block' : 'none';
        }
    }
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.storageSync = new StorageSync();
    });
} else {
    window.storageSync = new StorageSync();
}
