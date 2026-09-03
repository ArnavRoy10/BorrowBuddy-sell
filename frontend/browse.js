function createSlideshow(images, altText) {
  const defaultImg = 'https://images.unsplash.com/photo-1572365992253-3cb3e56dd362?w=400';
  const imgs = (images && images.filter(Boolean).length > 0) ? images.filter(Boolean) : [defaultImg];
  let current = 0;

  const wrapper = document.createElement('div');
  wrapper.className = 'item-slideshow';
  wrapper.style.cssText = 'position:relative;overflow:hidden;background:linear-gradient(135deg,#667eea,#764ba2)';

  const img = document.createElement('img');
  img.src = imgs[0];
  img.alt = altText || '';
  img.style.cssText = 'width:100%;height:100%;object-fit:contain;background:rgba(255,255,255,0.06);transition:opacity 0.3s';
  img.onerror = () => { img.src = defaultImg; };
  wrapper.appendChild(img);

  if (imgs.length > 1) {
    const counter = document.createElement('div');
    counter.style.cssText = 'position:absolute;bottom:8px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.5);color:white;padding:2px 10px;border-radius:10px;font-size:0.75rem;z-index:5';
    counter.textContent = '1 / ' + imgs.length;
    wrapper.appendChild(counter);

    const btnStyle = 'position:absolute;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.5);color:white;border:none;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;z-index:5;line-height:1';
    const prev = document.createElement('button');
    prev.innerHTML = '&#8249;';
    prev.setAttribute('style', btnStyle + ';left:8px');
    const next = document.createElement('button');
    next.innerHTML = '&#8250;';
    next.setAttribute('style', btnStyle + ';right:8px');

    const goTo = (index) => {
      current = (index + imgs.length) % imgs.length;
      img.style.opacity = '0';
      setTimeout(() => { img.src = imgs[current]; img.style.opacity = '1'; counter.textContent = (current + 1) + ' / ' + imgs.length; }, 150);
    };

    prev.addEventListener('click', (e) => { e.stopPropagation(); goTo(current - 1); });
    next.addEventListener('click', (e) => { e.stopPropagation(); goTo(current + 1); });
    wrapper.appendChild(prev);
    wrapper.appendChild(next);
  }

  return wrapper;
}

const API_BASE = self.BORROWBUDDY_CONFIG.API_BASE_URL + '/api';

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('itemsGrid');
    if (!container) return;

    const currentUsername = localStorage.getItem('username');

    let allItemsData      = [];
    let currentFilter     = 'all';
    let currentPrice      = 'all';
    let currentSort       = 'newest';
    let currentConditions = [];
    let currentSearch     = '';
    let currentLocation   = '';
    let userLocation      = null; // { lat, lon } set by geolocation

    // ── Get user's location for distance calculation ──────────────
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            pos => {
                userLocation = { lat: pos.coords.latitude, lon: pos.coords.longitude };
                // Re-render with distances now available
                if (allItemsData.length) filterAndDisplay();
            },
            err => console.warn('Geolocation denied or unavailable:', err.message),
            { timeout: 8000, maximumAge: 300000 }
        );
    }

    // ── Search input (real-time, updates as you type) ─────────────
    const searchInput = document.getElementById('searchInput');
    const suggestionsBox = document.getElementById('searchSuggestions');
    let searchDebounceTimer = null;
    let recentSearches = JSON.parse(localStorage.getItem('recentItemSearches') || '[]');

    function triggerSearch() {
        currentSearch = (searchInput?.value || '').trim().toLowerCase();
        if (searchInput) searchInput.style.borderColor = '';
        if (currentSearch) saveRecentSearch(currentSearch);
        hideSuggestions();
        filterAndDisplay();
    }

    function saveRecentSearch(term) {
        recentSearches = recentSearches.filter(t => t !== term);
        recentSearches.unshift(term);
        recentSearches = recentSearches.slice(0, 5);
        localStorage.setItem('recentItemSearches', JSON.stringify(recentSearches));
    }

    function hideSuggestions() {
        if (suggestionsBox) suggestionsBox.style.display = 'none';
    }

    function showSuggestions(query) {
        if (!suggestionsBox) return;

        let matches = [];

        if (!query) {
            // No query yet — show recent searches
            if (recentSearches.length) {
                matches = recentSearches.map(term => ({ type: 'recent', label: term }));
            }
        } else {
            // Match against item names, categories, owners
            const seen = new Set();
            allItemsData.forEach(item => {
                const name = item.name || '';
                if (name.toLowerCase().includes(query) && !seen.has(name.toLowerCase())) {
                    seen.add(name.toLowerCase());
                    matches.push({ type: 'item', label: name, item });
                }
            });
            // Category matches
            const categorySet = new Set(allItemsData.map(i => i.category).filter(Boolean));
            categorySet.forEach(cat => {
                if (cat.toLowerCase().includes(query)) {
                    matches.push({ type: 'category', label: cat });
                }
            });
            matches = matches.slice(0, 8);
        }

        if (!matches.length) { hideSuggestions(); return; }

        suggestionsBox.innerHTML = (query ? '' : `
            <div style="padding:.6rem 1rem;font-size:.72rem;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #f3f4f6">
                Recent Searches
            </div>
        `) + matches.map((m, i) => {
            if (m.type === 'item') {
                const img = (m.item.images && m.item.images[0]) || m.item.image || 'https://via.placeholder.com/32';
                return `
                <div class="suggestion-row" data-idx="${i}" data-type="item" data-value="${esc(m.label)}" style="
                    display:flex;align-items:center;gap:.7rem;padding:.6rem 1rem;cursor:pointer;transition:background .1s;
                " onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='white'">
                    <img src="${img}" style="width:28px;height:28px;border-radius:6px;object-fit:cover;flex-shrink:0" onerror="this.src='https://via.placeholder.com/28'">
                    <span style="font-size:.85rem;color:#1f2937">${highlightMatch(m.label, query)}</span>
                </div>`;
            }
            if (m.type === 'category') {
                return `
                <div class="suggestion-row" data-idx="${i}" data-type="category" data-value="${esc(m.label)}" style="
                    display:flex;align-items:center;gap:.7rem;padding:.6rem 1rem;cursor:pointer;transition:background .1s;
                " onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='white'">
                    <div style="width:28px;height:28px;border-radius:6px;background:#eff6ff;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                        <i class="fas fa-tag" style="font-size:.7rem;color:#2563eb"></i>
                    </div>
                    <span style="font-size:.85rem;color:#1f2937">${highlightMatch(m.label, query)}</span>
                    <span style="font-size:.7rem;color:#9ca3af;margin-left:auto">Category</span>
                </div>`;
            }
            // recent
            return `
            <div class="suggestion-row" data-idx="${i}" data-type="recent" data-value="${esc(m.label)}" style="
                display:flex;align-items:center;gap:.7rem;padding:.6rem 1rem;cursor:pointer;transition:background .1s;
            " onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='white'">
                <div style="width:28px;height:28px;border-radius:6px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                    <i class="fas fa-history" style="font-size:.7rem;color:#9ca3af"></i>
                </div>
                <span style="font-size:.85rem;color:#374151">${esc(m.label)}</span>
            </div>`;
        }).join('');

        suggestionsBox.style.display = 'block';

        suggestionsBox.querySelectorAll('.suggestion-row').forEach(row => {
            row.addEventListener('click', () => {
                searchInput.value = row.dataset.value;
                currentSearch = row.dataset.value.toLowerCase();
                saveRecentSearch(currentSearch);
                hideSuggestions();
                filterAndDisplay();
            });
        });
    }

    function highlightMatch(text, query) {
        if (!query) return esc(text);
        const idx = text.toLowerCase().indexOf(query);
        if (idx === -1) return esc(text);
        return esc(text.slice(0, idx)) + '<strong style="color:#2563eb">' + esc(text.slice(idx, idx + query.length)) + '</strong>' + esc(text.slice(idx + query.length));
    }

    function esc(str) {
        return String(str||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }

    if (searchInput) {
        // Real-time search: fires on every keystroke with a short debounce (~300ms)
        searchInput.addEventListener('input', () => {
            clearTimeout(searchDebounceTimer);
            searchInput.style.borderColor = '#007bff';
            const query = searchInput.value.trim().toLowerCase();
            showSuggestions(query);
            searchDebounceTimer = setTimeout(triggerSearch, 300);
        });

        searchInput.addEventListener('focus', () => {
            showSuggestions(searchInput.value.trim().toLowerCase());
        });

        // Immediate search on Enter key
        searchInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                clearTimeout(searchDebounceTimer);
                triggerSearch();
            }
            // Clear search on Escape
            if (e.key === 'Escape') {
                searchInput.value = '';
                clearTimeout(searchDebounceTimer);
                hideSuggestions();
                triggerSearch();
            }
        });

        // Hide suggestions when clicking outside
        document.addEventListener('click', e => {
            if (!e.target.closest('.search-box')) hideSuggestions();
        });
    }

    // Search button (if present in HTML)
    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            clearTimeout(searchDebounceTimer);
            triggerSearch();
        });
    }

    // ── Category filter buttons ───────────────────────────────────
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.category;
            filterAndDisplay();
        });
    });

    // ── Price / Sort dropdowns ────────────────────────────────────
    document.getElementById('priceFilter')?.addEventListener('change', e => { currentPrice = e.target.value; filterAndDisplay(); });
    document.getElementById('sortFilter')?.addEventListener('change',  e => { currentSort  = e.target.value; filterAndDisplay(); });
    document.getElementById('locationFilter')?.addEventListener('change', e => { currentLocation = e.target.value.trim().toLowerCase(); filterAndDisplay(); });

    // ── Condition checkboxes ──────────────────────────────────────
    document.querySelectorAll('input[name="condition"]').forEach(cb => {
        cb.addEventListener('change', () => {
            currentConditions = Array.from(document.querySelectorAll('input[name="condition"]:checked')).map(c => c.value);
            filterAndDisplay();
        });
    });

    // ── Initial load ──────────────────────────────────────────────
    loadAllItems();

    // Always refresh when the tab becomes visible again (e.g. after listing
    // an item on another tab, or navigating back via browser history) —
    // prevents showing stale cached data.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            loadAllItems();
        }
    });

    // Also refresh on browser back/forward navigation (bfcache restores)
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            loadAllItems();
        }
    });

    // Expose globally so browse.html inline scripts (clearAllFilters / storage-sync) can call them
    window.applyFilters  = filterAndDisplay;
    window.loadAllItems  = loadAllItems;
    window.resetSearch   = () => {
        clearTimeout(searchDebounceTimer);
        currentSearch = '';
        if (searchInput) searchInput.value = '';
        filterAndDisplay();
    };

    // ─────────────────────────────────────────────────────────────
    // LOAD ITEMS FROM MONGODB
    // ─────────────────────────────────────────────────────────────
    async function loadAllItems() {
        showLoading();
        try {
            const token = localStorage.getItem('authToken') || localStorage.getItem('token');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            const response = await fetch(`${API_BASE}/items`, { headers });
            if (!response.ok) throw new Error('Failed to load items');
            const data = await response.json();
            const items = Array.isArray(data) ? data : (data.items || data.data || []);
            // Backend already filters out unavailable/borrowed items —
            // no need to re-filter here (avoids accidentally hiding new
            // items due to unexpected status field values).
            allItemsData = items;
            filterAndDisplay();
        } catch (error) {
            console.error('Error loading items:', error);
            showError(error.message);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // FILTER + SORT  (now includes search)
    // ─────────────────────────────────────────────────────────────
    function filterAndDisplay() {
        let items = [...allItemsData];

        // ── Pull live ratings from localStorage reviews ────────────
        items = items.map(item => {
            const id      = item.id || item._id;
            const reviews = JSON.parse(localStorage.getItem(`reviews_${id}`) || '[]');
            if (reviews.length > 0) {
                const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
                return { ...item, rating: parseFloat(avg.toFixed(1)), reviewCount: reviews.length };
            }
            return item;
        });

        // Search filter — name, description, category, owner, location
        if (currentSearch) {
            items = items.filter(i => {
                const haystack = [i.name, i.description, i.category, i.owner, i.locationPrimary, i.location]
                    .filter(Boolean).join(' ').toLowerCase();
                return haystack.includes(currentSearch);
            });
        }

        // Location filter
        if (currentLocation) {
            items = items.filter(i => {
                const loc = [i.locationPrimary, i.location, i.locationArea].filter(Boolean).join(' ').toLowerCase();
                return loc.includes(currentLocation);
            });
        }

        if (currentFilter !== 'all')
            items = items.filter(i => i.category === currentFilter);

        if (currentPrice === 'free')
            items = items.filter(i => !i.price || i.price === 'Free' || parseFloat(i.price) === 0);
        else if (currentPrice === 'paid')
            items = items.filter(i => i.price && i.price !== 'Free' && parseFloat(i.price) > 0);
        else if (currentPrice === 'under100')
            items = items.filter(i => parseFloat(i.price) > 0 && parseFloat(i.price) < 100);
        else if (currentPrice === 'under500')
            items = items.filter(i => parseFloat(i.price) >= 100 && parseFloat(i.price) < 500);

        if (currentConditions.length > 0)
            items = items.filter(i => currentConditions.includes((i.condition || '').toLowerCase()));

        if (currentSort === 'newest')
            items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        else if (currentSort === 'oldest')
            items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        else if (currentSort === 'price-low')
            items.sort((a, b) => (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0));
        else if (currentSort === 'price-high')
            items.sort((a, b) => (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0));
        else if (currentSort === 'rating')
            items.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        else if (currentSort === 'popular')
            items.sort((a, b) => (b.borrowCount || 0) - (a.borrowCount || 0));

        renderItems(items);
    }

    // ─────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────
    function renderItems(items) {
        container.innerHTML = '';

        if (items.length === 0) {
            container.style.display = 'block';
            container.innerHTML = EmptyState.markup('noResults', {
                title: currentSearch ? 'No matches for that search' : 'Nothing matches these filters',
                text: currentSearch
                    ? `We couldn't find anything for "${currentSearch}". Try a shorter keyword or a different category.`
                    : 'Try widening your distance or clearing a filter to see everything available nearby.',
                action: currentSearch
                    ? { label: 'Clear search', onclick: 'window.resetSearch()', icon: 'fa-rotate-left' }
                    : { label: 'List an item instead', href: 'lend.html', icon: 'fa-plus' }
            });
            return;
        }

        container.style.display = 'grid';
        container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
        container.style.gap = '1.5rem';

        items.forEach(item => {
            const card = createItemCard(item);
            if (card) container.appendChild(card);
        });
    }

    function createItemCard(item) {
        if (!item || (!item.id && !item._id) || !item.name) return null;

        const itemId  = item.id || item._id;
        const isOwner = item.owner === currentUsername || item.ownerId === localStorage.getItem('userId');

        const safe = s => {
            const d = document.createElement('div');
            d.textContent = s || '';
            return d.innerHTML;
        };

        const name     = safe(item.name);
        const category = safe(item.category || 'Others');
        const owner    = safe(item.owner || 'Unknown');
        const desc     = safe(item.description || 'No description');
        const price    = safe(item.price || 'Free');
        const deposit  = parseFloat(item.securityDeposit || 0).toFixed(0);
        const rating   = parseFloat(item.rating || 0);
        const borrows  = item.borrowCount || 0;
        const img      = item.image || 'https://images.unsplash.com/photo-1572365992253-3cb3e56dd362?w=400';

        // ── Owner rating from localStorage reviews ────────────────
        const ownerRating = getOwnerRating(item.owner);

        // ── Distance calculation ──────────────────────────────────
        const distanceStr = getItemDistance(item);

        // ── Star rendering ────────────────────────────────────────
        const renderStars = (val) => {
            const full  = Math.floor(val);
            const half  = val - full >= 0.5;
            const empty = 5 - full - (half ? 1 : 0);
            return `${'<i class="fas fa-star" style="color:#f59e0b;font-size:.7rem"></i>'.repeat(full)}${half ? '<i class="fas fa-star-half-alt" style="color:#f59e0b;font-size:.7rem"></i>' : ''}${'<i class="far fa-star" style="color:#f59e0b;font-size:.7rem"></i>'.repeat(empty)}`;
        };

        const card = document.createElement('div');
        card.className = 'item-card';
        card.style.cssText = 'background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);transition:box-shadow .2s,transform .2s;border:1px solid #e5e7eb;display:flex;flex-direction:column;height:100%';

        const slideshow = createSlideshow(item.images && item.images.length > 0 ? item.images : [img], name);

        // Category badge
        const badge = document.createElement('div');
        badge.style.cssText = 'position:absolute;top:.75rem;right:.75rem;background:rgba(255,255,255,.95);padding:.25rem .65rem;border-radius:50px;font-size:.72rem;font-weight:700;color:#2563eb;backdrop-filter:blur(4px);box-shadow:0 2px 8px rgba(0,0,0,.1)';
        badge.textContent = category;
        slideshow.appendChild(badge);

        // Distance badge (only if available)
        if (distanceStr) {
            const distBadge = document.createElement('div');
            distBadge.style.cssText = 'position:absolute;top:.75rem;left:.75rem;background:rgba(16,185,129,.9);color:white;padding:.25rem .65rem;border-radius:50px;font-size:.72rem;font-weight:700;backdrop-filter:blur(4px)';
            distBadge.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${distanceStr}`;
            slideshow.appendChild(distBadge);
        }

        card.appendChild(slideshow);

        const msgBtn = !isOwner ? `
            <button class="msg-seller-btn"
                style="width:100%;margin-top:.5rem;padding:.55rem;background:#f0f7ff;color:#2563eb;border:1px solid #bfdbfe;border-radius:8px;font-weight:600;cursor:pointer;font-size:.82rem;transition:all .15s">
                <i class="fas fa-comment-dots"></i> Message Owner
            </button>` : '';

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = `
            <div class="item-card-body" style="padding:.9rem 1rem 1rem;display:flex;flex-direction:column;flex:1 1 auto;min-width:0">

                <!-- Title: fixed 2-line height so every card's title block matches -->
                <h3 class="item-card-title" style="margin:0 0 .3rem;font-size:.95rem;font-weight:600;color:#1f2937;line-height:1.35;
                    display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.6em">
                    ${name}
                </h3>

                <!-- Rating row: directly under title, Amazon-style -->
                <div style="display:flex;align-items:center;gap:.35rem;margin-bottom:.4rem;min-height:1.1rem">
                    ${rating > 0 ? `
                    ${renderStars(rating)}
                    <span style="font-size:.78rem;color:#2563eb;font-weight:600">${rating.toFixed(1)}</span>
                    <span style="font-size:.75rem;color:#6b7280">(${borrows} borrow${borrows === 1 ? '' : 's'})</span>` : `
                    <span style="font-size:.78rem;color:#9ca3af">No reviews yet</span>`}
                </div>

                <!-- Price: large and prominent, Amazon-style -->
                <div style="display:flex;align-items:baseline;gap:.4rem;margin-bottom:.15rem">
                    <span class="item-card-price" style="color:#0f766e;font-weight:700;font-size:1.15rem">${price}</span>
                </div>
                <div style="display:flex;align-items:center;gap:.35rem;font-size:.75rem;color:#6b7280;margin-bottom:.55rem">
                    <i class="fas fa-shield-alt" style="color:#f59e0b"></i> ₹${deposit} refundable deposit
                </div>

                <!-- Owner row -->
                <div style="display:flex;align-items:center;justify-content:space-between;padding-top:.5rem;border-top:1px solid #f3f4f6;margin-bottom:.5rem;min-width:0">
                    <div style="display:flex;align-items:center;gap:.4rem;color:#6b7280;font-size:.78rem;min-width:0">
                        <div style="width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;color:white;font-size:.58rem;font-weight:700;flex-shrink:0">
                            ${(item.owner||'U')[0].toUpperCase()}
                        </div>
                        <span style="font-weight:600;color:#374151;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0">${owner}</span>
                    </div>
                    ${item.locationPrimary || item.location ? `
                    <span style="color:#6b7280;font-size:.72rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:90px;flex-shrink:0">
                        <i class="fas fa-map-marker-alt" style="color:#ef4444"></i>
                        ${safe((item.locationPrimary || item.location || '').split(',')[0])}
                    </span>` : ''}
                </div>

                <!-- Description: single line, consistent height -->
                <p style="color:#6b7280;font-size:.78rem;margin:0 0 .75rem;line-height:1.4;min-width:0;
                    overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                    ${desc}
                </p>

                <!-- Spacer pushes everything below to the bottom of the card -->
                <div style="flex:1 1 auto"></div>

                <!-- Action buttons: always aligned to the bottom edge of the card -->
                <div style="display:flex;gap:.5rem">
                    <button class="add-to-cart-btn"
                        style="flex:1;padding:.6rem;background:#FFD814;border:1px solid #FCD200;color:#111;border-radius:8px;font-weight:700;cursor:pointer;font-size:.8rem;transition:all .15s">
                        <i class="fas fa-shopping-cart"></i> Cart
                    </button>
                    <button class="view-details-btn"
                        style="flex:1;padding:.6rem;background:linear-gradient(135deg,#2563eb,#7c3aed);color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:.8rem;transition:all .15s">
                        <i class="fas fa-eye"></i> Details
                    </button>
                </div>
                ${msgBtn}
            </div>`;

        card.appendChild(tempDiv.firstElementChild);

        // Hover effect
        card.addEventListener('mouseenter', () => { card.style.transform = 'translateY(-4px)'; card.style.boxShadow = '0 8px 20px rgba(0,0,0,.12)'; });
        card.addEventListener('mouseleave', () => { card.style.transform = 'translateY(0)'; card.style.boxShadow = '0 1px 3px rgba(0,0,0,.08)'; });

        card.querySelector('.add-to-cart-btn').addEventListener('click', e => { e.stopPropagation(); addToCart(item); });
        card.querySelector('.view-details-btn').addEventListener('click', e => { e.stopPropagation(); viewDetails(item); });
        card.querySelector('.msg-seller-btn')?.addEventListener('click', e => { e.stopPropagation(); messageSeller(item); });

        return card;
    }

    // ── Owner rating: avg of all reviews on their items ───────────
    function getOwnerRating(ownerUsername) {
        if (!ownerUsername) return null;
        const ownerItems = JSON.parse(localStorage.getItem(`items_${ownerUsername}`) || '[]');
        let total = 0, count = 0;
        ownerItems.forEach(item => {
            const reviews = JSON.parse(localStorage.getItem(`reviews_${item.id || item._id}`) || '[]');
            reviews.forEach(r => { total += (r.rating || 0); count++; });
        });
        if (count === 0) return null;
        return { avg: total / count, count };
    }

    // ── Distance: haversine formula between user and item ─────────
    function getItemDistance(item) {
        if (!userLocation) return '';
        const lat2 = parseFloat(item.lat || item.latitude  || item.locationLat);
        const lon2 = parseFloat(item.lon || item.longitude || item.locationLng);
        if (isNaN(lat2) || isNaN(lon2)) return '';

        const R    = 6371; // km
        const dLat = (lat2 - userLocation.lat) * Math.PI / 180;
        const dLon = (lon2 - userLocation.lon) * Math.PI / 180;
        const a    = Math.sin(dLat/2) * Math.sin(dLat/2) +
                     Math.cos(userLocation.lat * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
                     Math.sin(dLon/2) * Math.sin(dLon/2);
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        if (dist < 1)   return `${Math.round(dist * 1000)}m away`;
        if (dist < 10)  return `${dist.toFixed(1)}km away`;
        return `${Math.round(dist)}km away`;
    }

    // ── Message Owner ─────────────────────────────────────────────
    function messageSeller(item) {
        const itemId   = item.id || item._id;
        const ownerId  = item.ownerId || item.owner;
        const itemName = encodeURIComponent(item.name || 'Item');
        const ownerEnc = encodeURIComponent(item.owner || '');
        window.location.href = `messages.html?userId=${ownerId}&username=${ownerEnc}&itemId=${itemId}&itemName=${itemName}`;
    }

    // ── Cart ──────────────────────────────────────────────────────
    function addToCart(item) {
        const username = localStorage.getItem('username');
        if (!username) { window.location.href = 'login.html'; return; }
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        const id   = item.id || item._id;
        if (cart.some(c => (c.id || c._id) === id)) {
            showBrowseToast('Already in cart!', '#f97316');
            return;
        }
        cart.push({ ...item, id, fromDate: '', toDate: '', rentalDays: 1 });
        localStorage.setItem('cart', JSON.stringify(cart));

        // Update badge
        const badge = document.getElementById('cartBadge');
        if (badge) { badge.textContent = cart.length; badge.style.display = 'inline-block'; }

        showBrowseToast(`✓ ${item.name} added to cart!`, '#10b981');
    }

    function showBrowseToast(msg, bg='#10b981') {
        const t = document.createElement('div');
        t.style.cssText = `position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);
            background:${bg};color:white;padding:.875rem 1.5rem;border-radius:12px;
            font-weight:700;font-size:.875rem;z-index:99999;
            box-shadow:0 8px 30px rgba(0,0,0,.2);white-space:nowrap;
            animation:slideUp .2s ease;`;
        t.innerHTML = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2500);
    }

    // ── Helpers ───────────────────────────────────────────────────
    function showLoading() {
        container.style.display = 'block';
        container.innerHTML = Skeleton.markup('cards', 8);
    }

    function showError(msg) {
        container.style.display = 'block';
        container.innerHTML = EmptyState.markup('error', {
            text: (msg.includes('fetch') || msg.includes('Failed'))
                ? 'We couldn’t reach the BorrowBuddy server. Make sure the backend is running, then try again.'
                : msg
        });
    }
});

function viewDetails(item) {
    sessionStorage.setItem('currentItem', JSON.stringify(item));
    const id = item.id || item._id;
    window.location.href = `item-details.html?id=${id}`;
}

window.viewItemDetails = viewDetails;
