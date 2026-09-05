// Item Details Page JavaScript
const ITEMDETAILS_API_URL = self.BORROWBUDDY_CONFIG.API_BASE_URL;

let currentItem   = null;
let currentRating = 0;
let leafletMap    = null;

document.addEventListener('DOMContentLoaded', () => {
    loadItemDetails();
    setupEventListeners();
});

// ── Token helper ──────────────────────────────────────────────────
function getToken() {
    return localStorage.getItem('authToken') || localStorage.getItem('token');
}

// ── Service fee: ₹5 flat if item < ₹50/day, else 5% ─────────────
function calcServiceFee(item) {
    if (!item) return { fee: 0, base: 0, display: '₹0' };
    const raw = item.price;
    if (!raw || raw === 'Free' || raw === 'free') return { fee: 0, base: 0, display: 'Free' };
    const match = raw.toString().match(/[\d.]+/);
    if (!match) return { fee: 0, base: 0, display: 'Free' };
    const perDay = parseFloat(match[0]);
    const fee    = perDay < 50 ? 5 : Math.round(perDay * 0.05 * 100) / 100;
    return { fee, base: perDay, display: `₹${fee.toFixed(2)}` };
}

// ── Load item from backend ────────────────────────────────────────
async function loadItemDetails() {
    const urlParams   = new URLSearchParams(window.location.search);
    const itemId      = urlParams.get('id');
    const instantPay  = urlParams.get('instantPay') === '1';
    const usedPoints  = urlParams.get('usedPoints') === '1';

    if (!itemId) {
        alert('No item selected. Returning to browse.');
        window.location.href = 'browse.html';
        return;
    }

    try {
        const token   = getToken();
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res     = await fetch(`${ITEMDETAILS_API_URL}/api/items/${itemId}`, { headers });
        const data    = await res.json();
        if (!res.ok) throw new Error(data.message || 'Item not found');

        currentItem = data.item || data;
        displayItemDetails(currentItem);
        loadReviews(currentItem.id || currentItem._id);

        // If arriving from "Use Points Instead", unlock immediately — no payment needed
        if (instantPay && usedPoints) {
            unlockWithPoints();
        } else if (instantPay) {
            // Paid Instant Access path — this was previously a dead end
            processInstantPayment(parseFloat(urlParams.get('fee')) || 0);
        } else {
            // Normal visit — restore unlock state if this user already paid before
            checkAlreadyUnlocked(currentItem.id || currentItem._id);
        }
    } catch (err) {
        console.error('Failed to load item:', err);
        alert('Item not found. Returning to browse.');
        window.location.href = 'browse.html';
    }
}

// ── Restore unlock state on normal page visits (previously never checked,
// so contact details showed as locked again even after a successful payment) ──
async function checkAlreadyUnlocked(itemId) {
    if (!itemId) return;
    const token = getToken();
    if (!token) return;
    try {
        const res  = await fetch(`${ITEMDETAILS_API_URL}/api/payments/unlocked/${itemId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.unlocked && currentItem) {
            currentItem.unlocked = true;
            renderContactSection(currentItem, true, false);
        }
    } catch (err) {
        console.warn('Could not check unlock status:', err.message);
    }
}

// ── Paid Instant Access — this was the missing piece: the redirect from
// borrow-request.js landed here but nothing ever opened the payment popup ──
async function processInstantPayment(fee) {
    const token = getToken();
    if (!token) { alert('Please log in again.'); window.location.href = 'login.html'; return; }
    if (!currentItem) { alert('Item not loaded yet, please try again.'); return; }

    const pending = JSON.parse(localStorage.getItem('pendingBorrow') || '{}');
    const itemId  = currentItem.id || currentItem._id;

    try {
        // Step 1 — create order
        const orderRes = await fetch(`${ITEMDETAILS_API_URL}/api/payments/create-order`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body:    JSON.stringify({ amount: fee, itemId, itemName: currentItem.name })
        });
        const orderData = await orderRes.json();
        if (!orderData.success) throw new Error(orderData.message || 'Could not start payment');

        if (fee <= 0 || typeof Razorpay === 'undefined') {
            // Free unlock (₹0 fee) or Razorpay script unavailable — skip straight to verify-less unlock
            return finishInstantUnlock({ razorpay_payment_id: 'free_' + Date.now() }, pending);
        }

        // Step 2 — open Razorpay popup
        const options = {
            key:         orderData.keyId,
            amount:      orderData.amount,
            currency:    'INR',
            name:        'BorrowBuddy',
            description: `Instant unlock: ${currentItem.name}`,
            order_id:    orderData.orderId,
            prefill: {
                name:  localStorage.getItem('username') || '',
                email: localStorage.getItem('email')    || ''
            },
            theme:  { color: '#7c3aed' },
            handler: async function (response) {
                await verifyInstantPayment(response, pending);
            },
            modal: {
                ondismiss: function () {
                    console.log('Instant unlock payment cancelled by user');
                }
            }
        };
        const rzp = new Razorpay(options);
        rzp.open();

    } catch (err) {
        console.error('Instant payment error:', err);
        alert(err.message || 'Payment could not be started. Please try again.');
    }
}

async function verifyInstantPayment(response, pending) {
    const token = getToken();
    try {
        const verifyRes = await fetch(`${ITEMDETAILS_API_URL}/api/payments/verify`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
                itemId:              currentItem.id || currentItem._id,
                ownerUsername:       currentItem.owner,
                itemName:            currentItem.name,
                itemImage:           (currentItem.images && currentItem.images[0]) || currentItem.image || '',
                fromDate:            pending.fromDate,
                toDate:              pending.toDate
            })
        });
        const verifyData = await verifyRes.json();
        if (!verifyData.success) {
            alert(verifyData.message || 'Payment verification failed.');
            return;
        }
        finishInstantUnlock(response, pending);
    } catch (err) {
        console.error('Verify instant payment error:', err);
        alert('Payment succeeded but verification failed — please contact support with your payment ID: ' + response.razorpay_payment_id);
    }
}

function finishInstantUnlock(response, pending) {
    localStorage.removeItem('pendingBorrow');
    currentItem.unlocked = true;
    renderContactSection(currentItem, true, false);
    showUnlockSuccess();

    // Clean the query params so a refresh doesn't try to pay again
    const cleanUrl = `${window.location.pathname}?id=${currentItem.id || currentItem._id}`;
    window.history.replaceState({}, '', cleanUrl);
}

// ── Unlock contact details after points redemption (no payment step) ──
function unlockWithPoints() {
    const pending = JSON.parse(localStorage.getItem('pendingBorrow') || '{}');

    // Record the borrow same as a paid instant unlock, but with ₹0 fee
    const borrowerUsername = localStorage.getItem('username');
    if (borrowerUsername && currentItem) {
        const borrowedKey  = `borrowed_${borrowerUsername}`;
        const borrowedList = JSON.parse(localStorage.getItem(borrowedKey) || '[]');
        borrowedList.push({
            id:              currentItem.id || currentItem._id,
            itemName:        currentItem.name,
            itemImage:       (currentItem.images && currentItem.images[0]) || currentItem.image || '',
            owner:           currentItem.owner,
            borrowFrom:      pending.fromDate,
            borrowTo:        pending.toDate,
            status:          'active',
            totalPaid:       '0 (Points redeemed)',
            securityDeposit: currentItem.securityDeposit || 0,
            paymentId:       'points_' + Date.now(),
            createdAt:       new Date().toISOString()
        });
        localStorage.setItem(borrowedKey, JSON.stringify(borrowedList));
    }

    localStorage.removeItem('pendingBorrow');

    // Show unlocked contact details on the page
    if (typeof displayItemDetails === 'function' && currentItem) {
        currentItem.unlocked = true;
        displayItemDetails(currentItem);
    }

    // Success banner
    const banner = document.createElement('div');
    banner.style.cssText = `
        position:fixed;top:1.5rem;left:50%;transform:translateX(-50%);z-index:99999;
        background:linear-gradient(135deg,#7c3aed,#2563eb);color:white;
        padding:0.9rem 1.75rem;border-radius:14px;font-weight:700;font-size:0.9rem;
        box-shadow:0 12px 40px rgba(124,58,237,0.4);display:flex;align-items:center;gap:0.6rem;
    `;
    banner.innerHTML = `<i class="fas fa-star"></i> Unlocked using 100 points! Contact details revealed below.`;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 5000);
}

// ── Display all item details ──────────────────────────────────────
function displayItemDetails(item) {
    document.getElementById('itemName').textContent = item.name || 'Loading...';

    // ── Image Slideshow ──────────────────────────────────────────
    const images = (item.images && item.images.filter(Boolean).length > 0)
        ? item.images.filter(Boolean)
        : [item.image || 'https://images.unsplash.com/photo-1572365992253-3cb3e56dd362?w=400'];

    const mainImage           = document.getElementById('mainImage');
    const thumbnailsContainer = document.getElementById('thumbnails');
    let currentIndex = 0;

    mainImage.src = images[0];
    mainImage.style.transition = 'opacity 0.2s';
    mainImage.onerror = () => mainImage.src = 'https://images.unsplash.com/photo-1572365992253-3cb3e56dd362?w=400';

    // Click the main image to open the zoom lightbox at the current slide
    mainImage.style.cursor = 'zoom-in';
    mainImage.addEventListener('click', () => openZoomLightbox(images, currentIndex));

    const mainImageContainer = mainImage.parentElement;
    mainImageContainer.style.position = 'relative';
    mainImageContainer.querySelectorAll('.img-arrow').forEach(a => a.remove());

    if (images.length > 1) {
        const arrowBase = 'position:absolute;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.5);color:white;border:none;width:38px;height:38px;font-size:1.4rem;cursor:pointer;border-radius:50%;z-index:10;display:flex;align-items:center;justify-content:center';

        const prevBtn = document.createElement('button');
        prevBtn.innerHTML = '&#8249;';
        prevBtn.className = 'img-arrow';
        prevBtn.setAttribute('style', arrowBase + ';left:10px');

        const nextBtn = document.createElement('button');
        nextBtn.innerHTML = '&#8250;';
        nextBtn.className = 'img-arrow';
        nextBtn.setAttribute('style', arrowBase + ';right:10px');

        const counter = document.createElement('div');
        counter.className = 'img-arrow';
        counter.style.cssText = 'position:absolute;bottom:10px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.5);color:white;padding:2px 10px;border-radius:10px;font-size:0.8rem;z-index:10';
        counter.textContent = '1 / ' + images.length;

        const goTo = (index) => {
            currentIndex = (index + images.length) % images.length;
            mainImage.style.opacity = '0';
            setTimeout(() => {
                mainImage.src = images[currentIndex];
                mainImage.style.opacity = '1';
                counter.textContent = (currentIndex + 1) + ' / ' + images.length;
            }, 150);
            thumbnailsContainer.querySelectorAll('.thumbnail').forEach((t, i) => {
                t.style.opacity = i === currentIndex ? '1' : '0.6';
                t.classList.toggle('active', i === currentIndex);
            });
        };

        prevBtn.addEventListener('click', () => goTo(currentIndex - 1));
        nextBtn.addEventListener('click', () => goTo(currentIndex + 1));
        mainImageContainer.appendChild(prevBtn);
        mainImageContainer.appendChild(nextBtn);
        mainImageContainer.appendChild(counter);
    }

    thumbnailsContainer.innerHTML = images.map((src, i) => `
        <div class="thumbnail ${i === 0 ? 'active' : ''}" data-index="${i}"
             style="cursor:pointer;opacity:${i === 0 ? '1' : '0.6'};transition:opacity 0.2s">
            <img src="${src}" alt="Thumbnail ${i + 1}"
                 onerror="this.src='https://images.unsplash.com/photo-1572365992253-3cb3e56dd362?w=400'">
        </div>
    `).join('');

    thumbnailsContainer.querySelectorAll('.thumbnail').forEach((thumb, i) => {
        thumb.addEventListener('click', () => {
            currentIndex = i;
            mainImage.style.opacity = '0';
            setTimeout(() => { mainImage.src = images[i]; mainImage.style.opacity = '1'; }, 150);
            thumbnailsContainer.querySelectorAll('.thumbnail').forEach((t, j) => {
                t.classList.toggle('active', j === i);
                t.style.opacity = j === i ? '1' : '0.6';
            });
        });
    });

    // ── Rating ───────────────────────────────────────────────────
    const reviews      = JSON.parse(localStorage.getItem(`reviews_${item.id}`)) || [];
    const actualRating = reviews.length > 0 ? calculateAverageRating(reviews) : 0;
    document.getElementById('ratingValue').textContent = reviews.length > 0 ? actualRating.toFixed(1) : '0';
    document.getElementById('reviewCount').textContent = reviews.length === 0 ? '0 reviews' : `${reviews.length} review${reviews.length > 1 ? 's' : ''}`;
    displayStars('itemStars', actualRating);

    // ── Description & Details ────────────────────────────────────
    document.getElementById('itemDescription').innerHTML = `<li>${item.description || 'No description available'}</li>`;
    document.getElementById('itemCategory').textContent  = item.category  || 'Electronics';
    document.getElementById('itemCondition').textContent = item.condition || 'Good';

    // ── Location display ─────────────────────────────────────────
    const fullLocation = item.location || 'Location unavailable';
    const locationEl   = document.getElementById('itemLocationPrimary');
    if (locationEl) {
        locationEl.innerHTML = `<i class="fas fa-map-marker-alt" style="color:#007bff;margin-right:4px"></i>${fullLocation}`;
    }

    // ── Availability Status ───────────────────────────────────────
    renderAvailabilityStatus(item);

    // ── Leaflet Map ──────────────────────────────────────────────
    initMap(item);

    // ── Owner info ───────────────────────────────────────────────
    const ownerName = item.owner || item.username || 'Unknown User';
    document.getElementById('ownerName').textContent = ownerName;

    // ── Unlock state comes from backend (item.unlocked) ──────────
    // item.phone is only non-null when backend confirmed payment
    const itemId      = item.id || item._id;
    const currentUser = localStorage.getItem('username');
    const isOwner     = currentUser && (currentUser === item.owner);

    // Backend sets item.unlocked = true when payment verified
    const unlocked = !!item.unlocked;

    renderContactSection(item, unlocked, isOwner);
    renderBorrowButton(item, isOwner);
}

// ── Image zoom lightbox ─────────────────────────────────────────────
let zoomImages   = [];
let zoomIndex    = 0;
let zoomScale    = 1;
let zoomPanX     = 0;
let zoomPanY     = 0;
let zoomDragging = false;
let zoomDragStart = { x: 0, y: 0 };
let zoomPanStart   = { x: 0, y: 0 };
let zoomPinchDist  = null;

function openZoomLightbox(images, startIndex) {
    zoomImages = images;
    zoomIndex  = startIndex || 0;
    renderZoomImage();
    document.getElementById('zoomLightbox').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeZoomLightbox() {
    document.getElementById('zoomLightbox').classList.remove('open');
    document.body.style.overflow = '';
    resetZoomTransform();
}

function renderZoomImage() {
    const img     = document.getElementById('zoomImage');
    const counter = document.getElementById('zoomCounter');
    const prevBtn = document.getElementById('zoomPrev');
    const nextBtn = document.getElementById('zoomNext');

    img.src = zoomImages[zoomIndex];
    img.onerror = () => { img.src = 'https://images.unsplash.com/photo-1572365992253-3cb3e56dd362?w=400'; };
    counter.textContent = `${zoomIndex + 1} / ${zoomImages.length}`;

    const multi = zoomImages.length > 1;
    prevBtn.style.display = multi ? 'flex' : 'none';
    nextBtn.style.display = multi ? 'flex' : 'none';
    counter.style.display = multi ? 'block' : 'none';

    resetZoomTransform();
}

function zoomNext() {
    zoomIndex = (zoomIndex + 1) % zoomImages.length;
    renderZoomImage();
}

function zoomPrev() {
    zoomIndex = (zoomIndex - 1 + zoomImages.length) % zoomImages.length;
    renderZoomImage();
}

function resetZoomTransform() {
    zoomScale = 1;
    zoomPanX = 0;
    zoomPanY = 0;
    applyZoomTransform();
    document.getElementById('zoomStage').classList.remove('zoomed');
}

function applyZoomTransform() {
    const img = document.getElementById('zoomImage');
    img.style.transform = `translate(${zoomPanX}px, ${zoomPanY}px) scale(${zoomScale})`;
}

function toggleZoomAt(clientX, clientY) {
    const stage = document.getElementById('zoomStage');
    if (zoomScale === 1) {
        const rect = stage.getBoundingClientRect();
        const offsetX = clientX - (rect.left + rect.width / 2);
        const offsetY = clientY - (rect.top + rect.height / 2);
        zoomScale = 2.5;
        zoomPanX = -offsetX * (zoomScale - 1) / zoomScale;
        zoomPanY = -offsetY * (zoomScale - 1) / zoomScale;
        stage.classList.add('zoomed');
    } else {
        resetZoomTransform();
    }
    applyZoomTransform();
}

(function initZoomLightbox() {
    document.addEventListener('DOMContentLoaded', () => {
        const stage   = document.getElementById('zoomStage');
        const img     = document.getElementById('zoomImage');
        const prevBtn = document.getElementById('zoomPrev');
        const nextBtn = document.getElementById('zoomNext');
        if (!stage || !img) return;

        // Click image: toggle zoom in/out at the clicked point
        img.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleZoomAt(e.clientX, e.clientY);
        });

        // Mouse wheel: zoom in/out, clamped
        stage.addEventListener('wheel', (e) => {
            e.preventDefault();
            const prevScale = zoomScale;
            zoomScale = Math.min(4, Math.max(1, zoomScale - e.deltaY * 0.0025));
            if (zoomScale === 1) { zoomPanX = 0; zoomPanY = 0; stage.classList.remove('zoomed'); }
            else stage.classList.add('zoomed');
            applyZoomTransform();
        }, { passive: false });

        // Drag to pan when zoomed in
        img.addEventListener('mousedown', (e) => {
            if (zoomScale === 1) return;
            zoomDragging = true;
            zoomDragStart = { x: e.clientX, y: e.clientY };
            zoomPanStart  = { x: zoomPanX, y: zoomPanY };
        });
        window.addEventListener('mousemove', (e) => {
            if (!zoomDragging) return;
            zoomPanX = zoomPanStart.x + (e.clientX - zoomDragStart.x);
            zoomPanY = zoomPanStart.y + (e.clientY - zoomDragStart.y);
            applyZoomTransform();
        });
        window.addEventListener('mouseup', () => { zoomDragging = false; });

        // Touch: drag to pan, pinch to zoom, double-tap to toggle
        let lastTap = 0;
        img.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const now = Date.now();
                if (now - lastTap < 300) {
                    toggleZoomAt(e.touches[0].clientX, e.touches[0].clientY);
                }
                lastTap = now;
                if (zoomScale > 1) {
                    zoomDragging = true;
                    zoomDragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                    zoomPanStart  = { x: zoomPanX, y: zoomPanY };
                }
            } else if (e.touches.length === 2) {
                zoomPinchDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
            }
        }, { passive: true });

        img.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1 && zoomDragging) {
                zoomPanX = zoomPanStart.x + (e.touches[0].clientX - zoomDragStart.x);
                zoomPanY = zoomPanStart.y + (e.touches[0].clientY - zoomDragStart.y);
                applyZoomTransform();
            } else if (e.touches.length === 2 && zoomPinchDist != null) {
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                zoomScale = Math.min(4, Math.max(1, zoomScale * (dist / zoomPinchDist)));
                zoomPinchDist = dist;
                stage.classList.toggle('zoomed', zoomScale > 1);
                applyZoomTransform();
            }
        }, { passive: true });

        img.addEventListener('touchend', (e) => {
            if (e.touches.length === 0) { zoomDragging = false; zoomPinchDist = null; }
        });

        prevBtn.addEventListener('click', (e) => { e.stopPropagation(); zoomPrev(); });
        nextBtn.addEventListener('click', (e) => { e.stopPropagation(); zoomNext(); });

        // Keyboard: Esc to close, arrows to navigate
        document.addEventListener('keydown', (e) => {
            const lightbox = document.getElementById('zoomLightbox');
            if (!lightbox.classList.contains('open')) return;
            if (e.key === 'Escape') closeZoomLightbox();
            else if (e.key === 'ArrowRight') zoomNext();
            else if (e.key === 'ArrowLeft') zoomPrev();
        });
    });
})();


function renderContactSection(item, unlocked, isOwner) {
    const contactInfo = document.getElementById('contactInfo');
    if (!contactInfo) return;

    const itemId          = item.id || item._id;
    const { fee, display } = calcServiceFee(item);

    if (isOwner) {
        const phone = item.phoneNumber || item.phone || 'No phone number saved';
        contactInfo.innerHTML = `
            <h5><i class="fas fa-address-card"></i> Contact Details</h5>
            <div class="contact-item">
                <i class="fas fa-phone"></i>
                <span>${phone}</span>
            </div>
            <div class="contact-item">
                <i class="fas fa-map-marker-alt"></i>
                <span>${item.locationPrimary || item.location || 'Not provided'}</span>
            </div>
            <div style="margin-top:0.75rem;padding:0.6rem 1rem;background:#eff6ff;border-radius:8px;font-size:0.82rem;color:#1d4ed8;">
                <i class="fas fa-info-circle"></i> This is your item — details always visible to you.
            </div>
        `;
        return;
    }

    if (unlocked) {
        // item.phoneNumber is saved by lend.js; item.phone is legacy field name
        const phone = item.phoneNumber || item.phone || 'Not provided by owner';
        contactInfo.innerHTML = `
            <h5 style="display:flex;align-items:center;gap:0.5rem">
                <i class="fas fa-unlock" style="color:#10b981"></i> Contact Details
                <span style="font-size:0.72rem;background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:20px;font-weight:600">UNLOCKED</span>
            </h5>
            <div class="contact-item">
                <i class="fas fa-phone" style="color:#10b981"></i>
                <span id="ownerPhone"><a href="tel:${phone}" style="color:#10b981;font-weight:600;text-decoration:none">${phone}</a></span>
            </div>
            <div class="contact-item">
                <i class="fas fa-map-marker-alt" style="color:#10b981"></i>
                <span>${item.location || 'Location shared on request'}</span>
            </div>
            <button onclick="openMessageOwner()" style="
                margin-top:1rem;width:100%;padding:0.7rem;
                background:linear-gradient(135deg,#667eea,#764ba2);
                color:white;border:none;border-radius:10px;
                font-size:0.95rem;font-weight:600;cursor:pointer;
                display:flex;align-items:center;justify-content:center;gap:0.5rem;
                transition:opacity 0.2s;
            " onmouseover="this.style.opacity='0.88'" onmouseout="this.style.opacity='1'">
                <i class="fas fa-comment-dots"></i> Message Owner
            </button>
        `;
    } else {
        // Locked — direct user to Borrow Now button, no payment gate here
        contactInfo.innerHTML = `
            <h5><i class="fas fa-address-card"></i> Contact Details</h5>
            <div style="
                background:linear-gradient(135deg,#f0f4ff,#faf5ff);
                border:2px dashed #c4b5fd;border-radius:14px;
                padding:1.5rem;text-align:center;margin-top:0.5rem;
            ">
                <div style="font-size:2rem;margin-bottom:0.5rem">🔒</div>
                <div style="font-weight:700;color:#1f2937;font-size:1rem;margin-bottom:0.4rem">
                    Contact details are locked
                </div>
                <div style="color:#6b7280;font-size:0.82rem;line-height:1.5">
                    Click <strong>Borrow Now</strong> below to send a request<br>
                    or unlock instantly with a small fee.
                </div>
            </div>
            <div style="filter:blur(5px);pointer-events:none;margin-top:0.75rem;opacity:0.45">
                <div class="contact-item"><i class="fas fa-phone"></i><span>+91 98765 XXXXX</span></div>
                <div class="contact-item"><i class="fas fa-map-marker-alt"></i><span>Location, Area</span></div>
            </div>
            <button onclick="openMessageOwner()" style="
                margin-top:1rem;width:100%;padding:0.7rem;
                background:white;color:#667eea;
                border:2px solid #667eea;border-radius:10px;
                font-size:0.9rem;font-weight:600;cursor:pointer;
                display:flex;align-items:center;justify-content:center;gap:0.5rem;
                transition:all 0.2s;
            " onmouseover="this.style.background='#667eea';this.style.color='white'"
               onmouseout="this.style.background='white';this.style.color='#667eea'">
                <i class="fas fa-comment-dots"></i> Message Owner
            </button>
        `;
    }
}

// ── Re-fetch item after payment so phone is returned by backend ───
async function refreshItemAfterPayment(itemId) {
    const token   = getToken();
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    const res     = await fetch(`${ITEMDETAILS_API_URL}/api/items/${itemId}`, { headers });
    const data    = await res.json();
    if (data.success && (data.item?.unlocked)) {
        currentItem = data.item;
        renderContactSection(currentItem, true, false);
    }
}

// ── Simulate payment (demo / no Razorpay key) ─────────────────────
// ── Record borrow/lent transaction in localStorage after payment ──
function recordBorrowTransaction(item, paymentId) {
    if (!item) return;
    const borrowerUsername = localStorage.getItem('username');
    const ownerUsername    = item.owner || '';
    const now              = new Date().toISOString().split('T')[0];
    const rentalDays       = 7;
    const borrowTo         = new Date(Date.now() + rentalDays * 86400000).toISOString().split('T')[0];
    const itemId           = item.id || item._id || '';
    const paidAmount       = item.securityDeposit || item.pricePerDay || 0;
    const itemImage        = (item.images && item.images[0]) || item.image || '';

    if (borrowerUsername) {
        const borrowedKey  = `borrowed_${borrowerUsername}`;
        const borrowedList = JSON.parse(localStorage.getItem(borrowedKey) || '[]');
        const alreadyExists = borrowedList.some(b => b.id === itemId && b.paymentId === paymentId);
        if (!alreadyExists) {
            borrowedList.push({
                id:              itemId,
                itemName:        item.name,
                itemImage:       itemImage,
                owner:           ownerUsername,
                status:          'active',
                borrowFrom:      now,
                borrowTo:        borrowTo,
                totalPaid:       `₹${paidAmount}`,
                securityDeposit: item.securityDeposit || 0,
                paymentId:       paymentId,
                rentalDays
            });
            localStorage.setItem(borrowedKey, JSON.stringify(borrowedList));
        }
    }

    if (ownerUsername && ownerUsername !== borrowerUsername) {
        const lentKey  = `lent_${ownerUsername}`;
        const lentList = JSON.parse(localStorage.getItem(lentKey) || '[]');
        const alreadyExists = lentList.some(l => l.id === itemId && l.paymentId === paymentId);
        if (!alreadyExists) {
            lentList.push({
                id:          itemId,
                itemName:    item.name,
                itemImage:   itemImage,
                borrower:    borrowerUsername,
                status:      'active',
                borrowFrom:  now,
                borrowTo:    borrowTo,
                totalEarned: `₹${paidAmount}`,
                paymentId:   paymentId,
                rentalDays
            });
            localStorage.setItem(lentKey, JSON.stringify(lentList));
        }
    }
}

function showUnlockSuccess() {
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:#10b981;color:white;padding:0.9rem 1.75rem;border-radius:14px;font-weight:700;font-size:1rem;box-shadow:0 8px 30px rgba(16,185,129,0.4);z-index:99999;display:flex;align-items:center;gap:0.6rem';
    toast.innerHTML = '<i class="fas fa-unlock"></i> Contact details unlocked! 🎉';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

// ── Message owner ─────────────────────────────────────────────────
function openMessageOwner() {
    if (!currentItem) return;
    const itemId   = currentItem.id || currentItem._id;
    const unlocked = !!currentItem.unlocked;
    if (!unlocked) {
        alert('Please unlock contact details first to message the owner.');
        return;
    }
    const owner    = currentItem.owner || '';
    const itemName = encodeURIComponent(currentItem.name || '');
    window.location.href = `chat.html?owner=${encodeURIComponent(owner)}&itemId=${encodeURIComponent(itemId)}&itemName=${itemName}`;
}

// ── Borrow button ─────────────────────────────────────────────────
function renderBorrowButton(item, isOwner) {
    const borrowBtn = document.getElementById('borrowBtn');
    if (!borrowBtn) return;

    if (isOwner) {
        borrowBtn.textContent      = '🏷️ This is your item';
        borrowBtn.disabled         = true;
        borrowBtn.style.background = '#ccc';
        borrowBtn.style.cursor     = 'not-allowed';
        borrowBtn.style.opacity    = '0.7';
    } else {
        borrowBtn.onclick = () => {
            localStorage.setItem('currentItem', JSON.stringify(item));
            window.location.href = `borrow-request.html?itemId=${item.id}`;
        };
    }
}

// ── Leaflet Map ───────────────────────────────────────────────────
function initMap(item) {
    const lat        = parseFloat(item.locationLat);
    const lng        = parseFloat(item.locationLng);
    const mapSection = document.getElementById('mapSection');
    const mapDiv     = document.getElementById('itemMap');

    if (!mapSection || !mapDiv) return;
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) { mapSection.style.display = 'none'; return; }

    mapSection.style.display = 'block';
    if (leafletMap) { leafletMap.remove(); leafletMap = null; }

    const offsetLat = lat + (Math.random() - 0.5) * 0.009;
    const offsetLng = lng + (Math.random() - 0.5) * 0.009;

    leafletMap = L.map(mapDiv, { zoomControl: true, scrollWheelZoom: false }).setView([offsetLat, offsetLng], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(leafletMap);

    L.circle([offsetLat, offsetLng], {
        color: '#007bff', fillColor: '#007bff', fillOpacity: 0.15, radius: 600, weight: 2
    }).addTo(leafletMap);

    const icon = L.divIcon({
        className: '',
        html: `<div style="background:#007bff;color:white;border-radius:50% 50% 50% 0;width:32px;height:32px;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center">
                 <span style="transform:rotate(45deg);font-size:14px">📍</span>
               </div>`,
        iconSize: [32, 32], iconAnchor: [16, 32]
    });

    L.marker([offsetLat, offsetLng], { icon })
     .addTo(leafletMap)
     .bindPopup(`<b>${item.locationPrimary || extractGeneralLocation(item.location) || 'Area'}</b><br><small>Approximate area — exact address after borrowing</small>`)
     .openPopup();
}

// ── Stars ─────────────────────────────────────────────────────────
function displayStars(elementId, rating) {
    const container = document.getElementById(elementId);
    if (!container) return;
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5;
    let html = '';
    for (let i = 0; i < full; i++) html += '<i class="fas fa-star"></i>';
    if (half) html += '<i class="fas fa-star-half-alt"></i>';
    const empty = 5 - full - (half ? 1 : 0);
    for (let i = 0; i < empty; i++) html += '<i class="far fa-star"></i>';
    container.innerHTML = html;
}

function setupEventListeners() {
    setupStarRating();
    const reviewForm = document.getElementById('reviewForm');
    if (reviewForm) reviewForm.addEventListener('submit', submitReview);
}

function setupStarRating() {
    const stars = document.querySelectorAll('#starRating i');
    if (!stars.length) return;
    stars.forEach(star => star.replaceWith(star.cloneNode(true)));
    const fresh = document.querySelectorAll('#starRating i');
    fresh.forEach(star => {
        star.addEventListener('click', function () {
            currentRating = parseInt(this.getAttribute('data-rating'));
            updateStarRating(currentRating);
            document.getElementById('ratingInput').value = currentRating;
        });
        star.addEventListener('mouseover', function () { updateStarRating(parseInt(this.getAttribute('data-rating'))); });
    });
    const container = document.getElementById('starRating');
    if (container) container.addEventListener('mouseleave', () => updateStarRating(currentRating));
}

function updateStarRating(rating) {
    document.querySelectorAll('#starRating i').forEach((star, i) => {
        if (i < rating) { star.classList.remove('far'); star.classList.add('fas', 'active'); }
        else { star.classList.remove('fas', 'active'); star.classList.add('far'); }
    });
}

// ── Availability Status ───────────────────────────────────────────
function renderAvailabilityStatus(item) {
    const itemId   = item.id || item._id;
    const owner    = item.owner || '';

    // Check all borrowed_ keys to see if this item is currently borrowed
    let activeBorrow = null;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('borrowed_')) {
            try {
                const list = JSON.parse(localStorage.getItem(key) || '[]');
                const match = list.find(b =>
                    (b.id === itemId || b.itemId === itemId) &&
                    b.status === 'active'
                );
                if (match) { activeBorrow = match; break; }
            } catch(e) {}
        }
    }

    // Also check from backend item fields
    const isAvailable = item.available !== false && item.status !== 'unavailable' && !activeBorrow;
    const borrowTo    = activeBorrow?.borrowTo;

    // Find or create the status container
    let statusEl = document.getElementById('availabilityStatus');
    if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.id = 'availabilityStatus';
        // Insert after item title/price area
        const priceEl = document.getElementById('itemPrice') || document.querySelector('.item-price');
        if (priceEl) priceEl.parentNode.insertBefore(statusEl, priceEl.nextSibling);
        else {
            const details = document.querySelector('.item-details, .item-info, .product-info');
            if (details) details.prepend(statusEl);
        }
    }

    if (isAvailable) {
        statusEl.innerHTML = `
            <div style="
                display:inline-flex;align-items:center;gap:.5rem;
                background:#d1fae5;color:#065f46;
                padding:.45rem 1rem;border-radius:20px;
                font-size:.82rem;font-weight:700;margin:.75rem 0;
                border:1px solid #6ee7b7;
            ">
                <span style="width:8px;height:8px;background:#10b981;border-radius:50%;display:inline-block;
                             box-shadow:0 0 0 3px rgba(16,185,129,.3);animation:pulse 1.5s infinite"></span>
                Available to borrow
            </div>
            <style>@keyframes pulse{0%,100%{box-shadow:0 0 0 3px rgba(16,185,129,.3)}50%{box-shadow:0 0 0 6px rgba(16,185,129,.1)}}</style>
        `;
    } else {
        const untilText = borrowTo
            ? ` until ${new Date(borrowTo).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}`
            : '';
        statusEl.innerHTML = `
            <div style="
                display:inline-flex;align-items:center;gap:.5rem;
                background:#fee2e2;color:#991b1b;
                padding:.45rem 1rem;border-radius:20px;
                font-size:.82rem;font-weight:700;margin:.75rem 0;
                border:1px solid #fca5a5;
            ">
                <span style="width:8px;height:8px;background:#ef4444;border-radius:50%;display:inline-block"></span>
                Currently borrowed${untilText}
            </div>
        `;
    }
}

// ── Reviews with pagination ───────────────────────────────────────
let reviewsPage = 1;
const REVIEWS_PER_PAGE = 4;

function loadReviews(itemId) {
    const reviews = JSON.parse(localStorage.getItem(`reviews_${itemId}`)) || [];
    reviewsPage   = 1;
    displayReviews(reviews);
    updateRatingBars(reviews);
}

function displayReviews(reviews) {
    const list = document.getElementById('reviewsList');
    if (!list) return;

    const currentUser = localStorage.getItem('username');
    const avgRating   = reviews.length > 0 ? calculateAverageRating(reviews) : 0;

    document.getElementById('totalReviews').textContent = `${reviews.length} review${reviews.length !== 1 ? 's' : ''}`;
    document.getElementById('avgRating').textContent    = avgRating.toFixed(1);
    displayStars('avgStars', avgRating);

    if (reviews.length === 0) {
        list.innerHTML = `
            <div style="text-align:center;padding:3rem 2rem;color:#9ca3af">
                <i class="fas fa-star" style="font-size:3rem;opacity:.2;display:block;margin-bottom:1rem"></i>
                <p style="font-size:.9rem">No reviews yet. Be the first to review!</p>
            </div>`;
        return;
    }

    // Sort: own review first, then newest
    const sorted = [...reviews].sort((a, b) => {
        if (a.author === currentUser) return -1;
        if (b.author === currentUser) return 1;
        return 0;
    });

    const totalPages = Math.ceil(sorted.length / REVIEWS_PER_PAGE);
    const start      = (reviewsPage - 1) * REVIEWS_PER_PAGE;
    const page       = sorted.slice(start, start + REVIEWS_PER_PAGE);

    list.innerHTML = page.map((review, i) => {
        const globalIdx = reviews.findIndex(r => r.author === review.author && r.date === review.date);
        const isOwn     = review.author === currentUser;
        return `
        <div style="
            padding:1.25rem;border-radius:12px;margin-bottom:.875rem;
            background:${isOwn ? '#fafbff' : 'white'};
            border:1px solid ${isOwn ? '#c7d7fd' : '#e5e7eb'};
        ">
            <div style="display:flex;align-items:start;justify-content:space-between;margin-bottom:.6rem">
                <div style="display:flex;align-items:center;gap:.625rem">
                    <div style="
                        width:36px;height:36px;border-radius:50%;
                        background:linear-gradient(135deg,#667eea,#764ba2);
                        display:flex;align-items:center;justify-content:center;
                        color:white;font-weight:700;font-size:.875rem;flex-shrink:0
                    ">${(review.author||'?').charAt(0).toUpperCase()}</div>
                    <div>
                        <div style="font-weight:700;font-size:.875rem;color:#1f2937">
                            ${review.author}
                            ${isOwn ? '<span style="background:#eff6ff;color:#2563eb;font-size:.65rem;font-weight:700;padding:.1rem .4rem;border-radius:4px;margin-left:.3rem">You</span>' : ''}
                        </div>
                        <div style="font-size:.75rem;color:#9ca3af">${review.date || ''}</div>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:.5rem">
                    <div style="color:#f59e0b;font-size:.85rem">${getStarHTML(review.rating)}</div>
                    ${isOwn ? `
                    <button onclick="deleteReview(${globalIdx})" style="
                        background:none;border:none;color:#ef4444;cursor:pointer;
                        padding:.25rem;font-size:.9rem;opacity:.7;transition:opacity .15s
                    " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='.7'"
                       title="Delete review">
                        <i class="fas fa-trash-alt"></i>
                    </button>` : ''}
                </div>
            </div>
            ${review.title ? `<div style="font-weight:700;color:#1f2937;font-size:.875rem;margin-bottom:.3rem">${review.title}</div>` : ''}
            ${review.text  ? `<div style="color:#6b7280;font-size:.82rem;line-height:1.6">${review.text}</div>` : ''}
        </div>`;
    }).join('');

    // ── Pagination controls ───────────────────────────────────────
    if (totalPages > 1) {
        const pag = document.createElement('div');
        pag.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:.5rem;margin-top:1rem;padding-top:1rem;border-top:1px solid #e5e7eb';

        const mkBtn = (label, page, active = false, disabled = false) => {
            const btn = document.createElement('button');
            btn.innerHTML = label;
            btn.style.cssText = `
                padding:.4rem .75rem;border-radius:8px;font-size:.82rem;font-weight:600;cursor:pointer;
                border:1px solid ${active ? '#2563eb' : '#e5e7eb'};
                background:${active ? '#2563eb' : 'white'};
                color:${active ? 'white' : '#374151'};
                transition:all .15s;
                ${disabled ? 'opacity:.4;cursor:not-allowed' : ''}
            `;
            if (!disabled) btn.onclick = () => { reviewsPage = page; displayReviews(reviews); };
            pag.appendChild(btn);
        };

        mkBtn('<i class="fas fa-chevron-left"></i>', reviewsPage - 1, false, reviewsPage === 1);

        for (let p = 1; p <= totalPages; p++) {
            mkBtn(p, p, p === reviewsPage);
        }

        mkBtn('<i class="fas fa-chevron-right"></i>', reviewsPage + 1, false, reviewsPage === totalPages);

        list.appendChild(pag);
    }
}

function deleteReview(index) {
    if (!confirm('Delete this review?')) return;
    const itemId  = currentItem.id;
    const reviews = JSON.parse(localStorage.getItem(`reviews_${itemId}`)) || [];
    reviews.splice(index, 1);
    localStorage.setItem(`reviews_${itemId}`, JSON.stringify(reviews));
    loadReviews(itemId);
}

function updateRatingBars(reviews) {
    const total  = reviews.length;
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(r => { const n = Math.floor(r.rating); if (counts[n] !== undefined) counts[n]++; });
    for (let i = 1; i <= 5; i++) {
        const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
        const barEl = document.getElementById(`bar${i}`);
        const pctEl = document.getElementById(`percent${i}`);
        if (barEl) barEl.style.width     = `${pct}%`;
        if (pctEl) pctEl.textContent = `${pct}%`;
    }
}

function getStarHTML(rating) {
    let html = '';
    for (let i = 1; i <= 5; i++) html += i <= rating ? '<i class="fas fa-star"></i>' : '<i class="far fa-star"></i>';
    return html;
}

function calculateAverageRating(reviews) {
    if (!reviews.length) return 0;
    return reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length;
}

function showReviewModal()  { document.getElementById('reviewModal').classList.remove('hidden'); currentRating = 0; updateStarRating(0); setupStarRating(); }
function hideReviewModal()  { document.getElementById('reviewModal').classList.add('hidden'); document.getElementById('reviewForm').reset(); currentRating = 0; }

function submitReview(e) {
    e.preventDefault();
    const rating = parseInt(document.getElementById('ratingInput').value);
    if (rating === 0) { alert('Please select a rating'); return; }

    const username = localStorage.getItem('username') || 'Anonymous';
    const itemId   = currentItem.id || currentItem._id;

    const review = {
        author: username,
        rating,
        title: document.getElementById('reviewTitle').value,
        text:  document.getElementById('reviewText').value,
        date:  new Date().toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
    };

    const reviews = JSON.parse(localStorage.getItem(`reviews_${itemId}`)) || [];

    // Prevent duplicate review from same user
    const existingIdx = reviews.findIndex(r => r.author === username);
    if (existingIdx !== -1) reviews.splice(existingIdx, 1);

    reviews.unshift(review);
    localStorage.setItem(`reviews_${itemId}`, JSON.stringify(reviews));

    // ── Calculate new average rating ─────────────────────────────
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    // ── Push rating update to backend (best effort) ───────────────
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    fetch(`${self.BORROWBUDDY_CONFIG.API_BASE_URL}/api/items/${itemId}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body:    JSON.stringify({
            rating:       parseFloat(avgRating.toFixed(1)),
            reviewCount:  reviews.length,
            borrowCount:  currentItem.borrowCount || 0,
            username:     localStorage.getItem('username')
        })
    }).catch(e => console.warn('Rating sync failed:', e.message));

    // ── Update items_ in localStorage so dashboard chart stays fresh ─
    const ownerKey  = `items_${currentItem.owner}`;
    const ownerItems = JSON.parse(localStorage.getItem(ownerKey) || '[]');
    const oi = ownerItems.findIndex(i => (i.id || i._id) === itemId);
    if (oi !== -1) {
        ownerItems[oi].rating      = parseFloat(avgRating.toFixed(1));
        ownerItems[oi].reviewCount = reviews.length;
        localStorage.setItem(ownerKey, JSON.stringify(ownerItems));
    }

    // ── Update currentItem so profile rating re-renders correctly ─
    if (currentItem) {
        currentItem.rating      = parseFloat(avgRating.toFixed(1));
        currentItem.reviewCount = reviews.length;
    }

    loadReviews(itemId);
    hideReviewModal();

    // Toast instead of alert
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);background:#10b981;color:white;padding:.875rem 1.5rem;border-radius:12px;font-weight:700;font-size:.875rem;z-index:99999;box-shadow:0 8px 30px rgba(0,0,0,.2);white-space:nowrap';
    toast.innerHTML = '<i class="fas fa-star"></i> Review submitted! Thank you.';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function extractGeneralLocation(fullLocation) {
    if (!fullLocation) return 'Location unavailable';
    const parts = fullLocation.split(',').map(p => p.trim());
    return parts.length >= 2 ? parts.slice(-2).join(', ') : parts[0];
}

// ── Add CSS animations ────────────────────────────────────────────
const animStyle = document.createElement('style');
animStyle.textContent = `
    @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
    @keyframes slideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
`;
document.head.appendChild(animStyle);

// ── Globals ───────────────────────────────────────────────────────
window.showReviewModal  = showReviewModal;
window.hideReviewModal  = hideReviewModal;
window.deleteReview     = deleteReview;
window.openMessageOwner = openMessageOwner;
window.processInstantPayment  = processInstantPayment;
