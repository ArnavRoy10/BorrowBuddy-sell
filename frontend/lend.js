// BorrowBuddy — Lend / List Item
const LEND_API_URL = self.BORROWBUDDY_CONFIG.API_BASE_URL;

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('lendForm');
    if (!form) return;

    // ── Free checkbox ──────────────────────────────────────────
    const isFreeCheckbox   = document.getElementById('isFree');
    const pricePerDayInput = document.getElementById('pricePerDay');
    if (isFreeCheckbox) {
        isFreeCheckbox.addEventListener('change', () => {
            pricePerDayInput.disabled = isFreeCheckbox.checked;
            if (isFreeCheckbox.checked) pricePerDayInput.value = '0';
        });
    }

    // ── Multi-image upload ─────────────────────────────────────
    const imageInput    = document.getElementById('itemImages');
    const previewGrid   = document.getElementById('imagesPreviewGrid');
    const imgCountText  = document.getElementById('imgCountText');
    const uploadArea    = document.getElementById('uploadArea');

    // selectedFiles holds the raw File objects to upload to Cloudinary on submit
    let selectedFiles   = []; // array of File | null
    let previewURLs     = []; // array of local blob preview URLs (for display only)

    function updateCountText() {
        const count = selectedFiles.filter(Boolean).length;
        imgCountText.textContent = count > 0 ? `${count} / 5 image${count > 1 ? 's' : ''} selected` : '';
        if (uploadArea) {
            uploadArea.style.opacity = count >= 5 ? '0.5' : '1';
            uploadArea.style.pointerEvents = count >= 5 ? 'none' : 'auto';
        }
    }

    function addImageToGrid(previewSrc, index) {
        const div = document.createElement('div');
        div.className = 'preview-thumb';
        div.dataset.index = index;
        div.innerHTML = `
            <img src="${previewSrc}" alt="Image ${index + 1}">
            ${index === 0 ? '<span class="thumb-badge">Cover</span>' : ''}
            <button type="button" class="remove-thumb" title="Remove">✕</button>
        `;
        div.querySelector('.remove-thumb').addEventListener('click', () => {
            if (previewURLs[index]) URL.revokeObjectURL(previewURLs[index]);
            selectedFiles[index] = null;
            previewURLs[index]   = null;
            div.remove();
            // Re-badge first remaining as Cover
            const thumbs = previewGrid.querySelectorAll('.preview-thumb');
            thumbs.forEach(t => t.querySelector('.thumb-badge')?.remove());
            if (thumbs[0]) {
                const badge = document.createElement('span');
                badge.className = 'thumb-badge';
                badge.textContent = 'Cover';
                thumbs[0].appendChild(badge);
            }
            if (selectedFiles.filter(Boolean).length === 0) previewGrid.style.display = 'none';
            updateCountText();
        });
        previewGrid.appendChild(div);
        previewGrid.style.display = 'grid';
    }

    // Compress image client-side BEFORE upload (smaller, faster Cloudinary upload)
    function compressImage(file, maxW = 1200, quality = 0.82) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas  = document.createElement('canvas');
                    canvas.width  = Math.min(img.width, maxW);
                    canvas.height = (canvas.width / img.width) * img.height;
                    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                    canvas.toBlob(
                        (blob) => resolve(new File([blob], file.name, { type: 'image/jpeg' })),
                        'image/jpeg',
                        quality
                    );
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    async function addFile(file, index) {
        const compressedFile = await compressImage(file);
        selectedFiles[index] = compressedFile;

        const previewUrl = URL.createObjectURL(compressedFile);
        previewURLs[index] = previewUrl;
        addImageToGrid(previewUrl, index);
        updateCountText();
    }

    if (imageInput) {
        imageInput.addEventListener('change', function () {
            const existing = selectedFiles.filter(Boolean).length;
            const slots    = 5 - existing;
            if (slots <= 0) { alert('Maximum 5 images already selected.'); this.value = ''; return; }

            const files = Array.from(this.files).slice(0, slots);
            if (this.files.length > slots) alert(`Only ${slots} more image${slots > 1 ? 's' : ''} can be added (max 5 total).`);

            files.forEach(file => {
                const index = selectedFiles.length;
                selectedFiles.push(null);
                previewURLs.push(null);
                addFile(file, index);
            });
            this.value = ''; // reset so same file can be re-added
        });
    }

    // ── Upload images to Cloudinary via backend ──────────────────
    async function uploadImagesToCloudinary(files) {
        if (!files.length) return [];

        const formData = new FormData();
        files.forEach(f => formData.append('images', f));

        const res  = await fetch(`${LEND_API_URL}/api/upload/images`, {
            method: 'POST',
            body:   formData  // no Content-Type header — browser sets multipart boundary
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
            throw new Error(data.message || 'Image upload failed');
        }
        return data.images; // array of Cloudinary secure_urls
    }

    // ── Form Submit ────────────────────────────────────────────
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = localStorage.getItem('username');
        if (!username) { alert('Please login first'); window.location.href = 'login.html'; return; }

        const itemName           = document.getElementById('itemName')?.value.trim();
        const category           = document.getElementById('category')?.value;
        const description        = document.getElementById('description')?.value.trim();
        const condition          = document.querySelector('input[name="condition"]:checked')?.value || 'good';
        const isFree             = document.getElementById('isFree')?.checked || false;
        const pricePerDay        = isFree ? 0 : parseFloat(document.getElementById('pricePerDay')?.value || 0);
        const securityDeposit    = parseFloat(document.getElementById('securityDeposit')?.value || 0);
        const phoneNumber        = document.getElementById('phoneNumber')?.value.trim();
        const pickupInstructions = document.getElementById('pickupInstructions')?.value.trim();

        // ── Location from location-search.js ──────────────────
        const location        = document.getElementById('location')?.value.trim();
        const locationPrimary = document.getElementById('locationPrimary')?.value.trim() || location;
        const locationLat     = parseFloat(document.getElementById('locationLat')?.value) || null;
        const locationLng     = parseFloat(document.getElementById('locationLng')?.value) || null;

        if (!itemName || !category || !description) {
            alert('Please fill in: Item Name, Category, and Description'); return;
        }
        if (!phoneNumber) { alert('Please provide a phone number'); return; }
        if (!location)    { alert('Please search and select a pickup location'); return; }

        const submitBtn = form.querySelector('button[type="submit"]');
        const setBtnState = (text) => { if (submitBtn) submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${text}`; };
        if (submitBtn) submitBtn.disabled = true;

        try {
            // ── Step 1: Upload images to Cloudinary ──────────────
            const filesToUpload = selectedFiles.filter(Boolean);
            let imageUrls = [];

            if (filesToUpload.length > 0) {
                setBtnState(`Uploading ${filesToUpload.length} image${filesToUpload.length > 1 ? 's' : ''}...`);
                imageUrls = await uploadImagesToCloudinary(filesToUpload);
            }

            // ── Step 2: Save item with Cloudinary URLs ───────────
            setBtnState('Saving item...');

            const item = {
                name:               itemName,
                category,
                description,
                condition,
                price:              isFree ? 'Free' : `₹${pricePerDay}/day`,
                pricePerDay,
                securityDeposit,
                image:              imageUrls[0] || 'https://images.unsplash.com/photo-1572365992253-3cb3e56dd362?w=400',
                images:             imageUrls,
                phoneNumber,
                location,
                locationPrimary,
                locationLat,
                locationLng,
                pickupInstructions,
                owner:              username,
                status: 'active', active: true, available: true,
                borrowed: false, borrowedBy: null,
                rating: 0, borrowCount: 0, reviewCount: 0
            };

            const response = await fetch(`${LEND_API_URL}/api/items`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(item)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to save item');

            // Save to localStorage so dashboard chart and stats work offline
            const savedItem = data.item || { ...item, id: Date.now().toString() };
            const itemsKey  = `items_${username}`;
            const itemsList = JSON.parse(localStorage.getItem(itemsKey) || '[]');
            itemsList.push(savedItem);
            localStorage.setItem(itemsKey, JSON.stringify(itemsList));

            // Clean up preview blob URLs
            previewURLs.forEach(url => { if (url) URL.revokeObjectURL(url); });

            const banner = document.getElementById('successBanner');
            if (banner) banner.style.display = 'flex';
            form.reset();
            selectedFiles = [];
            previewURLs   = [];
            previewGrid.innerHTML = '';
            previewGrid.style.display = 'none';
            updateCountText();

            const locSelected = document.getElementById('locSelected');
            if (locSelected) locSelected.style.display = 'none';
            const locInput = document.getElementById('locationInput');
            if (locInput) locInput.value = '';

            setTimeout(() => { window.location.href = 'my-items.html'; }, 1500);

        } catch (err) {
            alert('Error: ' + err.message);
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-check"></i> List Item'; }
        }
    });
});