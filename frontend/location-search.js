/* ═══════════════════════════════════════════════════
   BorrowBuddy — Location Search
   Uses OpenStreetMap Nominatim (FREE, no API key needed)
   + Leaflet map preview on item-details page
═══════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── State ──────────────────────────────────────
  let currentResults = [];
  let activeIndex    = -1;
  let debounceTimer  = null;

  // ── Elements ───────────────────────────────────
  const input          = document.getElementById('locationInput');
  const dropdown       = document.getElementById('locDropdown');
  const clearBtn       = document.getElementById('locClear');
  const spinner        = document.getElementById('locSpinner');
  const selectedBox    = document.getElementById('locSelected');
  const selectedPrimary= document.getElementById('locSelectedPrimary');
  const selectedFull   = document.getElementById('locSelectedFull');
  const selectedCoords = document.getElementById('locSelectedCoords');
  const hiddenLocation = document.getElementById('location');
  const hiddenLat      = document.getElementById('locationLat');
  const hiddenLng      = document.getElementById('locationLng');
  const hiddenPrimary  = document.getElementById('locationPrimary');

  if (!input) return; // Not on lend page

  // ── Input events ───────────────────────────────
  input.addEventListener('input', () => {
    const val = input.value.trim();
    showClear(val.length > 0);
    if (val.length < 3) { closeDropdown(); return; }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fetchPlaces(val), 400);
  });

  input.addEventListener('keydown', handleKeyboard);
  input.addEventListener('blur', () => setTimeout(closeDropdown, 200));
  clearBtn.addEventListener('click', clearSelection);

  // ── Fetch from OpenStreetMap Nominatim ─────────
  async function fetchPlaces(query) {
    showSpinner(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=6&accept-language=en`;
      const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      showSpinner(false);
      if (!data || data.length === 0) { renderNoResults(); return; }
      currentResults = data;
      renderDropdown(data, query);
    } catch (err) {
      showSpinner(false);
      console.error('[Location] Nominatim error:', err);
      renderNoResults();
    }
  }

  // ── Render dropdown ────────────────────────────
  function renderDropdown(results, query) {
    activeIndex = -1;
    dropdown.innerHTML = '';

    results.forEach((place, i) => {
      const displayName = place.display_name || '';
      const parts       = displayName.split(',');
      const main        = parts[0].trim();
      const sub         = parts.slice(1, 3).join(',').trim();

      const li = document.createElement('li');
      li.className = 'loc-item';
      li.setAttribute('role', 'option');
      li.setAttribute('data-index', i);

      li.innerHTML = `
        <span class="loc-item-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </span>
        <span class="loc-item-text">
          <span class="loc-item-main">${highlightMatch(main, query)}</span>
          ${sub ? `<span class="loc-item-sub">${sub}</span>` : ''}
        </span>
      `;

      li.addEventListener('mousedown', (e) => { e.preventDefault(); selectPlace(i); });
      dropdown.appendChild(li);
    });

    // Footer
    const footer = document.createElement('li');
    footer.className = 'loc-dropdown-footer';
    footer.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
      Powered by OpenStreetMap
    `;
    dropdown.appendChild(footer);
    openDropdown();
  }

  function renderNoResults() {
    dropdown.innerHTML = `<li class="loc-no-results">No results found. Try a different search.</li>`;
    openDropdown();
  }

  // ── Select a place ─────────────────────────────
  function selectPlace(index) {
    const place = currentResults[index];
    if (!place) return;

    const lat     = parseFloat(place.lat);
    const lng     = parseFloat(place.lon);
    const fullAddr = place.display_name;
    const primary  = extractPrimary(place.address);

    input.value = fullAddr;
    showClear(true);
    closeDropdown();

    // Console logs as requested
    console.log('[Location] Selected address:', fullAddr);
    console.log('[Location] Coordinates:', { lat, lng });
    console.log('[Location] Primary (shown to users):', primary);

    // Populate hidden form fields
    if (hiddenLocation) hiddenLocation.value = fullAddr;
    if (hiddenLat)      hiddenLat.value      = lat;
    if (hiddenLng)      hiddenLng.value      = lng;
    if (hiddenPrimary)  hiddenPrimary.value  = primary;

    // Show confirmation pill
    if (selectedPrimary) selectedPrimary.textContent = primary;
    if (selectedFull)    selectedFull.textContent    = fullAddr;
    if (selectedCoords)  selectedCoords.textContent  = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    if (selectedBox)     selectedBox.style.display   = 'flex';
  }

  // ── Extract city/area (shown publicly) ─────────
  function extractPrimary(address) {
    if (!address) return 'Location unavailable';
    // Pick most specific area name available
    const area    = address.suburb || address.neighbourhood || address.quarter
                  || address.village || address.town || address.city_district || '';
    const city    = address.city || address.town || address.county || '';
    const state   = address.state || '';
    // Build: "Diphu, Assam" or "Salt Lake, Kolkata"
    const parts   = [area, city || state].filter(Boolean);
    if (parts.length === 0) return state || address.country || 'Location unavailable';
    return parts.join(', ');
  }

  // ── Keyboard nav ───────────────────────────────
  function handleKeyboard(e) {
    if (!dropdown.classList.contains('open')) return;
    const items = dropdown.querySelectorAll('.loc-item');
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, items.length - 1); updateActive(items); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, -1); updateActive(items); }
    else if (e.key === 'Enter') { e.preventDefault(); if (activeIndex >= 0) selectPlace(activeIndex); }
    else if (e.key === 'Escape') { closeDropdown(); input.blur(); }
  }

  function updateActive(items) {
    items.forEach((item, i) => item.classList.toggle('active', i === activeIndex));
    if (activeIndex >= 0) items[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }

  function clearSelection() {
    input.value = '';
    if (hiddenLocation) hiddenLocation.value = '';
    if (hiddenLat)      hiddenLat.value      = '';
    if (hiddenLng)      hiddenLng.value      = '';
    if (hiddenPrimary)  hiddenPrimary.value  = '';
    if (selectedBox)    selectedBox.style.display = 'none';
    showClear(false);
    closeDropdown();
    input.focus();
  }

  function openDropdown()  { dropdown.classList.add('open'); }
  function closeDropdown() { dropdown.classList.remove('open'); activeIndex = -1; }
  function showClear(show) { clearBtn.style.display = show ? 'flex' : 'none'; }
  function showSpinner(show) {
    spinner.style.display  = show ? 'flex' : 'none';
    clearBtn.style.display = show ? 'none' : (input.value ? 'flex' : 'none');
  }

  function highlightMatch(text, query) {
    if (!query) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
  }

})();