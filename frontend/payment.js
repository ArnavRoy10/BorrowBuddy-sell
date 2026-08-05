// Payment Page JavaScript with Stripe Integration

const API_URL = self.BORROWBUDDY_CONFIG.API_BASE_URL;
const STRIPE_PUBLISHABLE_KEY = 'pk_test_your_stripe_publishable_key'; // Will be set via backend config

// Initialize Stripe
let stripe;
let elements;
let cardElement;
let clientSecret;

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);

async function init() {
    // Check if user is logged in
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (!isLoggedIn) {
        window.location.href = 'login.html';
        return;
    }

    // Get payment details from URL or localStorage
    loadPaymentDetails();

    // Initialize Stripe
    await initializeStripe();

    // Set up form submission
    const form = document.getElementById('payment-form');
    form.addEventListener('submit', handleSubmit);

    // Pre-fill email
    const userEmail = localStorage.getItem('email');
    if (userEmail) {
        document.getElementById('email').value = userEmail;
    }
}

function loadPaymentDetails() {
    // Get payment info from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const itemName = urlParams.get('item') || 'Item Rental';
    const amount = parseFloat(urlParams.get('amount')) || 50.00;
    const type = urlParams.get('type') || 'deposit';

    // Update UI
    document.getElementById('itemName').textContent = itemName;
    document.getElementById('paymentType').textContent = formatPaymentType(type);
    document.getElementById('totalAmount').textContent = `$${amount.toFixed(2)}`;

    // Store for later use
    window.paymentData = {
        itemName,
        amount,
        type,
        currency: 'usd'
    };
}

function formatPaymentType(type) {
    const types = {
        'deposit': 'Security Deposit',
        'service_fee': 'Service Fee',
        'rental': 'Rental Fee',
        'late_fee': 'Late Fee',
        'damage_fee': 'Damage Fee'
    };
    return types[type] || 'Payment';
}

async function initializeStripe() {
    try {
        // Get Stripe publishable key from backend
        const response = await fetch(`${API_URL}/api/payments/config`);
        const config = await response.json();
        
        if (config.success) {
            stripe = Stripe(config.publishableKey);
            
            // Create card element
            elements = stripe.elements();
            cardElement = elements.create('card', {
                style: {
                    base: {
                        fontSize: '16px',
                        color: '#1f2937',
                        '::placeholder': {
                            color: '#9ca3af',
                        },
                    },
                    invalid: {
                        color: '#ef4444',
                    },
                },
                hidePostalCode: false
            });

            cardElement.mount('#card-element');

            // Handle real-time validation errors
            cardElement.on('change', function(event) {
                const displayError = document.getElementById('card-errors');
                if (event.error) {
                    displayError.textContent = event.error.message;
                } else {
                    displayError.textContent = '';
                }
            });
        }
    } catch (error) {
        console.error('Stripe initialization error:', error);
        showError('Failed to initialize payment system. Please refresh and try again.');
    }
}

async function handleSubmit(event) {
    event.preventDefault();

    // Disable submit button
    setLoading(true);

    try {
        // Step 1: Create payment intent
        const { amount, type, itemName, currency } = window.paymentData;
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');

        const intentResponse = await fetch(`${API_URL}/api/payments/create-intent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                amount,
                currency,
                type,
                metadata: {
                    itemName,
                    userName: localStorage.getItem('username')
                }
            })
        });

        const intentData = await intentResponse.json();

        if (!intentData.success) {
            throw new Error(intentData.message || 'Failed to create payment');
        }

        clientSecret = intentData.clientSecret;

        // Step 2: Confirm payment with Stripe
        const cardHolderName = document.getElementById('card-holder-name').value;
        const email = document.getElementById('email').value;

        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
                card: cardElement,
                billing_details: {
                    name: cardHolderName,
                    email: email
                }
            }
        });

        if (error) {
            throw new Error(error.message);
        }

        // Step 3: Confirm payment in backend
        await confirmPaymentInBackend(paymentIntent.id);

        // Show success
        showSuccess();

    } catch (error) {
        console.error('Payment error:', error);
        showError(error.message || 'Payment failed. Please try again.');
        setLoading(false);
    }
}

async function confirmPaymentInBackend(paymentIntentId) {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');

    const response = await fetch(`${API_URL}/api/payments/confirm`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ paymentIntentId })
    });

    const data = await response.json();

    if (!data.success) {
        throw new Error('Failed to confirm payment');
    }

    return data;
}

function setLoading(isLoading) {
    const submitButton = document.getElementById('submit-button');
    const buttonText = document.getElementById('button-text');
    const spinner = document.getElementById('spinner');

    if (isLoading) {
        submitButton.disabled = true;
        buttonText.textContent = 'Processing...';
        spinner.classList.remove('hidden');
    } else {
        submitButton.disabled = false;
        buttonText.textContent = 'Pay Now';
        spinner.classList.add('hidden');
    }
}

function showSuccess() {
    const modal = document.getElementById('successModal');
    modal.classList.remove('hidden');
}

function showError(message) {
    const modal = document.getElementById('errorModal');
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = message;
    modal.classList.remove('hidden');
}

function hideError() {
    const modal = document.getElementById('errorModal');
    modal.classList.add('hidden');
}

function goToDashboard() {
    window.location.href = 'dashboard-enhanced.html';
}

// Make functions global
window.goToDashboard = goToDashboard;
window.hideError = hideError;
