// ─── BorrowBuddy Checkout — Razorpay integration ─────────────────────────────
const API_URL = self.BORROWBUDDY_CONFIG.API_BASE_URL;

let selectedPaymentMethod = 'card';
let itemData = {};

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const token = getToken();
    if (!token) { window.location.href = 'login.html'; return; }

    loadItemDetails();
    selectPaymentMethod('card');
});

function getToken() {
    return localStorage.getItem('authToken') || localStorage.getItem('token');
}

// ─── Item details from URL params ─────────────────────────────────────────────
function loadItemDetails() {
    const p = new URLSearchParams(window.location.search);

    itemData = {
        itemId:      p.get('itemId')    || '',
        itemName:    p.get('itemName')  || p.get('item') || 'Item',
        itemImage:   p.get('itemImage') || 'https://via.placeholder.com/150',
        deposit:     parseFloat(p.get('deposit')    || p.get('amount') || '50'),
        serviceFee:  parseFloat(p.get('serviceFee') || '5'),
        rentalDays:  parseInt(p.get('days')          || '7'),
        description: p.get('description') || 'Item rental'
    };

    document.getElementById('itemName').textContent        = itemData.itemName;
    document.getElementById('itemDescription').textContent = itemData.description;
    document.getElementById('itemImage').src               = itemData.itemImage;
    document.getElementById('depositAmount').textContent   = `₹${itemData.deposit.toFixed(2)}`;
    document.getElementById('serviceFee').textContent      = `₹${itemData.serviceFee.toFixed(2)}`;
    document.getElementById('rentalPeriod').textContent    = `${itemData.rentalDays} days`;
    document.getElementById('totalAmount').textContent     = `₹${(itemData.deposit + itemData.serviceFee).toFixed(2)}`;
}

// ─── Payment method selection ─────────────────────────────────────────────────
function selectPaymentMethod(method) {
    selectedPaymentMethod = method;

    document.querySelectorAll('input[name="paymentMethod"]').forEach(r => {
        r.checked = (r.id === method);
    });
    document.querySelectorAll('.payment-option').forEach(el => {
        el.classList.remove('selected');
    });
    const chosen = document.querySelector(`#${method}`)?.closest('.payment-option');
    if (chosen) chosen.classList.add('selected');

    document.querySelectorAll('.payment-option-content').forEach(c => c.classList.add('hidden'));
    const content = document.getElementById(method + 'Content');
    if (content) content.classList.remove('hidden');
}

// ─── Main payment trigger ─────────────────────────────────────────────────────
async function proceedToPayment() {
    if (!itemData.itemId) {
        showError('No item selected. Please go back and select an item.');
        return;
    }

    showLoading();

    try {
        const total = itemData.deposit + itemData.serviceFee;
        await openRazorpay(total);
    } catch (err) {
        hideLoading();
        showError(err.message || 'Payment failed. Please try again.');
    }
}

// ─── Razorpay flow ────────────────────────────────────────────────────────────
async function openRazorpay(amount) {
    const token = getToken();

    // Step 1 — Create order on backend
    const orderRes = await fetch(`${API_URL}/api/payments/create-order`, {
        method:  'POST',
        headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            amount:   amount,
            itemId:   itemData.itemId,
            itemName: itemData.itemName
        })
    });

    const orderData = await orderRes.json();
    if (!orderData.success) throw new Error(orderData.message || 'Could not create order');

    hideLoading();   // hide spinner while Razorpay popup is open

    // Step 2 — Open Razorpay checkout popup
    return new Promise((resolve, reject) => {
        const options = {
            key:         orderData.keyId,
            amount:      orderData.amount,      // paise
            currency:    'INR',
            name:        'BorrowBuddy',
            description: `Rental: ${itemData.itemName}`,
            order_id:    orderData.orderId,
            prefill: {
                name:  localStorage.getItem('username') || '',
                email: localStorage.getItem('email')    || ''
            },
            theme: { color: '#6366f1' },

            handler: async function (response) {
                // Step 3 — Verify on backend
                showLoading();
                try {
                    const verifyRes = await fetch(`${API_URL}/api/payments/verify`, {
                        method:  'POST',
                        headers: {
                            'Content-Type':  'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            razorpay_order_id:   response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature:  response.razorpay_signature,
                            itemId:              itemData.itemId
                        })
                    });

                    const verifyData = await verifyRes.json();
                    hideLoading();

                    if (!verifyData.success) {
                        reject(new Error(verifyData.message || 'Payment verification failed'));
                        return;
                    }

                    showSuccess(response.razorpay_payment_id);
                    resolve();
                } catch (err) {
                    hideLoading();
                    reject(err);
                }
            },

            modal: {
                ondismiss: () => {
                    reject(new Error('Payment was cancelled'));
                }
            }
        };

        if (typeof Razorpay === 'undefined') {
            reject(new Error('Razorpay SDK not loaded. Please refresh the page.'));
            return;
        }

        const rzp = new Razorpay(options);

        rzp.on('payment.failed', function (response) {
            reject(new Error(response.error.description || 'Payment failed'));
        });

        rzp.open();
    });
}

// ─── UPI verification (UI only — actual charge goes through Razorpay popup) ───
function verifyUPI() {
    const upiId = document.getElementById('upiId')?.value?.trim();
    if (!upiId)               { showError('Please enter your UPI ID');                           return; }
    if (!upiId.includes('@')) { showError('Invalid UPI ID format. Example: yourname@paytm');      return; }
    alert('✓ UPI ID looks valid! Click "Use this payment method" to proceed.');
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
}
function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

function showSuccess(paymentId) {
    document.getElementById('bookingId').textContent = paymentId;
    document.getElementById('successModal').classList.remove('hidden');

    // ── Record transaction in localStorage ───────────────────
    const borrowerUsername = localStorage.getItem('username');
    const ownerUsername    = new URLSearchParams(window.location.search).get('owner') || itemData.owner || '';
    const now              = new Date().toISOString().split('T')[0];
    const borrowTo         = new Date(Date.now() + itemData.rentalDays * 86400000).toISOString().split('T')[0];

    // Save to borrower's borrowed_ list
    if (borrowerUsername) {
        const borrowedKey  = `borrowed_${borrowerUsername}`;
        const borrowedList = JSON.parse(localStorage.getItem(borrowedKey) || '[]');
        borrowedList.push({
            id:          itemData.itemId,
            itemName:    itemData.itemName,
            image:       itemData.itemImage,
            owner:       ownerUsername,
            status:      'active',
            borrowFrom:  now,
            borrowTo:    borrowTo,
            totalPaid:   itemData.deposit + itemData.serviceFee,
            paymentId:   paymentId,
            rentalDays:  itemData.rentalDays
        });
        localStorage.setItem(borrowedKey, JSON.stringify(borrowedList));
    }

    // Save to owner's lent_ list
    if (ownerUsername && ownerUsername !== borrowerUsername) {
        const lentKey  = `lent_${ownerUsername}`;
        const lentList = JSON.parse(localStorage.getItem(lentKey) || '[]');
        lentList.push({
            id:          itemData.itemId,
            itemName:    itemData.itemName,
            image:       itemData.itemImage,
            borrower:    borrowerUsername,
            status:      'active',
            borrowFrom:  now,
            borrowTo:    borrowTo,
            totalEarned: itemData.deposit,
            paymentId:   paymentId,
            rentalDays:  itemData.rentalDays
        });
        localStorage.setItem(lentKey, JSON.stringify(lentList));
    }
}

function showError(message) {
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorModal').classList.remove('hidden');
}
function hideError() {
    document.getElementById('errorModal').classList.add('hidden');
}

function goToDashboard() {
    window.location.href = 'dashboard-enhanced.html';
}

// ─── Expose globals ───────────────────────────────────────────────────────────
window.selectPaymentMethod = selectPaymentMethod;
window.proceedToPayment    = proceedToPayment;
window.verifyUPI           = verifyUPI;
window.goToDashboard       = goToDashboard;
window.hideError           = hideError;