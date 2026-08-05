// Add Item — uses MongoDB Atlas via API (not localStorage)
const API_BASE = self.BORROWBUDDY_CONFIG.API_BASE_URL + '/api';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('addItemForm');
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    const currentUser = localStorage.getItem('username');

    if (!token || !currentUser) {
        alert('Please log in to add items');
        window.location.href = 'login.html';
        return;
    }

    form.addEventListener('submit', handleSubmit);
});

function togglePriceInput() {
    const priceType = document.getElementById('priceType').value;
    const priceGroup = document.getElementById('pricePerDayGroup');
    const priceInput = document.getElementById('pricePerDay');
    if (priceType === 'paid') {
        priceGroup.style.display = 'block';
        priceInput.required = true;
    } else {
        priceGroup.style.display = 'none';
        priceInput.required = false;
        priceInput.value = '';
    }
}

async function handleSubmit(e) {
    e.preventDefault();
    const category = document.getElementById('category').value;
    const priceType = document.getElementById('priceType').value;

    const itemData = {
        owner:              localStorage.getItem('username'),
        name:               document.getElementById('itemName').value.trim(),
        category,
        condition:          document.getElementById('condition').value,
        description:        document.getElementById('description').value.trim(),
        image:              document.getElementById('imageUrl').value.trim() || getDefaultImage(category),
        priceType,
        price:              priceType === 'free' ? 'Free' : `Rs.${document.getElementById('pricePerDay').value}/day`,
        pricePerDay:        priceType === 'free' ? 0 : parseFloat(document.getElementById('pricePerDay').value),
        securityDeposit:    parseFloat(document.getElementById('securityDeposit').value) || 0,
        phoneNumber:        document.getElementById('phoneNumber').value.trim(),
        location:           document.getElementById('location').value.trim(),
        pickupInstructions: document.getElementById('pickupInstructions').value.trim(),
        availableNow:       document.getElementById('availableNow').checked,
        maxBorrowDays:      parseInt(document.getElementById('maxBorrowDays').value) || 7,
        available: true, borrowed: false, borrowedBy: null,
        rating: 0, borrowCount: 0, reviewCount: 0
    };

    if (!itemData.name || !itemData.category || !itemData.condition || !itemData.phoneNumber || !itemData.location) {
        alert('Please fill in all required fields');
        return;
    }

    await saveItem(itemData);
}

async function saveItem(itemData) {
    const submitBtn = document.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }

    try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(itemData)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Failed to save item');
        console.log('Item saved to MongoDB Atlas:', result);
        showSuccessModal();
    } catch (error) {
        console.error('Error saving item:', error);
        if (error.message.includes('fetch') || error.message.includes('Failed')) {
            alert('Cannot connect to backend server.\n\nStart it with:\n  cd backend\n  node server.js');
        } else {
            alert('Error saving item: ' + error.message);
        }
    } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalText; }
    }
}

function getDefaultImage(category) {
    const images = {
        electronics: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400',
        books:       'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=400',
        tools:       'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=400',
        sports:      'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400',
        stationery:  'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=400',
        others:      'https://images.unsplash.com/photo-1572365992253-3cb3e56dd362?w=400'
    };
    return images[category] || images.others;
}

function showSuccessModal() {
    document.getElementById('successModal').classList.remove('hidden');
}

window.togglePriceInput = togglePriceInput;