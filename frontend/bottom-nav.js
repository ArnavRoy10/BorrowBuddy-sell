// BorrowBuddy — Mobile Bottom Navigation Bar
// Auto-injects a 5-tab bottom bar on screens ≤768px.
// Include bottom-nav.css + bottom-nav.js on every page.

(function () {
    const PRIMARY_TABS = [
        { id: 'home',      label: 'Home',     icon: 'fa-home',          href: 'index.html' },
        { id: 'browse',    label: 'Browse',   icon: 'fa-search',        href: 'browse.html' },
        { id: 'add',       label: 'Add',      icon: 'fa-plus',          href: 'lend.html', fab: true },
        { id: 'cart',      label: 'Cart',     icon: 'fa-shopping-cart', href: 'cart.html', badgeId: 'cartBadge' },
        { id: 'more',      label: 'More',     icon: 'fa-ellipsis-h',    href: '#more' },
    ];

    // Secondary links shown in the "More" bottom sheet
    const MORE_LINKS = [
        { label: 'Dashboard',    icon: 'fa-th-large',    href: 'dashboard-enhanced.html' },
        { label: 'My Items',     icon: 'fa-boxes',       href: 'my-items.html' },
        { label: 'Borrowed',     icon: 'fa-hand-holding',href: 'my-borrowed.html' },
        { label: 'Lent',         icon: 'fa-share',       href: 'my-lent.html' },
        { label: 'Requests',     icon: 'fa-inbox',       href: 'requests.html' },
        { label: 'Disputes',     icon: 'fa-shield-alt',  href: 'disputes.html' },
        { label: 'Sync',         icon: 'fa-clock-rotate-left', href: 'sync-history.html' },
        { label: 'Messages',     icon: 'fa-comments',    href: 'messages.html', badgeId: 'messagesBadge' },
        { label: 'Transactions', icon: 'fa-receipt',     href: 'transactions.html' },
        { label: 'Profile',      icon: 'fa-user',        href: 'profile.html' },
        { label: 'Settings',     icon: 'fa-cog',         href: 'settings.html' },
        { label: 'Logout',       icon: 'fa-sign-out-alt',href: '#logout', danger: true },
    ];

    function currentPage() {
        const path = window.location.pathname.split('/').pop() || 'index.html';
        return path;
    }

    function isActive(href) {
        if (href === '#more' || href === '#logout') return false;
        return currentPage() === href;
    }

    function buildBottomNav() {
        if (document.getElementById('bottomNav')) return;

        const nav = document.createElement('nav');
        nav.id = 'bottomNav';

        const inner = document.createElement('div');
        inner.className = 'bottom-nav-inner';

        PRIMARY_TABS.forEach(tab => {
            const active = isActive(tab.href);
            const el = document.createElement(tab.href === '#more' ? 'button' : 'a');
            el.className = `bn-item${active ? ' active' : ''}${tab.fab ? ' bn-fab' : ''}`;
            if (tab.href !== '#more') el.href = tab.href;
            else {
                el.style.background = 'none';
                el.style.border = 'none';
                el.style.font = 'inherit';
            }

            el.innerHTML = `
                <span class="bn-icon-wrap">
                    <i class="fas ${tab.icon}"></i>
                    ${tab.badgeId ? `<span class="bn-badge" id="bn_${tab.badgeId}" style="display:none">0</span>` : ''}
                </span>
                <span>${tab.label}</span>
            `;

            if (tab.href === '#more') {
                el.addEventListener('click', openMoreSheet);
            }

            inner.appendChild(el);
        });

        nav.appendChild(inner);
        document.body.appendChild(nav);

        buildMoreSheet();
        syncBadges();
    }

    function buildMoreSheet() {
        if (document.getElementById('bnMoreSheet')) return;

        const sheet = document.createElement('div');
        sheet.id = 'bnMoreSheet';
        sheet.innerHTML = `
            <div class="bn-sheet-panel" onclick="event.stopPropagation()">
                <div class="bn-sheet-handle"></div>
                <div class="bn-sheet-grid">
                    ${MORE_LINKS.map(link => `
                        <a href="${link.href}" class="bn-sheet-item" ${link.danger ? 'data-danger' : ''} ${link.href === '#logout' ? 'onclick="event.preventDefault(); if(window.logout) window.logout();"' : ''}>
                            <span class="bn-sheet-icon">
                                <i class="fas ${link.icon}"></i>
                                ${link.badgeId ? `<span class="bn-badge" id="bn_${link.badgeId}" style="display:none">0</span>` : ''}
                            </span>
                            ${link.label}
                        </a>
                    `).join('')}
                </div>
            </div>
        `;
        sheet.addEventListener('click', closeMoreSheet);
        document.body.appendChild(sheet);
    }

    function openMoreSheet(e) {
        e.preventDefault();
        document.getElementById('bnMoreSheet')?.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeMoreSheet() {
        document.getElementById('bnMoreSheet')?.classList.remove('open');
        document.body.style.overflow = '';
    }

    // ── Keep badges (cart count, unread messages) synced with the
    //    existing navbar badges already maintained by other scripts ──
    function syncBadges() {
        const watch = ['cartBadge', 'messagesBadge'];
        watch.forEach(id => {
            const source = document.getElementById(id);
            const target = document.getElementById(`bn_${id}`);
            if (!source || !target) return;

            const update = () => {
                target.textContent = source.textContent;
                target.style.display = source.style.display === 'none' || source.textContent === '0' || !source.textContent
                    ? 'none' : 'flex';
            };
            update();

            // Watch for changes to the original badge (other scripts update it periodically)
            const observer = new MutationObserver(update);
            observer.observe(source, { childList: true, characterData: true, subtree: true, attributes: true });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildBottomNav);
    } else {
        buildBottomNav();
    }

    // Re-sync badges periodically in case other scripts update them after injection
    setInterval(syncBadges, 3000);
})();