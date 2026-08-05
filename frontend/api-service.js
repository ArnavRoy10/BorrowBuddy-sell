/**
 * BorrowBuddy API Service
 * Replaces all localStorage calls with MongoDB Atlas via REST API
 * 
 * Usage: Include this file in your HTML before other scripts:
 * <script src="api-service.js"></script>
 */

const API_BASE_URL = self.BORROWBUDDY_CONFIG.API_BASE_URL + '/api';

class BorrowBuddyAPI {
    constructor() {
        // Only store JWT token in localStorage
        this.token = localStorage.getItem('authToken') || localStorage.getItem('token');
        this.username = localStorage.getItem('username');
    }

    // ==========================================
    // HELPER METHODS
    // ==========================================

    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                ...options,
                headers
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `HTTP ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            throw error;
        }
    }

    setToken(token, username) {
        this.token = token;
        this.username = username;
        localStorage.setItem('token', token);
        localStorage.setItem('authToken', token); // most of the app checks this key first
        localStorage.setItem('username', username);
    }

    clearToken() {
        this.token = null;
        this.username = null;
        localStorage.removeItem('token');
        localStorage.removeItem('authToken');
        localStorage.removeItem('username');
    }

    // ==========================================
    // AUTHENTICATION
    // Replace: localStorage user management
    // ==========================================

    async register(userData) {
        const data = await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
        this.setToken(data.token, data.user.username);
        return data.user;
    }

    async login(username, password) {
        const data = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        this.setToken(data.token, data.user.username);
        return data.user;
    }

    logout() {
        this.clearToken();
    }

    // ==========================================
    // ITEMS
    // Replace: localStorage.getItem('items_*')
    //          localStorage.setItem('items_*')
    // ==========================================

    async getAllItems(filters = {}) {
        const queryString = new URLSearchParams(filters).toString();
        return await this.request(`/items?${queryString}`);
    }

    async getMyItems() {
        return await this.request('/items/my-items');
    }

    async getItem(itemId) {
        return await this.request(`/items/${itemId}`);
    }

    async createItem(itemData) {
        return await this.request('/items', {
            method: 'POST',
            body: JSON.stringify(itemData)
        });
    }

    async updateItem(itemId, updates) {
        return await this.request(`/items/${itemId}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
    }

    async deleteItem(itemId) {
        return await this.request(`/items/${itemId}`, {
            method: 'DELETE'
        });
    }

    // ==========================================
    // BORROW REQUESTS
    // Replace: localStorage.getItem('requests_*')
    //          localStorage.getItem('myRequests_*')
    // ==========================================

    async createRequest(requestData) {
        return await this.request('/requests', {
            method: 'POST',
            body: JSON.stringify(requestData)
        });
    }

    async getMyRequests() {
        // Requests I sent
        return await this.request('/requests/outgoing');
    }

    async getIncomingRequests() {
        // Requests I received
        return await this.request('/requests/incoming');
    }

    async approveRequest(requestId) {
        return await this.request(`/requests/${requestId}/approve`, {
            method: 'POST'
        });
    }

    async rejectRequest(requestId) {
        return await this.request(`/requests/${requestId}/reject`, {
            method: 'POST'
        });
    }

    async cancelRequest(requestId) {
        return await this.request(`/requests/${requestId}`, {
            method: 'DELETE'
        });
    }

    // ==========================================
    // PAYMENTS
    // Replace: localStorage.getItem('payments')
    // ==========================================

    async createPayment(paymentData) {
        return await this.request('/payments', {
            method: 'POST',
            body: JSON.stringify(paymentData)
        });
    }

    async getMyPayments() {
        return await this.request('/payments/my-payments');
    }

    async getPaymentByTransaction(transactionId) {
        return await this.request(`/payments/transaction/${transactionId}`);
    }

    async refundDeposit(paymentId) {
        return await this.request(`/payments/${paymentId}/refund`, {
            method: 'POST'
        });
    }

    // ==========================================
    // CONVERSATIONS / CHAT
    // Replace: localStorage.getItem('conversation_*')
    // ==========================================

    async getConversations() {
        return await this.request('/conversations');
    }

    async getConversation(withUser) {
        return await this.request(`/conversations/${withUser}`);
    }

    async sendMessage(recipientId, messageData) {
        return await this.request('/conversations/send', {
            method: 'POST',
            body: JSON.stringify({
                recipientId,
                ...messageData
            })
        });
    }

    // ==========================================
    // REVIEWS
    // Replace: localStorage.getItem('reviews_*')
    // ==========================================

    async getItemReviews(itemId) {
        return await this.request(`/reviews/item/${itemId}`);
    }

    async createReview(reviewData) {
        return await this.request('/reviews', {
            method: 'POST',
            body: JSON.stringify(reviewData)
        });
    }

    async deleteReview(reviewId) {
        return await this.request(`/reviews/${reviewId}`, {
            method: 'DELETE'
        });
    }

    // ==========================================
    // CONTACT DETAILS (Unlocked)
    // Replace: localStorage.getItem('unlocked_*')
    // ==========================================

    async getUnlockedContact(requestId) {
        return await this.request(`/requests/${requestId}/contact`);
    }

    // ==========================================
    // DISPUTES (damage reports & refund requests)
    // ==========================================

    async createDispute(disputeData) {
        return await this.request('/disputes', {
            method: 'POST',
            body: JSON.stringify(disputeData)
        });
    }

    // Same endpoint as createDispute, but over XHR so we can surface real
    // upload progress (fetch has no upload-progress event). Evidence photos
    // are the overwhelming majority of the payload's bytes, so overall
    // upload progress is a faithful proxy for "how much of the evidence
    // has actually left the device" — used to drive per-photo indicators.
    createDisputeWithProgress(disputeData, onProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${API_BASE_URL}/disputes`);
            xhr.setRequestHeader('Content-Type', 'application/json');
            if (this.token) xhr.setRequestHeader('Authorization', `Bearer ${this.token}`);
            xhr.timeout = 30000;

            if (xhr.upload && typeof onProgress === 'function') {
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) onProgress(e.loaded / e.total);
                };
            }

            xhr.onload = () => {
                let data = {};
                try { data = JSON.parse(xhr.responseText || '{}'); } catch (e) { /* non-JSON error page */ }

                if (xhr.status >= 200 && xhr.status < 300) {
                    if (typeof onProgress === 'function') onProgress(1);
                    resolve(data);
                } else {
                    const err = new Error(data.message || `HTTP ${xhr.status}`);
                    err.status = xhr.status;
                    reject(err);
                }
            };
            xhr.onerror = () => reject(new Error('Failed to fetch'));
            xhr.ontimeout = () => reject(new Error('Request timed out'));
            xhr.send(JSON.stringify(disputeData));
        });
    }

    async getMyDisputes() {
        return await this.request('/disputes/mine');
    }

    async getDispute(disputeId) {
        return await this.request(`/disputes/${disputeId}`);
    }

    async addDisputeMessage(disputeId, text) {
        return await this.request(`/disputes/${disputeId}/messages`, {
            method: 'POST',
            body: JSON.stringify({ text })
        });
    }

    async withdrawDispute(disputeId) {
        return await this.request(`/disputes/${disputeId}/withdraw`, { method: 'PATCH' });
    }

    async getAllDisputes(status) {
        const qs = status ? `?status=${encodeURIComponent(status)}` : '';
        return await this.request(`/disputes/admin/all${qs}`);
    }

    async resolveDispute(disputeId, resolution) {
        return await this.request(`/disputes/${disputeId}/resolve`, {
            method: 'PATCH',
            body: JSON.stringify(resolution)
        });
    }
}

// Create global instance
const api = new BorrowBuddyAPI();

// Make available globally
if (typeof window !== 'undefined') {
    window.api = api;
    window.BorrowBuddyAPI = BorrowBuddyAPI;
}

console.log('✅ BorrowBuddy API Service loaded');
console.log('📡 API Base URL:', API_BASE_URL);