/**
 * BorrowBuddy — Illustrated empty states
 *
 *   EmptyState.render('#itemsGrid', 'noItems');
 *   EmptyState.render('#grid', 'noResults', { title: '...', action: { label, href } });
 */
(function () {
    const illustrations = {
        box: `
            <svg viewBox="0 0 200 160" role="img" aria-hidden="true">
                <ellipse class="es-bg" cx="100" cy="138" rx="70" ry="12"/>
                <path class="es-mid" d="M48 62h104v66a6 6 0 0 1-6 6H54a6 6 0 0 1-6-6z"/>
                <path class="es-accent" d="M40 40h120v26H40z" opacity=".9"/>
                <path class="es-bg" d="M86 40h28v26H86z"/>
                <path class="es-line" d="M74 22l14 14M126 22l-14 14"/>
            </svg>`,
        search: `
            <svg viewBox="0 0 200 160" role="img" aria-hidden="true">
                <ellipse class="es-bg" cx="100" cy="138" rx="66" ry="12"/>
                <circle class="es-bg" cx="92" cy="66" r="42"/>
                <circle cx="92" cy="66" r="30" fill="none" class="es-line" stroke-width="6"/>
                <path class="es-accent" d="M116 88l10-10 28 28a7 7 0 0 1-10 10z"/>
                <path class="es-line" d="M78 66h28M86 78h20"/>
            </svg>`,
        inbox: `
            <svg viewBox="0 0 200 160" role="img" aria-hidden="true">
                <ellipse class="es-bg" cx="100" cy="138" rx="66" ry="12"/>
                <path class="es-mid" d="M42 74l16-38h84l16 38v42a6 6 0 0 1-6 6H48a6 6 0 0 1-6-6z"/>
                <path class="es-bg" d="M42 74h34l6 14h36l6-14h34v14H42z"/>
                <path class="es-accent" d="M84 24h32v8H84z"/>
            </svg>`,
        handshake: `
            <svg viewBox="0 0 200 160" role="img" aria-hidden="true">
                <ellipse class="es-bg" cx="100" cy="138" rx="66" ry="12"/>
                <rect class="es-mid" x="26" y="60" width="52" height="30" rx="8"/>
                <rect class="es-mid" x="122" y="60" width="52" height="30" rx="8"/>
                <path class="es-accent" d="M76 62h48v28H76z" opacity=".85"/>
                <path class="es-line" d="M86 76h28"/>
            </svg>`,
        shield: `
            <svg viewBox="0 0 200 160" role="img" aria-hidden="true">
                <ellipse class="es-bg" cx="100" cy="138" rx="60" ry="12"/>
                <path class="es-mid" d="M100 20l46 18v34c0 28-19 46-46 54-27-8-46-26-46-54V38z"/>
                <path class="es-accent2" d="M84 74l12 12 24-24 8 8-32 32-20-20z"/>
            </svg>`,
        chat: `
            <svg viewBox="0 0 200 160" role="img" aria-hidden="true">
                <ellipse class="es-bg" cx="100" cy="138" rx="62" ry="12"/>
                <path class="es-mid" d="M36 34h96a8 8 0 0 1 8 8v46a8 8 0 0 1-8 8H70l-22 18V96h-12a8 8 0 0 1-8-8V42a8 8 0 0 1 8-8z"/>
                <path class="es-accent" d="M56 54h56v8H56zM56 70h36v8H56z"/>
            </svg>`,
        receipt: `
            <svg viewBox="0 0 200 160" role="img" aria-hidden="true">
                <ellipse class="es-bg" cx="100" cy="140" rx="56" ry="11"/>
                <path class="es-mid" d="M62 20h76v104l-12-8-13 8-13-8-13 8-13-8-12 8z"/>
                <path class="es-accent" d="M78 46h44v8H78zM78 64h44v8H78zM78 82h28v8H78z"/>
            </svg>`,
        error: `
            <svg viewBox="0 0 200 160" role="img" aria-hidden="true">
                <ellipse class="es-bg" cx="100" cy="138" rx="62" ry="12"/>
                <circle class="es-bg" cx="100" cy="70" r="46"/>
                <path class="es-warn" d="M100 38a7 7 0 0 1 7 7v32a7 7 0 0 1-14 0V45a7 7 0 0 1 7-7z"/>
                <circle class="es-warn" cx="100" cy="96" r="7"/>
            </svg>`
    };

    const presets = {
        noItems: {
            art: 'box',
            title: 'No items yet',
            text: 'Items you list for lending will show up here. Sharing something you rarely use is the fastest way to start earning.',
            action: { label: 'List an item', href: 'lend.html', icon: 'fa-plus' }
        },
        noResults: {
            art: 'search',
            title: 'Nothing matched your search',
            text: 'Try a different keyword, widen your distance, or clear the filters to see everything nearby.',
            action: { label: 'Clear filters', href: 'browse.html', icon: 'fa-rotate-left' }
        },
        noBorrowed: {
            art: 'handshake',
            title: 'You haven’t borrowed anything yet',
            text: 'Browse what your neighbours are lending — from drills to camping gear — and send your first request.',
            action: { label: 'Browse items', href: 'browse.html', icon: 'fa-search' }
        },
        noLent: {
            art: 'handshake',
            title: 'Nothing lent out right now',
            text: 'Once someone borrows one of your items, you’ll be able to track it and its return date here.',
            action: { label: 'View my items', href: 'my-items.html', icon: 'fa-boxes' }
        },
        noRequests: {
            art: 'inbox',
            title: 'Your inbox is empty',
            text: 'Borrow requests from other members land here so you can approve or decline them in one tap.',
            action: { label: 'Browse items', href: 'browse.html', icon: 'fa-search' }
        },
        noMessages: {
            art: 'chat',
            title: 'No conversations yet',
            text: 'Message a lender to ask about condition, pickup time or accessories before you request an item.',
            action: { label: 'Find something to borrow', href: 'browse.html', icon: 'fa-search' }
        },
        noTransactions: {
            art: 'receipt',
            title: 'No transactions yet',
            text: 'Payments, deposits and refunds will appear here with a downloadable receipt for each one.',
            action: { label: 'Browse items', href: 'browse.html', icon: 'fa-search' }
        },
        noCart: {
            art: 'box',
            title: 'Your cart is empty',
            text: 'Add items you’d like to borrow and check out in one go with a single security deposit.',
            action: { label: 'Start browsing', href: 'browse.html', icon: 'fa-search' }
        },
        noDisputes: {
            art: 'shield',
            title: 'No disputes — nice going',
            text: 'If an item comes back damaged or a rental goes wrong, report it here and we’ll help sort out a refund.',
            action: { label: 'Report an issue', onclick: 'openDisputeModal()', icon: 'fa-flag' }
        },
        error: {
            art: 'error',
            title: 'We couldn’t load this',
            text: 'Something went wrong on our side. Check your connection and try again.',
            action: { label: 'Retry', onclick: 'location.reload()', icon: 'fa-rotate-right' }
        },
        offline: {
            art: 'error',
            title: 'You’re offline',
            text: 'BorrowBuddy needs a connection to load fresh data. We’ll reload as soon as you’re back online.',
            action: { label: 'Try again', onclick: 'location.reload()', icon: 'fa-rotate-right' }
        }
    };

    function buildAction(action) {
        if (!action) return '';
        const cls  = `btn ${action.variant === 'ghost' ? 'btn-secondary' : 'btn-primary'}`;
        if (action.onclick) {
            return `<button type="button" class="${cls}" onclick="${action.onclick}">${action.label}</button>`;
        }
        return `<a class="${cls}" href="${action.href || '#'}">${action.label}</a>`;
    }

    const EmptyState = {
        illustrations,
        presets,

        markup(preset, overrides = {}) {
            const base = typeof preset === 'string' ? (presets[preset] || presets.noResults) : preset;
            const cfg  = { ...base, ...overrides };
            const art  = illustrations[cfg.art] || illustrations.box;
            const actions = [cfg.action, cfg.secondaryAction].filter(Boolean).map(buildAction).join('');

            return `
                <div class="empty-state" role="status">
                    <div class="empty-state-illustration">${art}</div>
                    <h3>${cfg.title}</h3>
                    <p>${cfg.text}</p>
                    ${actions ? `<div class="empty-state-actions">${actions}</div>` : ''}
                </div>`;
        },

        render(target, preset, overrides = {}) {
            const el = typeof target === 'string' ? document.querySelector(target) : target;
            if (!el) return;
            el.innerHTML = this.markup(preset, overrides);
        }
    };

    window.EmptyState = EmptyState;
})();