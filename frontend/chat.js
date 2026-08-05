// In-App Chat System
const currentUser = localStorage.getItem('username');
let activeConversation = null;
let conversations = [];

document.addEventListener('DOMContentLoaded', () => {
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }
    
    loadConversations();
    setupEventListeners();
    
    // Check if opened with specific user
    const urlParams = new URLSearchParams(window.location.search);
    const user = urlParams.get('user');
    if (user) {
        openConversation(user);
    }
});

function setupEventListeners() {
    // Message form submission
    document.getElementById('messageForm').addEventListener('submit', sendMessage);
    
    // New message form
    document.getElementById('newMessageForm').addEventListener('submit', sendNewMessage);
    
    // Search conversations
    document.getElementById('searchConversations').addEventListener('input', searchConversations);
    
    // Auto-resize textarea
    const textarea = document.getElementById('messageInput');
    textarea.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
}

function loadConversations() {
    conversations = [];
    
    // Get all localStorage keys
    const keys = Object.keys(localStorage);
    
    // Find all conversation keys
    keys.forEach(key => {
        if (key.startsWith('conversation_')) {
            const users = key.replace('conversation_', '').split('_');
            const otherUser = users.find(u => u !== currentUser);
            
            if (otherUser) {
                const messages = JSON.parse(localStorage.getItem(key)) || [];
                if (messages.length > 0) {
                    const lastMessage = messages[messages.length - 1];
                    const unreadCount = messages.filter(m => m.to === currentUser && !m.read).length;
                    
                    conversations.push({
                        user: otherUser,
                        lastMessage: lastMessage.text,
                        timestamp: lastMessage.timestamp,
                        unreadCount: unreadCount,
                        messages: messages
                    });
                }
            }
        }
    });
    
    // Sort by most recent
    conversations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    displayConversations();
    loadUsersForNewMessage();
}

function displayConversations() {
    const list = document.getElementById('conversationsList');
    
    if (conversations.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #999;">
                <i class="fas fa-inbox" style="font-size: 3rem; opacity: 0.5; margin-bottom: 1rem;"></i>
                <p>No conversations yet</p>
                <p style="font-size: 0.875rem;">Start a new conversation!</p>
            </div>
        `;
        return;
    }
    
    list.innerHTML = conversations.map(conv => `
        <div class="conversation-item ${conv.user === activeConversation ? 'active' : ''}" 
             onclick="openConversation('${conv.user}')">
            <div class="conversation-avatar">${conv.user.charAt(0).toUpperCase()}</div>
            <div class="conversation-info">
                <div class="conversation-header">
                    <div class="conversation-name">${conv.user}</div>
                    <div class="conversation-time">${formatTimestamp(conv.timestamp)}</div>
                </div>
                <div class="conversation-preview">${conv.lastMessage}</div>
            </div>
            ${conv.unreadCount > 0 ? `<div class="conversation-badge">${conv.unreadCount}</div>` : ''}
        </div>
    `).join('');
}

function openConversation(username) {
    activeConversation = username;
    
    // Update UI
    document.getElementById('noConversation').classList.add('hidden');
    document.getElementById('activeConversation').classList.remove('hidden');
    document.getElementById('chatUsername').textContent = username;
    
    // Load messages
    loadMessages(username);
    
    // Mark messages as read
    markAsRead(username);
    
    // Update conversation list
    displayConversations();
}

function loadMessages(username) {
    const conversationKey = [currentUser, username].sort().join('_');
    const messages = JSON.parse(localStorage.getItem(`conversation_${conversationKey}`)) || [];
    
    const container = document.getElementById('messagesContainer');
    
    if (messages.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #999;">
                <p>No messages yet. Say hi! 👋</p>
            </div>
        `;
        return;
    }
    
    // Group messages by date
    const groupedMessages = groupMessagesByDate(messages);
    
    container.innerHTML = '';
    
    groupedMessages.forEach(group => {
        // Add date divider
        if (group.date) {
            const divider = document.createElement('div');
            divider.className = 'date-divider';
            divider.innerHTML = `<span>${group.date}</span>`;
            container.appendChild(divider);
        }
        
        // Add messages
        group.messages.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${msg.from === currentUser ? 'sent' : 'received'}`;
            
            messageDiv.innerHTML = `
                <div class="message-avatar">${msg.from.charAt(0).toUpperCase()}</div>
                <div class="message-content">
                    <div class="message-bubble">${escapeHtml(msg.text)}</div>
                    <div class="message-time">${formatTime(msg.timestamp)}</div>
                </div>
            `;
            
            container.appendChild(messageDiv);
        });
    });
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

function sendMessage(e) {
    e.preventDefault();
    
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    
    if (!text || !activeConversation) return;
    
    // AI MODERATION: Check for contact information
    const blocked = detectAndBlockContactInfo(text);
    if (blocked.detected) {
        alert(`❌ Message blocked!\n\nReason: ${blocked.type} detected.\n\nℹ️ For your safety, sharing contact information is not allowed. All communication must happen through the platform.`);
        return;
    }
    
    const message = {
        id: Date.now(),
        from: currentUser,
        to: activeConversation,
        text: text,
        timestamp: new Date().toISOString(),
        read: false
    };
    
    // Save message
    const conversationKey = [currentUser, activeConversation].sort().join('_');
    const messages = JSON.parse(localStorage.getItem(`conversation_${conversationKey}`)) || [];
    messages.push(message);
    localStorage.setItem(`conversation_${conversationKey}`, JSON.stringify(messages));
    
    // Clear input
    input.value = '';
    input.style.height = 'auto';
    
    // Reload messages
    loadMessages(activeConversation);
    loadConversations();
}

// AI Moderation System for Chat
function detectAndBlockContactInfo(text) {
    const lowerText = text.toLowerCase();
    
    // 1. Detect Phone Numbers
    const phonePatterns = [
        /\d{10}/,                           // 1234567890
        /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/,   // 123-456-7890
        /\(\d{3}\)\s?\d{3}[-.\s]?\d{4}/,   // (123) 456-7890
        /\+\d{1,3}\s?\d{10}/,               // +91 1234567890
        /\d{5}\s\d{5}/,                     // 98765 43210 (Indian format)
    ];
    
    for (const pattern of phonePatterns) {
        if (pattern.test(text)) {
            return { detected: true, type: 'Phone Number' };
        }
    }
    
    // 2. Detect Email Addresses
    if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text)) {
        return { detected: true, type: 'Email Address' };
    }
    
    // 3. Detect External Contact Keywords
    const bannedPhrases = [
        // Direct contact phrases
        'call me', 'whatsapp me', 'telegram', 'signal app',
        'text me', 'sms me', 'phone me', 'ring me',
        
        // Meeting outside app
        'meet outside', 'outside app', 'off platform',
        'not here', 'somewhere else',
        
        // Payment bypass
        'direct payment', 'cash only', 'pay cash', 'pay outside',
        'no platform', 'avoid fee', 'skip fee',
        
        // Contact info sharing
        'my number', 'my email', 'contact me at', 'reach me',
        'dm me', 'message me on',
        
        // Social media
        'instagram', 'facebook', 'snapchat', 'twitter',
        'insta', 'fb', 'snap', '@',
        
        // Other platforms
        'discord', 'skype', 'zoom', 'google meet'
    ];
    
    for (const phrase of bannedPhrases) {
        if (lowerText.includes(phrase)) {
            return { detected: true, type: `Prohibited phrase: "${phrase}"` };
        }
    }
    
    // 4. Detect number patterns that might be phone with spaces
    // "call nine eight seven six five" etc
    const numberWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    let numberWordCount = 0;
    for (const word of numberWords) {
        if (lowerText.includes(word)) numberWordCount++;
    }
    if (numberWordCount >= 5) {
        return { detected: true, type: 'Suspected phone number (spelled out)' };
    }
    
    return { detected: false };
}

function markAsRead(username) {
    const conversationKey = [currentUser, username].sort().join('_');
    const messages = JSON.parse(localStorage.getItem(`conversation_${conversationKey}`)) || [];
    
    messages.forEach(msg => {
        if (msg.to === currentUser) {
            msg.read = true;
        }
    });
    
    localStorage.setItem(`conversation_${conversationKey}`, JSON.stringify(messages));
}

function showNewMessageModal() {
    document.getElementById('newMessageModal').classList.remove('hidden');
}

function hideNewMessageModal() {
    document.getElementById('newMessageModal').classList.add('hidden');
    document.getElementById('newMessageForm').reset();
}

function loadUsersForNewMessage() {
    const select = document.getElementById('recipientSelect');
    const users = getAllUsers().filter(u => u !== currentUser);
    
    select.innerHTML = '<option value="">Select a user...</option>' +
        users.map(u => `<option value="${u}">${u}</option>`).join('');
}

function getAllUsers() {
    const users = new Set();
    const keys = Object.keys(localStorage);
    
    keys.forEach(key => {
        if (key.startsWith('userItems_')) {
            const username = key.replace('userItems_', '');
            users.add(username);
        }
    });
    
    return Array.from(users);
}

function sendNewMessage(e) {
    e.preventDefault();
    
    const recipient = document.getElementById('recipientSelect').value;
    const text = document.getElementById('newMessageText').value.trim();
    
    if (!recipient || !text) {
        alert('Please select a recipient and enter a message');
        return;
    }
    
    const message = {
        id: Date.now(),
        from: currentUser,
        to: recipient,
        text: text,
        timestamp: new Date().toISOString(),
        read: false
    };
    
    // Save message
    const conversationKey = [currentUser, recipient].sort().join('_');
    const messages = JSON.parse(localStorage.getItem(`conversation_${conversationKey}`)) || [];
    messages.push(message);
    localStorage.setItem(`conversation_${conversationKey}`, JSON.stringify(messages));
    
    // Close modal
    hideNewMessageModal();
    
    // Reload and open conversation
    loadConversations();
    openConversation(recipient);
}

function searchConversations() {
    const search = document.getElementById('searchConversations').value.toLowerCase();
    const items = document.querySelectorAll('.conversation-item');
    
    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(search) ? 'flex' : 'none';
    });
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' min ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' hour ago';
    if (diff < 604800000) return Math.floor(diff / 86400000) + ' day ago';
    
    return date.toLocaleDateString();
}

function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function groupMessagesByDate(messages) {
    const groups = [];
    let currentDate = null;
    let currentGroup = null;
    
    messages.forEach(msg => {
        const msgDate = new Date(msg.timestamp).toDateString();
        
        if (msgDate !== currentDate) {
            if (currentGroup) groups.push(currentGroup);
            
            currentDate = msgDate;
            currentGroup = {
                date: formatDate(msgDate),
                messages: [msg]
            };
        } else {
            currentGroup.messages.push(msg);
        }
    });
    
    if (currentGroup) groups.push(currentGroup);
    
    return groups;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    
    if (dateString === today) return 'Today';
    if (dateString === yesterday) return 'Yesterday';
    
    return date.toLocaleDateString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function viewItemFromChat() {
    // Get current conversation messages
    if (!activeConversation) return;
    
    const conversationKey = [currentUser, activeConversation].sort().join('_');
    const messages = JSON.parse(localStorage.getItem(`conversation_${conversationKey}`)) || [];
    
    // Find message with itemId
    const messageWithItem = messages.find(m => m.itemId);
    
    if (messageWithItem) {
        window.location.href = `item-details.html?id=${messageWithItem.itemId}`;
    } else {
        alert('No item associated with this conversation');
    }
}

// Make functions global
window.openConversation = openConversation;
window.showNewMessageModal = showNewMessageModal;
window.hideNewMessageModal = hideNewMessageModal;
window.viewItemFromChat = viewItemFromChat;
