/**
 * BorrowBuddy — PWA registration + install prompt.
 * Registers only in real deployments (never inside an editor/preview iframe).
 */
(function () {
    const host = location.hostname;
    const BLOCKED =
        host.startsWith('id-preview--') ||
        host.startsWith('preview--') ||
        host.endsWith('lovableproject.com') ||
        host.endsWith('lovableproject-dev.com') ||
        host.endsWith('beta.lovable.dev') ||
        window.top !== window.self ||
        new URLSearchParams(location.search).has('sw=off');

    const scope = location.pathname.replace(/[^/]*$/, '');

    async function unregisterAll() {
        if (!('serviceWorker' in navigator)) return;
        const regs = await navigator.serviceWorker.getRegistrations();
        regs.forEach(r => {
            if (r.active?.scriptURL.includes('/sw.js')) r.unregister();
        });
    }

    if (BLOCKED) {
        unregisterAll();
    } else if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register(`${scope}sw.js`, { scope })
                .catch(err => console.warn('SW registration failed:', err));
        });
    }

    // ── Install prompt ────────────────────────────────────────────
    let deferredPrompt = null;

    function dismissedRecently() {
        const at = Number(localStorage.getItem('bb_install_dismissed') || 0);
        return Date.now() - at < 1000 * 60 * 60 * 24 * 14; // 14 days
    }

    function showBanner() {
        if (document.getElementById('pwaInstallBanner')) return;

        const bar = document.createElement('div');
        bar.id = 'pwaInstallBanner';
        bar.className = 'pwa-install-banner';
        bar.innerHTML = `
            <div class="pwa-install-icon"><i class="fas fa-mobile-screen"></i></div>
            <div class="pwa-install-copy">
                <strong>Install BorrowBuddy</strong>
                <span>Add it to your home screen for faster access and offline browsing.</span>
            </div>
            <div class="pwa-install-actions">
                <button type="button" class="pwa-btn ghost" data-pwa="dismiss">Not now</button>
                <button type="button" class="pwa-btn primary" data-pwa="install">Install</button>
            </div>`;
        document.body.appendChild(bar);
        requestAnimationFrame(() => bar.classList.add('visible'));

        bar.addEventListener('click', async (e) => {
            const action = e.target.closest('[data-pwa]')?.dataset.pwa;
            if (!action) return;
            if (action === 'dismiss') {
                localStorage.setItem('bb_install_dismissed', String(Date.now()));
                bar.classList.remove('visible');
                setTimeout(() => bar.remove(), 300);
                return;
            }
            if (action === 'install' && deferredPrompt) {
                deferredPrompt.prompt();
                await deferredPrompt.userChoice;
                deferredPrompt = null;
                bar.classList.remove('visible');
                setTimeout(() => bar.remove(), 300);
            }
        });
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (!dismissedRecently()) setTimeout(showBanner, 2500);
    });

    window.addEventListener('appinstalled', () => {
        localStorage.setItem('bb_installed', '1');
        document.getElementById('pwaInstallBanner')?.remove();
    });

    // iOS has no beforeinstallprompt — show manual instructions once.
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    if (isIOS && !standalone && !dismissedRecently()) {
        window.addEventListener('load', () => setTimeout(() => {
            if (document.getElementById('pwaInstallBanner')) return;
            const bar = document.createElement('div');
            bar.id = 'pwaInstallBanner';
            bar.className = 'pwa-install-banner visible';
            bar.innerHTML = `
                <div class="pwa-install-icon"><i class="fas fa-mobile-screen"></i></div>
                <div class="pwa-install-copy">
                    <strong>Install BorrowBuddy</strong>
                    <span>Tap <i class="fas fa-arrow-up-from-bracket"></i> Share, then “Add to Home Screen”.</span>
                </div>
                <div class="pwa-install-actions">
                    <button type="button" class="pwa-btn ghost" data-pwa="dismiss">Got it</button>
                </div>`;
            document.body.appendChild(bar);
            bar.addEventListener('click', (e) => {
                if (e.target.closest('[data-pwa="dismiss"]')) {
                    localStorage.setItem('bb_install_dismissed', String(Date.now()));
                    bar.remove();
                }
            });
        }, 3000));
    }

    // Offline / online toast
    function connectionToast(text, tone) {
        let el = document.getElementById('bbNetToast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'bbNetToast';
            el.className = 'bb-net-toast';
            document.body.appendChild(el);
        }
        el.textContent = text;
        el.dataset.tone = tone;
        el.classList.add('visible');
        if (tone === 'ok') setTimeout(() => el.classList.remove('visible'), 2500);
    }

    window.addEventListener('offline', () => connectionToast('You’re offline — showing cached data', 'warn'));
    window.addEventListener('online',  () => connectionToast('Back online', 'ok'));

    window.BorrowBuddyPWA = { get canInstall() { return !!deferredPrompt; }, showBanner };
})();