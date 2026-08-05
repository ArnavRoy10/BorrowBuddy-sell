/**
 * BorrowBuddy — Skeleton loading helpers
 * Use instead of spinners while data is being fetched.
 *
 *   Skeleton.show('#itemsGrid', 'cards', 6);
 *   ... await api.getAllItems() ...
 *   Skeleton.hide('#itemsGrid');
 */
(function () {
    function resolve(target) {
        if (!target) return null;
        return typeof target === 'string' ? document.querySelector(target) : target;
    }

    const templates = {
        cards(count) {
            let html = '<div class="skeleton-grid" data-skeleton>';
            for (let i = 0; i < count; i++) {
                html += `
                    <div class="skeleton-card">
                        <div class="skeleton skeleton-thumb"></div>
                        <div class="skeleton-card-body">
                            <div class="skeleton skeleton-title"></div>
                            <div class="skeleton skeleton-text lg"></div>
                            <div class="skeleton skeleton-text md"></div>
                            <div class="skeleton-card-footer">
                                <div class="skeleton skeleton-pill"></div>
                                <div class="skeleton skeleton-pill"></div>
                            </div>
                        </div>
                    </div>`;
            }
            return html + '</div>';
        },

        list(count) {
            let html = '<div class="skeleton-list" data-skeleton>';
            for (let i = 0; i < count; i++) {
                html += `
                    <div class="skeleton-row">
                        <div class="skeleton skeleton-avatar"></div>
                        <div class="skeleton-row-main">
                            <div class="skeleton skeleton-title"></div>
                            <div class="skeleton skeleton-text lg"></div>
                        </div>
                        <div class="skeleton skeleton-pill"></div>
                    </div>`;
            }
            return html + '</div>';
        },

        stats(count) {
            let html = '<div class="skeleton-stats" data-skeleton>';
            for (let i = 0; i < count; i++) {
                html += `
                    <div class="skeleton-stat">
                        <div class="skeleton skeleton-text sm"></div>
                        <div class="skeleton skeleton-title" style="width:50%"></div>
                        <div class="skeleton skeleton-text md"></div>
                    </div>`;
            }
            return html + '</div>';
        },

        text(count) {
            let html = '<div data-skeleton>';
            for (let i = 0; i < count; i++) {
                html += '<div class="skeleton skeleton-text lg"></div>';
            }
            return html + '</div>';
        }
    };

    const Skeleton = {
        markup(variant = 'cards', count = 6) {
            const build = templates[variant] || templates.cards;
            return build(count);
        },

        show(target, variant = 'cards', count = 6) {
            const el = resolve(target);
            if (!el) return;
            el.setAttribute('aria-busy', 'true');
            el.innerHTML = this.markup(variant, count);
        },

        hide(target) {
            const el = resolve(target);
            if (!el) return;
            el.removeAttribute('aria-busy');
            el.querySelectorAll('[data-skeleton]').forEach(n => n.remove());
        },

        /** Replace any legacy spinner markup inside a container with skeletons. */
        replaceSpinners(root = document) {
            root.querySelectorAll('.loading-spinner, .spinner, .loader').forEach(spinner => {
                const host = spinner.closest('[id]') || spinner.parentElement;
                if (!host) return;
                spinner.outerHTML = Skeleton.markup('cards', 4);
            });
        }
    };

    window.Skeleton = Skeleton;
})();