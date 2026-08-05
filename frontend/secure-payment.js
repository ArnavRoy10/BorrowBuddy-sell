// Secure Payment System - BorrowBuddy
// All amounts in Indian Rupees (₹ INR)

const PLATFORM_SERVICE_FEE_PERCENTAGE = 0.05; // 5%
const MIN_SERVICE_FEE = 25; // Minimum ₹25
const MAX_SERVICE_FEE = 100; // Maximum ₹100
const RAZORPAY_KEY_ID = 'rzp_test_PASTE_YOUR_KEY_HERE';
let currentRequest = null;
let paymentMethod = 'upi';

document.addEventListener('DOMContentLoaded', () => {
    loadPaymentData();
    setupEventListeners();
});

function loadPaymentData() {
    // Get request data from localStorage
    const requestData = localStorage.getItem('pendingPayment');
    
    if (!requestData) {
        alert('No payment request found. Redirecting...');
        window.location.href = 'requests-management.html';
        return;
    }
    
    currentRequest = JSON.parse(requestData);
    displayPaymentBreakdown();
}

function displayPaymentBreakdown() {
    const item = currentRequest;
    
    // Display item preview
    const preview = document.getElementById('itemPreview');
    preview.innerHTML = `
        <img src="${item.itemImage || 'https://via.placeholder.com/80'}" alt="${item.itemName}">
        <div class="item-preview-info">
            <h3>${item.itemName}</h3>
            <p>Duration: ${item.duration} days</p>
            <p>Owner: ${item.itemOwner}</p>
        </div>
    `;
    
    // Calculate fees in INR
    const borrowPrice = item.pricing.rentalFee || 500; // Rental fee (to be paid in cash)
    const deposit = item.pricing.deposit || 500; // Security deposit
    
    // Calculate service fee (5% of borrow price, min ₹25, max ₹100)
    let serviceFee = Math.round(borrowPrice * PLATFORM_SERVICE_FEE_PERCENTAGE);
    serviceFee = Math.max(MIN_SERVICE_FEE, Math.min(MAX_SERVICE_FEE, serviceFee));
    
    // Total online payment = Service Fee + Security Deposit
    const totalOnline = serviceFee + deposit;
    
    // Update all price displays
    document.getElementById('borrowPrice').textContent = `₹${borrowPrice}`;
    document.getElementById('serviceFee').textContent = `₹${serviceFee}`;
    document.getElementById('securityDeposit').textContent = `₹${deposit}`;
    document.getElementById('totalOnline').textContent = `₹${totalOnline}`;
    
    // Update summary section
    document.getElementById('summaryServiceFee').textContent = `₹${serviceFee}`;
    document.getElementById('summaryDeposit').textContent = `₹${deposit}`;
    document.getElementById('summaryTotal').textContent = `₹${totalOnline}`;
    
    // Update pay button
    document.getElementById('payAmount').textContent = totalOnline;
    
    // Update cash payment references
    document.querySelectorAll('#borrowPriceCash, #cashAmount, #cashPayAmount').forEach(el => {
        el.textContent = borrowPrice;
    });
    
    document.getElementById('feeAmount').textContent = serviceFee;
    
    // Store in request object
    currentRequest.calculatedFees = {
        borrowPrice: borrowPrice,
        serviceFee: serviceFee,
        deposit: deposit,
        totalOnline: totalOnline,
        currency: 'INR'
    };
}

function setupEventListeners() {
    // Payment method selection
    document.querySelectorAll('.payment-method-card').forEach(card => {
        card.addEventListener('click', function() {
            document.querySelectorAll('.payment-method-card').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            paymentMethod = this.dataset.method;
        });
    });
    
    // Terms checkbox
    document.getElementById('termsCheck').addEventListener('change', function() {
        document.getElementById('payButton').disabled = !this.checked;
    });
    
    // Pay button
    document.getElementById('payButton').addEventListener('click', processPayment);
}

function processPayment() {
    const currentUser = localStorage.getItem('username');
    
    if (!currentUser) {
        alert('Please log in to continue');
        window.location.href = 'login.html';
        return;
    }
    
    // Show processing
    const payButton = document.getElementById('payButton');
    payButton.disabled = true;
    payButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing Payment...';
    
    // Simulate payment processing (2 seconds)
    setTimeout(() => {
        completePayment();
    }, 2000);
}

function completePayment() {
    const txnId = 'TXN' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();
    const currentUser = localStorage.getItem('username');
    
    // Create payment record
    const paymentRecord = {
        transactionId: txnId,
        requestId: currentRequest.id,
        itemId: currentRequest.itemId,
        itemName: currentRequest.itemName,
        borrower: currentUser,
        owner: currentRequest.itemOwner,
        paymentMethod: paymentMethod,
        serviceFee: currentRequest.calculatedFees.serviceFee,
        securityDeposit: currentRequest.calculatedFees.deposit,
        totalPaid: currentRequest.calculatedFees.totalOnline,
        cashToPay: currentRequest.calculatedFees.borrowPrice,
        currency: 'INR',
        status: 'completed',
        refundStatus: 'pending', // Will be 'refunded' after return
        paidAt: new Date().toISOString(),
        contactDetailsUnlocked: true
    };
    
    // Save payment record
    const payments = JSON.parse(localStorage.getItem('payments')) || [];
    payments.push(paymentRecord);
    localStorage.setItem('payments', JSON.stringify(payments));
    
    // Update request status to 'confirmed'
    updateRequestStatus(currentRequest.id, 'confirmed', txnId);
    
    // Unlock contact details
    unlockContactDetails(currentRequest);
    
    // Mark item as reserved (not available for others)
    reserveItem(currentRequest.itemId, currentUser);
    
    // Show success modal with unlocked details
    showSuccessModal(paymentRecord, currentRequest);
    
    // Clear pending payment
    localStorage.removeItem('pendingPayment');
}

function updateRequestStatus(requestId, newStatus, txnId) {
    const currentUser = localStorage.getItem('username');
    
    // Update in borrower's requests
    const myRequests = JSON.parse(localStorage.getItem(`myRequests_${currentUser}`)) || [];
    const updatedMyRequests = myRequests.map(req => {
        if (req.id === requestId) {
            return {
                ...req,
                status: newStatus,
                transactionId: txnId,
                paidAt: new Date().toISOString(),
                contactUnlocked: true
            };
        }
        return req;
    });
    localStorage.setItem(`myRequests_${currentUser}`, JSON.stringify(updatedMyRequests));
    
    // Update in owner's requests
    const request = myRequests.find(r => r.id === requestId);
    if (request) {
        const ownerRequests = JSON.parse(localStorage.getItem(`requests_${request.itemOwner}`)) || [];
        const updatedOwnerRequests = ownerRequests.map(req => {
            if (req.id === requestId) {
                return {
                    ...req,
                    status: newStatus,
                    transactionId: txnId,
                    paidAt: new Date().toISOString(),
                    contactUnlocked: true
                };
            }
            return req;
        });
        localStorage.setItem(`requests_${request.itemOwner}`, JSON.stringify(updatedOwnerRequests));
    }
}

function unlockContactDetails(request) {
    // Find the item and get full contact details
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('items_') || key.startsWith('userItems_'))) {
            const items = JSON.parse(localStorage.getItem(key)) || [];
            const item = items.find(it => it.id === request.itemId);
            
            if (item) {
                // Store unlocked details
                const unlockedData = {
                    requestId: request.id,
                    itemId: item.id,
                    phone: item.phoneNumber || 'Not provided',
                    address: item.location || 'Not provided',
                    instructions: item.pickupInstructions || 'No special instructions',
                    unlockedAt: new Date().toISOString()
                };
                
                const currentUser = localStorage.getItem('username');
                localStorage.setItem(`unlocked_${currentUser}_${request.id}`, JSON.stringify(unlockedData));
                
                return unlockedData;
            }
        }
    }
    
    return null;
}

function reserveItem(itemId, borrower) {
    // Mark item as reserved/borrowed
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('items_') || key.startsWith('userItems_'))) {
            const items = JSON.parse(localStorage.getItem(key)) || [];
            const updatedItems = items.map(item => {
                if (item.id === itemId) {
                    return {
                        ...item,
                        reserved: true,
                        reservedBy: borrower,
                        reservedAt: new Date().toISOString(),
                        available: false
                    };
                }
                return item;
            });
            localStorage.setItem(key, JSON.stringify(updatedItems));
        }
    }
}

function showSuccessModal(payment, request) {
    // Get unlocked details
    const currentUser = localStorage.getItem('username');
    const unlockedData = JSON.parse(localStorage.getItem(`unlocked_${currentUser}_${request.id}`));
    
    // Update modal content
    document.getElementById('txnId').textContent = payment.transactionId;
    
    if (unlockedData) {
        document.getElementById('unlockedPhone').textContent = unlockedData.phone;
        document.getElementById('unlockedAddress').textContent = unlockedData.address;
        document.getElementById('unlockedInstructions').textContent = unlockedData.instructions;
    }
    
    document.getElementById('cashPayAmount').textContent = payment.cashToPay;
    
    // Show modal
    document.getElementById('successModal').classList.remove('hidden');
    
    // Log to console
    console.log('Payment Successful:', payment);
    console.log('Contact Details Unlocked:', unlockedData);
}

function openChat() {
    const owner = currentRequest.itemOwner;
    window.location.href = `chat.html?user=${owner}`;
}

function goToDashboard() {
    window.location.href = 'dashboard-enhanced.html';
}

function showTerms() {
    alert(`Terms & Conditions:

1. Service Fee (₹${currentRequest.calculatedFees.serviceFee}) is NON-REFUNDABLE
2. Security Deposit (₹${currentRequest.calculatedFees.deposit}) is REFUNDABLE after item return
3. You must pay ₹${currentRequest.calculatedFees.borrowPrice} in CASH to the owner
4. Contact details unlock only after payment
5. Direct payment outside platform violates terms
6. Bypass attempts reduce trust score by 50 points
7. Item must be returned in same condition
8. Both parties must rate each other after transaction

By proceeding, you agree to these terms.`);
}

// Make functions global
window.openChat = openChat;
window.goToDashboard = goToDashboard;
window.showTerms = showTerms;
