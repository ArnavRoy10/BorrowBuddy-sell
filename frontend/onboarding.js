/**
 * BorrowBuddy — Guided onboarding tour for new users.
 * Runs once on the first authenticated visit (per user), then never again
 * unless restarted via Onboarding.restart() (Settings → "Replay tour").
 */
(function () {
    const PAGE = (location.pathname.split('/').pop() || 'index.html');

    const TOURS = {
        'index.html': [
            { title: 'Welcome to BorrowBuddy', text: 'Borrow what you need, lend what you don’t. Here’s a 30-second tour of the essentials.', selector: '.nav-brand' },
            { title: 'Find something nearby', text: 'Browse lists everything your neighbours are sharing, filtered by category and distance.', selector: 'a[href="browse.html"]' },
            { title: 'Earn from your stuff', text: 'Add an item once and it stays listed — you approve every request before anything leaves your door.', selector: 'a[href="lend.html"]' },
            { title: 'Track everything', text: 'Your dashboard shows active borrows, upcoming returns, payments and any open disputes.', selector: 'a[href="dashboard-enhanced.html"]' }
        ],
        'dashboard-enhanced.html': [
            { title: 'Your dashboard', text: 'A live snapshot of what you’re borrowing, lending and earning.', selector: '.dashboard-header, .browse-header' },
            { title: 'Return dates matter', text: 'Overdue items are flagged in orange. Return on time to keep your trust score high.', selector: '[data-tour="stats"], .stats-grid' },
            { title: 'Something go wrong?', text: 'If an item comes back damaged, open Disputes to report it and request a refund.', selector: 'a[href="disputes.html"]' }
        ],
        'browse.html': [
            { title: 'Search smart', text: 'Search by name or filter by category to narrow things down fast.', selector: '.search-bar, .browse-header' },
            { title: 'Request in a tap', text: 'Pick your dates, add a note for the lender, and send the request.', selector: '.items-grid, #itemsGrid' }
        ]
    };

    function tourKey() {
        const user = localStorage.getItem('username') || 'guest';
        return `bb_onboarding_done_${user}`;
    }

    let steps = [], index = 0, nodes = {};

    function isLoggedIn() {
        return !!(localStorage.getItem('authToken') || localStorage.getItem('token'));
    }

    function cleanup() {
        Object.values(nodes).forEach(n => n && n.remove());
        nodes = {};
        window.removeEventListener('resize', position);
        window.removeEventListener('scroll', position, true);
    }

    function finish(completed) {
        cleanup();
        localStorage.setItem(tourKey(), completed ? 'completed' : 'skipped');
    }

    function targetRect() {
        const step = steps[index];
        const el = step.selector ? document.querySelector(step.selector) : null;
        if (!el) return null;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return el.getBoundingClientRect();
    }

    function position() {
        if (!nodes.card) return;
        const rect = targetRect();
        const pad = 8;

        if (rect && rect.width) {
            nodes.spot.style.display = 'block';
            nodes.spot.style.top    = `${rect.top - pad}px`;
            nodes.spot.style.left   = `${rect.left - pad}px`;
            nodes.spot.style.width  = `${rect.width + pad * 2}px`;
            nodes.spot.style.height = `${rect.height + pad * 2}px`;

            const cardH = nodes.card.offsetHeight || 190;
            const below = rect.bottom + 16 + cardH < window.innerHeight;
            const top   = below ? rect.bottom + 16 : Math.max(16, rect.top - cardH - 16);
            const left  = Math.min(
                Math.max(16, rect.left + rect.width / 2 - nodes.card.offsetWidth / 2),
                window.innerWidth - nodes.card.offsetWidth - 16
            );
            nodes.card.style.top  = `${top}px`;
            nodes.card.style.left = `${left}px`;
        } else {
            nodes.spot.style.display = 'none';
            nodes.card.style.top  = '50%';
            nodes.card.style.left = '50%';
            nodes.card.style.transform = 'translate(-50%, -50%)';
        }
    }

    function renderStep() {
        const step = steps[index];
        const last = index === steps.length - 1;
        nodes.card.innerHTML = `
            <button class="ob-skip" type="button" data-ob="skip">Skip tour</button>
            <span class="ob-step-count">Step ${index + 1} of ${steps.length}</span>
            <h4>${step.title}</h4>
            <p>${step.text}</p>
            <div class="ob-actions">
                <div class="ob-dots">
                    ${steps.map((_, i) => `<span class="ob-dot${i === index ? ' active' : ''}"></span>`).join('')}
                </div>
                <div class="ob-btns">
                    ${index > 0 ? '<button class="ob-btn ghost" type="button" data-ob="prev">Back</button>' : ''}
                    <button class="ob-btn primary" type="button" data-ob="next">${last ? 'Got it' : 'Next'}</button>
                </div>
            </div>`;
        position();
    }

    function startSteps() {
        if (!steps.length) return finish(true);

        nodes.overlay = document.createElement('div');
        nodes.overlay.className = 'ob-overlay visible';

        nodes.spot = document.createElement('div');
        nodes.spot.className = 'ob-spotlight';

        nodes.card = document.createElement('div');
        nodes.card.className = 'ob-card';
        nodes.card.setAttribute('role', 'dialog');
        nodes.card.setAttribute('aria-label', 'Product tour');

        document.body.append(nodes.overlay, nodes.spot, nodes.card);

        nodes.card.addEventListener('click', (e) => {
            const action = e.target.closest('[data-ob]')?.dataset.ob;
            if (!action) return;
            if (action === 'skip') return finish(false);
            if (action === 'prev') { index = Math.max(0, index - 1); return renderStep(); }
            if (action === 'next') {
                if (index === steps.length - 1) return finish(true);
                index++; renderStep();
            }
        });

        window.addEventListener('resize', position);
        window.addEventListener('scroll', position, true);
        renderStep();
    }

    function showWelcome() {
        nodes.overlay = document.createElement('div');
        nodes.overlay.className = 'ob-overlay visible';

        const modal = document.createElement('div');
        modal.className = 'ob-welcome';
        modal.innerHTML = `
            <div class="ob-welcome-icon"><i class="fas fa-hand-holding-heart"></i></div>
            <h3>Welcome to BorrowBuddy${localStorage.getItem('username') ? ', ' + localStorage.getItem('username') : ''}!</h3>
            <p>Take a quick tour and we’ll show you how to borrow your first item, list something of your own, and stay protected if anything goes wrong.</p>
            <div class="ob-btns">
                <button class="ob-btn ghost" type="button" data-ob="skip">Maybe later</button>
                <button class="ob-btn primary" type="button" data-ob="start">Start the tour</button>
            </div>`;
        nodes.welcome = modal;
        document.body.append(nodes.overlay, modal);

        modal.addEventListener('click', (e) => {
            const action = e.target.closest('[data-ob]')?.dataset.ob;
            if (action === 'skip') return finish(false);
            if (action === 'start') {
                modal.remove();
                nodes.overlay.remove();
                nodes.welcome = null;
                startSteps();
            }
        });
    }

    const Onboarding = {
        start(withWelcome = true) {
            if (nodes.card || nodes.welcome) return;
            steps = TOURS[PAGE] || TOURS['index.html'];
            index = 0;
            withWelcome ? showWelcome() : startSteps();
        },

        restart() {
            localStorage.removeItem(tourKey());
            cleanup();
            this.start(true);
        },

        hasSeen() {
            return !!localStorage.getItem(tourKey());
        },

        maybeStart() {
            if (!isLoggedIn()) return;
            if (this.hasSeen()) return;
            if (!TOURS[PAGE]) return; // only auto-run on key pages
            setTimeout(() => this.start(true), 700);
        }
    };

    window.Onboarding = Onboarding;
    document.addEventListener('DOMContentLoaded', () => Onboarding.maybeStart());
})();