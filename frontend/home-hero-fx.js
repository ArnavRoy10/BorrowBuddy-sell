/* ============================================================
   BorrowBuddy — Home hero interactions
   Toggle switches on the floating card + a draggable scrubber
   that live-updates a stat readout. index.html only.
   ============================================================ */
(function () {
    function initToggles() {
        document.querySelectorAll('.mini-switch').forEach(function (btn) {
            btn.addEventListener('click', function () {
                btn.classList.toggle('is-on');
            });
        });
    }

    function initScrubber() {
        var slider = document.getElementById('heroScrubber');
        var output = document.getElementById('heroScrubberValue');
        if (!slider || !output) return;

        function format(val) {
            var communities = Math.round(120 + val * 8.8);
            return communities.toLocaleString('en-IN');
        }

        function update() {
            var val = Number(slider.value);
            slider.style.setProperty('--fill', val + '%');
            output.textContent = format(val);
        }

        slider.addEventListener('input', update);
        update();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            initToggles();
            initScrubber();
        });
    } else {
        initToggles();
        initScrubber();
    }
})();
