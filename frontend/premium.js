/* ============================================================
   BorrowBuddy — Premium visual layer behaviors
   3D tilt-on-hover for .tilt-3d elements, and scroll-reveal for
   .reveal / .reveal-scale / .reveal-group elements.
   Safe to include on any page; does nothing if elements absent.
   ============================================================ */
(function () {
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---- 3D tilt ---- */
    function initTilt() {
        if (reduceMotion) return;
        var cards = document.querySelectorAll('.tilt-3d');
        cards.forEach(function (card) {
            var maxTilt = parseFloat(card.dataset.tiltMax) || 10;

            card.addEventListener('mousemove', function (e) {
                var rect = card.getBoundingClientRect();
                var x = (e.clientX - rect.left) / rect.width - 0.5;
                var y = (e.clientY - rect.top) / rect.height - 0.5;
                var rotateY = x * maxTilt * 2;
                var rotateX = -y * maxTilt * 2;
                card.style.transform =
                    'perspective(1000px) rotateX(' + rotateX.toFixed(2) + 'deg) rotateY(' +
                    rotateY.toFixed(2) + 'deg) translateZ(0)';
            });

            card.addEventListener('mouseleave', function () {
                card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
            });
        });
    }

    /* ---- Scroll reveal ---- */
    function initReveal() {
        var targets = document.querySelectorAll('.reveal, .reveal-scale, .reveal-group');
        if (!targets.length) return;

        if (reduceMotion || !('IntersectionObserver' in window)) {
            targets.forEach(function (t) { t.classList.add('in-view'); });
            return;
        }

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

        targets.forEach(function (t) { observer.observe(t); });
    }

    /* ---- Inject a mesh background layer if a placeholder exists ---- */
    function initMeshBg() {
        var placeholder = document.querySelector('[data-mesh-bg]');
        if (!placeholder || placeholder.querySelector('.orb-1')) return;
        var dark = placeholder.dataset.meshBg === 'dark';
        placeholder.classList.add('mesh-bg');
        if (dark) placeholder.classList.add('mesh-dark');
        placeholder.innerHTML =
            '<span class="orb orb-1"></span>' +
            '<span class="orb orb-2"></span>' +
            '<span class="orb orb-3"></span>' +
            '<span class="orb orb-4"></span>';
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            initMeshBg();
            initTilt();
            initReveal();
        });
    } else {
        initMeshBg();
        initTilt();
        initReveal();
    }
})();
