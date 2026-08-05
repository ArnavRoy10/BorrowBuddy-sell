/**
 * BorrowBuddy — Item Availability Calendar
 * ─────────────────────────────────────────────────────────────────
 * Scans all borrowed_* and requests_* (pending/approved) entries
 * for a given item, builds a set of blocked date ranges, and
 * renders an interactive calendar that disables those dates.
 *
 * Usage: call renderAvailabilityCalendar(itemId, containerId) after
 * item data has loaded on item-details.html or borrow-request.html.
 */

// ── Collect all blocked date ranges for an item ────────────────────
function getBlockedRanges(itemId) {
    const ranges = [];

    // 1) Scan every borrowed_* key — active borrows block those dates
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith('borrowed_')) continue;
        try {
            const list = JSON.parse(localStorage.getItem(key) || '[]');
            list.forEach(b => {
                if ((b.id === itemId || b.itemId === itemId) &&
                    (b.status === 'active' || b.status === 'pending_return') &&
                    b.borrowFrom && b.borrowTo) {
                    ranges.push({ from: b.borrowFrom, to: b.borrowTo, type: 'borrowed' });
                }
            });
        } catch(e) {}
    }

    // 2) Scan every requests_* key — pending/approved requests soft-block dates
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith('requests_')) continue;
        try {
            const list = JSON.parse(localStorage.getItem(key) || '[]');
            list.forEach(r => {
                if (r.itemId === itemId &&
                    (r.status === 'pending' || r.status === 'approved') &&
                    r.fromDate && r.toDate) {
                    ranges.push({ from: r.fromDate, to: r.toDate, type: r.status === 'approved' ? 'borrowed' : 'pending' });
                }
            });
        } catch(e) {}
    }

    return ranges;
}

// ── Check if a specific date falls within any blocked range ───────
function isDateBlocked(dateStr, ranges) {
    const d = new Date(dateStr).setHours(0,0,0,0);
    return ranges.find(r => {
        const from = new Date(r.from).setHours(0,0,0,0);
        const to   = new Date(r.to).setHours(0,0,0,0);
        return d >= from && d <= to;
    });
}

// ── Check if an entire requested range overlaps any blocked range ──
function rangeOverlaps(fromStr, toStr, ranges) {
    const reqFrom = new Date(fromStr).setHours(0,0,0,0);
    const reqTo   = new Date(toStr).setHours(0,0,0,0);
    return ranges.some(r => {
        const from = new Date(r.from).setHours(0,0,0,0);
        const to   = new Date(r.to).setHours(0,0,0,0);
        return reqFrom <= to && reqTo >= from;
    });
}

// ── Render interactive calendar widget ─────────────────────────────
function renderAvailabilityCalendar(itemId, containerId, onDateRangeSelected) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const blockedRanges = getBlockedRanges(itemId);
    let viewMonth = new Date();
    viewMonth.setDate(1);

    let selectedFrom = null;
    let selectedTo   = null;

    function daysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
    function fmtISO(d) { return d.toISOString().split('T')[0]; }

    function draw() {
        const year  = viewMonth.getFullYear();
        const month = viewMonth.getMonth();
        const today = new Date(); today.setHours(0,0,0,0);
        const numDays   = daysInMonth(year, month);
        const firstDow  = new Date(year, month, 1).getDay();
        const monthName = viewMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

        let cells = '';
        for (let i = 0; i < firstDow; i++) cells += `<div></div>`;

        for (let day = 1; day <= numDays; day++) {
            const cellDate = new Date(year, month, day);
            const iso       = fmtISO(cellDate);
            const isPast    = cellDate < today;
            const blocked   = isDateBlocked(iso, blockedRanges);
            const isSelStart= selectedFrom === iso;
            const isSelEnd  = selectedTo === iso;
            const inSelRange= selectedFrom && selectedTo && iso > selectedFrom && iso < selectedTo;
            const inSelSingle = selectedFrom && !selectedTo && iso === selectedFrom;

            let bg = 'white', color = '#1f2937', cursor = 'pointer', border = '1px solid #f3f4f6';
            let title = '';

            if (isPast) {
                bg = '#f9fafb'; color = '#d1d5db'; cursor = 'not-allowed';
            } else if (blocked) {
                bg = blocked.type === 'borrowed' ? '#fee2e2' : '#fef3c7';
                color = blocked.type === 'borrowed' ? '#dc2626' : '#92400e';
                cursor = 'not-allowed';
                title = blocked.type === 'borrowed' ? 'Already borrowed' : 'Pending request';
            } else if (isSelStart || isSelEnd || inSelSingle) {
                bg = '#2563eb'; color = 'white'; border = '2px solid #1d4ed8';
            } else if (inSelRange) {
                bg = '#dbeafe'; color = '#1d4ed8';
            }

            cells += `
                <div class="cal-day" data-date="${iso}" data-blocked="${!!blocked || isPast}"
                     title="${title}"
                     style="
                        aspect-ratio:1;display:flex;align-items:center;justify-content:center;
                        background:${bg};color:${color};cursor:${cursor};
                        border:${border};border-radius:8px;font-size:.8rem;font-weight:600;
                        transition:transform .1s;
                     ">
                    ${day}
                </div>`;
        }

        container.innerHTML = `
            <div style="background:white;border:1px solid #e5e7eb;border-radius:16px;padding:1.25rem;max-width:360px">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
                    <button id="calPrev" style="background:#f3f4f6;border:none;width:32px;height:32px;border-radius:8px;cursor:pointer;color:#6b7280">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <div style="font-weight:700;font-size:.95rem;color:#1f2937">${monthName}</div>
                    <button id="calNext" style="background:#f3f4f6;border:none;width:32px;height:32px;border-radius:8px;cursor:pointer;color:#6b7280">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
                <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:.3rem;margin-bottom:.5rem">
                    ${['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => `
                        <div style="text-align:center;font-size:.7rem;font-weight:700;color:#9ca3af">${d}</div>
                    `).join('')}
                </div>
                <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:.3rem">
                    ${cells}
                </div>
                <div style="display:flex;gap:1rem;margin-top:1rem;padding-top:1rem;border-top:1px solid #f3f4f6;font-size:.72rem;color:#6b7280">
                    <span><span style="display:inline-block;width:10px;height:10px;background:#fee2e2;border-radius:2px;margin-right:.3rem"></span>Borrowed</span>
                    <span><span style="display:inline-block;width:10px;height:10px;background:#fef3c7;border-radius:2px;margin-right:.3rem"></span>Pending</span>
                    <span><span style="display:inline-block;width:10px;height:10px;background:#2563eb;border-radius:2px;margin-right:.3rem"></span>Selected</span>
                </div>
                <div id="calSelectionInfo" style="margin-top:.875rem;font-size:.8rem;color:#374151;min-height:1.2rem"></div>
            </div>
        `;

        document.getElementById('calPrev').addEventListener('click', () => {
            viewMonth.setMonth(viewMonth.getMonth() - 1);
            draw();
        });
        document.getElementById('calNext').addEventListener('click', () => {
            viewMonth.setMonth(viewMonth.getMonth() + 1);
            draw();
        });

        container.querySelectorAll('.cal-day[data-blocked="false"]').forEach(cell => {
            cell.addEventListener('mouseenter', () => { if (!cell.dataset.blocked || cell.dataset.blocked === 'false') cell.style.transform = 'scale(1.08)'; });
            cell.addEventListener('mouseleave', () => { cell.style.transform = 'scale(1)'; });
            cell.addEventListener('click', () => handleDateClick(cell.dataset.date));
        });

        updateSelectionInfo();
    }

    function handleDateClick(iso) {
        if (!selectedFrom || (selectedFrom && selectedTo)) {
            // Start new selection
            selectedFrom = iso;
            selectedTo   = null;
        } else {
            // Selecting end date
            if (iso < selectedFrom) {
                // Clicked before start — restart
                selectedFrom = iso;
                selectedTo   = null;
            } else {
                // Check the whole range doesn't cross a blocked date
                if (rangeOverlaps(selectedFrom, iso, blockedRanges)) {
                    alert('Your selected range overlaps with dates that are already borrowed or pending. Please choose different dates.');
                    return;
                }
                selectedTo = iso;
            }
        }
        draw();

        if (selectedFrom && selectedTo && typeof onDateRangeSelected === 'function') {
            onDateRangeSelected(selectedFrom, selectedTo);
        }
    }

    function updateSelectionInfo() {
        const info = document.getElementById('calSelectionInfo');
        if (!info) return;
        if (selectedFrom && selectedTo) {
            const days = Math.ceil((new Date(selectedTo) - new Date(selectedFrom)) / 86400000) + 1;
            info.innerHTML = `<i class="fas fa-check-circle" style="color:#10b981"></i> ${fmtDisplay(selectedFrom)} → ${fmtDisplay(selectedTo)} <strong>(${days} day${days!==1?'s':''})</strong>`;
        } else if (selectedFrom) {
            info.innerHTML = `<i class="fas fa-map-marker-alt" style="color:#2563eb"></i> Start: ${fmtDisplay(selectedFrom)} — select end date`;
        } else {
            info.innerHTML = `<span style="color:#9ca3af">Click a date to start selecting your borrow period</span>`;
        }
    }

    function fmtDisplay(iso) {
        return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    }

    draw();

    // Expose a way to reset/get selection externally
    return {
        getSelection: () => ({ from: selectedFrom, to: selectedTo }),
        reset: () => { selectedFrom = null; selectedTo = null; draw(); }
    };
}

// ── Validate a manually-entered date range against blocked ranges ──
// Use this in borrow-request.js before allowing submission
function validateDateRange(itemId, fromDate, toDate) {
    const ranges = getBlockedRanges(itemId);
    if (rangeOverlaps(fromDate, toDate, ranges)) {
        const conflict = ranges.find(r => {
            const from = new Date(r.from).setHours(0,0,0,0);
            const to   = new Date(r.to).setHours(0,0,0,0);
            const reqFrom = new Date(fromDate).setHours(0,0,0,0);
            const reqTo   = new Date(toDate).setHours(0,0,0,0);
            return reqFrom <= to && reqTo >= from;
        });
        return {
            valid: false,
            message: conflict.type === 'borrowed'
                ? `These dates overlap with an existing borrow (${new Date(conflict.from).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} - ${new Date(conflict.to).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}). Please choose different dates.`
                : `These dates overlap with a pending request. Please choose different dates or wait for the other request to be resolved.`
        };
    }
    return { valid: true };
}

window.BorrowBuddyAvailability = {
    getBlockedRanges,
    isDateBlocked,
    rangeOverlaps,
    renderAvailabilityCalendar,
    validateDateRange
};