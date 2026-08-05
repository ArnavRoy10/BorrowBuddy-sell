// BorrowBuddy — AI Assistant Widget (rule-based chat helper)

class AIAssistant {
    constructor() {
        this.messages = [];
        this.init();
    }

    init() {
        this.createWidget();
        this.attachEventListeners();
        this.addWelcomeMessage();
    }

    createWidget() {
        if (document.getElementById('aiAssistantWidget')) return;

        const widget = document.createElement('div');
        widget.id = 'aiAssistantWidget';
        widget.innerHTML = `
            <button class="ai-toggle-btn" id="aiToggleBtn" title="AI Assistant">
                <i class="fas fa-robot"></i>
            </button>
            <div class="ai-chat-window" id="aiChatWindow" style="display:none">
                <div class="ai-chat-header">
                    <div class="ai-header-info">
                        <div class="ai-avatar"><i class="fas fa-robot"></i></div>
                        <div>
                            <h3>BorrowBuddy Assistant</h3>
                            <p>Here to help you!</p>
                        </div>
                    </div>
                    <button class="ai-close-btn" id="aiCloseBtn">✕</button>
                </div>
                <div class="ai-chat-messages" id="aiChatMessages"></div>
                <div class="ai-chat-input-area">
                    <input type="text" id="aiMessageInput" placeholder="Ask me anything...">
                    <button id="aiSendBtn"><i class="fas fa-paper-plane"></i></button>
                </div>
            </div>
        `;
        document.body.appendChild(widget);
    }

    attachEventListeners() {
        document.getElementById('aiToggleBtn')?.addEventListener('click', () => {
            const win = document.getElementById('aiChatWindow');
            if (win) win.style.display = win.style.display === 'none' ? 'flex' : 'none';
        });
        document.getElementById('aiCloseBtn')?.addEventListener('click', () => {
            const win = document.getElementById('aiChatWindow');
            if (win) win.style.display = 'none';
        });
        document.getElementById('aiSendBtn')?.addEventListener('click', () => this.sendMessage());
        document.getElementById('aiMessageInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
    }

    addWelcomeMessage() {
        const messagesContainer = document.getElementById('aiChatMessages');
        if (!messagesContainer) return;

        const welcomeHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">👋</div>
                <h4>Hi! I'm your AI Assistant</h4>
                <p>I can help you with:</p>
                <div class="quick-suggestions">
                    <div class="suggestion-chip" onclick="aiAssistant.askQuestion('How do I borrow an item?')">
                        <i class="fas fa-hand-holding"></i> How to borrow
                    </div>
                    <div class="suggestion-chip" onclick="aiAssistant.askQuestion('What is Instant Access?')">
                        <i class="fas fa-bolt"></i> Instant Access
                    </div>
                    <div class="suggestion-chip" onclick="aiAssistant.askQuestion('How do I lend an item?')">
                        <i class="fas fa-share"></i> How to lend
                    </div>
                    <div class="suggestion-chip" onclick="aiAssistant.askQuestion('How do referral points work?')">
                        <i class="fas fa-star"></i> Points & referrals
                    </div>
                    <div class="suggestion-chip" onclick="aiAssistant.askQuestion('How do I return an item?')">
                        <i class="fas fa-undo"></i> Returning items
                    </div>
                    <div class="suggestion-chip" onclick="aiAssistant.askQuestion('What are security deposits?')">
                        <i class="fas fa-shield-alt"></i> Security deposits
                    </div>
                </div>
            </div>
        `;

        messagesContainer.innerHTML = welcomeHTML;
    }

    sendMessage() {
        const input = document.getElementById('aiMessageInput');
        if (!input) return;

        const message = input.value.trim();
        if (!message) return;

        this.addMessage(message, 'user');
        input.value = '';

        this.showTypingIndicator();

        setTimeout(() => {
            this.hideTypingIndicator();
            const response = this.generateResponse(message);
            this.addMessage(response, 'assistant');
        }, 1000 + Math.random() * 1000);
    }

    askQuestion(question) {
        const input = document.getElementById('aiMessageInput');
        if (input) {
            input.value = question;
            this.sendMessage();
        }
    }

    addMessage(text, sender) {
        const messagesContainer = document.getElementById('aiChatMessages');
        if (!messagesContainer) return;

        const welcomeMsg = messagesContainer.querySelector('.welcome-message');
        if (welcomeMsg) welcomeMsg.remove();

        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-message ${sender}`;

        const time = new Date().toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        const avatarIcon = sender === 'assistant' ? 'fa-robot' : 'fa-user';

        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas ${avatarIcon}"></i>
            </div>
            <div class="message-content">
                <div class="message-bubble">${this.formatMessage(text)}</div>
                <div class="message-time">${time}</div>
            </div>
        `;

        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();

        this.messages.push({ text, sender, time });
    }

    formatMessage(text) {
        text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
        text = text.replace(/\n/g, '<br>');
        return text;
    }

    showTypingIndicator() {
        const messagesContainer = document.getElementById('aiChatMessages');
        if (!messagesContainer) return;

        const typingDiv = document.createElement('div');
        typingDiv.className = 'ai-message assistant';
        typingDiv.id = 'typingIndicator';
        typingDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;

        messagesContainer.appendChild(typingDiv);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) indicator.remove();
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('aiChatMessages');
        if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    generateResponse(message) {
        const lowerMessage = message.toLowerCase();

        // Instant Access / points redemption
        if (lowerMessage.includes('instant') || lowerMessage.includes('unlock now') || lowerMessage.includes('skip wait')) {
            return `⚡ Instant Access lets you skip waiting for owner approval:\n\n1. Click "Borrow Now" on any item\n2. Pick your dates on the availability calendar\n3. Choose "Instant Access" instead of "Standard Request"\n4. Pay ₹10 + 10% of the rental total — or use 100 points instead (free!)\n5. Get the owner's phone number and pickup details immediately\n\nDates that are already borrowed or have a pending request show in red/yellow on the calendar and can't be selected.`;
        }

        // Points & referrals
        if (lowerMessage.includes('point') || lowerMessage.includes('referral') || lowerMessage.includes('invite') || lowerMessage.includes('refer a friend')) {
            return `⭐ Earn points by inviting friends:\n\n1. Go to Dashboard → find your "Invite Friends, Earn Points" card\n2. Copy your referral link or share via WhatsApp\n3. When a friend signs up using your link, you BOTH get 100 points\n4. 100 points = 1 free Instant Access unlock (no payment needed!)\n\nYour points balance shows in the ⭐ badge in the navbar and on your Dashboard.`;
        }

        // Borrowing help (updated for two-pathway flow)
        if (lowerMessage.includes('borrow') || lowerMessage.includes('rent')) {
            return `To borrow an item:\n\n1. Browse items and click on one you like\n2. Click "Borrow Now"\n3. Pick your dates on the availability calendar (red = unavailable, yellow = pending)\n4. Choose your pathway:\n   📬 Standard Request — free, wait for owner approval\n   ⚡ Instant Access — pay a small fee (or use 100 points) to unlock contact details immediately\n5. Once approved/unlocked, message the owner to arrange pickup!\n\nAll prices are in ₹ (Rupees). Security deposits are refunded after you return the item and the owner confirms.`;
        }

        // Lending help
        if (lowerMessage.includes('lend') || lowerMessage.includes('list') || lowerMessage.includes('add item')) {
            return `To lend an item:\n\n1. Go to "Add Item" in the navbar\n2. Fill in name, category, description, and condition\n3. Upload up to 5 photos (stored securely via Cloudinary)\n4. Set your price per day in ₹ (or mark as Free)\n5. Add a security deposit (optional but recommended)\n6. Add your phone number and pickup location\n7. Click "List Item"\n\nYour listing appears instantly in Browse. You'll get a notification the moment someone sends a request!`;
        }

        // Returning items
        if (lowerMessage.includes('return') || lowerMessage.includes('give back')) {
            return `Returning an item is a two-step process:\n\n1. Go to "My Borrowed Items" and click "Return" on the item\n2. This notifies the owner that you've returned it\n3. The owner confirms the return on their "My Lent Items" page\n4. Once confirmed, your security deposit is automatically flagged for refund\n\nYou'll get a notification at each step, and you can leave a review once the return is confirmed!`;
        }

        // Cart help
        if (lowerMessage.includes('cart') || lowerMessage.includes('checkout')) {
            return `Cart features:\n\n• Add multiple items from the browse page\n• Set individual borrow dates for each item\n• See automatic price calculation (days × ₹/day)\n• Security deposits shown separately\n• Checkout offers both Standard Request and Instant Access for all items at once\n\nNote: Prices are in Indian Rupees (₹). The total updates automatically when you set dates!`;
        }

        // Security deposit
        if (lowerMessage.includes('deposit') || lowerMessage.includes('security')) {
            return `Security deposits protect item owners:\n\n• Refundable amount held until you return the item\n• Covers potential damage or loss\n• Released automatically once the owner confirms your return\n• Amount is set by the item owner\n• Shown separately from the rental cost everywhere in the app\n\nCheck "Transaction History" in Settings to see all your deposits — held or refunded — with downloadable receipts.`;
        }

        // Profile & verification
        if (lowerMessage.includes('profile') || lowerMessage.includes('account') || lowerMessage.includes('verify') || lowerMessage.includes('otp')) {
            return `Manage your profile:\n\n• Update personal information, phone, and bio\n• Verify your phone number with a 6-digit OTP code for a trust badge\n• View your borrow/lend stats and rating\n• Change your profile photo\n\nGo to your Profile page, and look for the "Verify Phone" badge next to your phone number to get verified!`;
        }

        // Messages
        if (lowerMessage.includes('message') || lowerMessage.includes('chat')) {
            return `In-app messaging:\n\n• Contact item owners directly once you've unlocked their details\n• Discuss pickup/return arrangements\n• Coordinate meeting points and timing\n• Messages before payment are filtered to block phone numbers/addresses for safety\n\nYou'll get a notification badge (🔔) whenever you receive a new message!`;
        }

        // Requests
        if (lowerMessage.includes('request') || lowerMessage.includes('approve')) {
            return `Managing requests:\n\n• Incoming: Requests for your items — approve or decline them\n• Outgoing: Your requests to borrow — track their status\n• A visual "Request Journey" tracker shows where each request stands\n• Email notifications are sent automatically when a request is approved or declined\n\nGo to the Requests page to manage everything!`;
        }

        // Items management
        if (lowerMessage.includes('my items') || lowerMessage.includes('manage items') || lowerMessage.includes('edit item')) {
            return `Managing your listed items:\n\n• View all your listings with photos and stats\n• Edit item details anytime — name, price, description, photos, and more\n• Pause or reactivate listings\n• Delete items you no longer want to lend\n• See ratings and how many times each item was borrowed\n\nGo to "My Items" from your Dashboard to manage everything!`;
        }

        // Dark mode
        if (lowerMessage.includes('dark mode') || lowerMessage.includes('theme') || lowerMessage.includes('appearance')) {
            return `🌙 Dark Mode:\n\n• Go to Settings → Appearance to toggle it\n• Or use the floating moon/sun button in the bottom-right corner of any page\n• Your choice is saved automatically and applies across the whole app\n\nIt also auto-matches your device's theme the first time you visit!`;
        }

        // Pricing
        if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('rupee')) {
            return `Pricing information:\n\n• All prices are in ₹ (Indian Rupees)\n• Set price per day or mark as Free when listing\n• Total = Days × Price per day\n• Instant Access fee = ₹10 + 10% of the rental total (or 100 points instead)\n• Security deposits are separate and fully refundable\n\nExample: ₹50/day for 3 days = ₹150 rental total`;
        }

        // Empty items
        if (lowerMessage.includes('no items') || lowerMessage.includes('empty')) {
            return `If you see "No items available":\n\n• No one has listed items in that category yet\n• Be the first to list one — click "Add Item"!\n• Try browsing a different category or clearing filters\n\nStart building the community by listing items you can lend!`;
        }

        // Transactions / receipts
        if (lowerMessage.includes('transaction') || lowerMessage.includes('receipt') || lowerMessage.includes('payment history')) {
            return `📄 Transaction History:\n\n• Go to Settings → Transaction History\n• See every payment you've made and earned, with filters and search\n• Download a printable receipt (PDF) for any transaction\n• Track which security deposits are held vs. already refunded\n\nEverything is organized with running totals at the top!`;
        }

        // General help
        if (lowerMessage.includes('help') || lowerMessage.includes('how') || lowerMessage.includes('?')) {
            return `I can help you with:\n\n• How to borrow items (Standard vs Instant Access)\n• How to lend items\n• Points & referrals\n• Returning items & security deposits\n• Managing requests\n• Profile & phone verification\n• Transaction history & receipts\n• Dark mode\n\nWhat would you like to know more about?`;
        }

        // Default response
        return `I'm here to help! I can assist with:\n\n• Borrowing & lending items\n• Instant Access & referral points\n• Returning items & deposits\n• Managing your profile\n• Transaction history\n• Dark mode & settings\n\nCould you please be more specific about what you need help with?`;
    }
}

// Initialize AI Assistant when DOM is ready
let aiAssistant;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { aiAssistant = new AIAssistant(); });
} else {
    aiAssistant = new AIAssistant();
}