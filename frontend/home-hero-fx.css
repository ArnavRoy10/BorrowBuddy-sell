/* ============================================================
   BorrowBuddy — Home page 3D/animation layer (index.html only)
   Floating functional cards + scrubber around the hero orbit,
   plus ambient colour fills so the rest of the page never reads
   as flat white space. Loads after premium.css/styles.css.
   ============================================================ */

/* ---------- Hero: floating functional cards ---------- */
.hero-image {
    position: relative;
}

.hero-float-cards {
    position: absolute;
    inset: -6% -8%;
    pointer-events: none;
    z-index: 2;
}

.float-card {
    position: absolute;
    pointer-events: auto;
    background: rgba(20, 14, 42, 0.55);
    backdrop-filter: blur(18px) saturate(160%);
    -webkit-backdrop-filter: blur(18px) saturate(160%);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 18px;
    box-shadow: 0 18px 40px rgba(10, 6, 30, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.08);
    padding: 0.85rem 1rem;
    color: #f1f5f9;
    animation: cardFloat 7s ease-in-out infinite;
}

@keyframes cardFloat {
    0%, 100% { transform: translateY(0) rotate(var(--tilt, 0deg)); }
    50%      { transform: translateY(-10px) rotate(var(--tilt, 0deg)); }
}

@media (prefers-reduced-motion: reduce) {
    .float-card { animation: none; }
}

/* Toggle card — top left */
.card-toggle {
    top: 2%;
    left: -4%;
    width: 172px;
    --tilt: -3deg;
    animation-delay: 0s;
}

.card-toggle .float-card-title {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(226, 232, 240, 0.6);
    margin-bottom: 0.6rem;
}

.mini-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.55rem;
}

.mini-toggle-row:last-child { margin-bottom: 0; }

.mini-toggle-row span {
    font-size: 0.78rem;
    color: #e2e8f0;
}

.mini-switch {
    width: 34px;
    height: 19px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.15);
    border: none;
    position: relative;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.25s ease;
}

.mini-switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 15px;
    height: 15px;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.25s ease;
}

.mini-switch.is-on {
    background: linear-gradient(135deg, #667eea, #764ba2);
}

.mini-switch.is-on::after {
    transform: translateX(15px);
}

/* Play card — top right */
.card-play {
    top: -6%;
    right: -6%;
    width: 58px;
    height: 58px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #f97316, #ec4899);
    box-shadow: 0 14px 30px rgba(236, 72, 153, 0.5);
    --tilt: 0deg;
    animation-delay: 1.4s;
    cursor: pointer;
}

.card-play i {
    color: #fff;
    font-size: 1.1rem;
    margin-left: 3px;
}

/* Bar chart card — mid left, lower */
.card-chart {
    bottom: 6%;
    left: -9%;
    width: 168px;
    --tilt: 2deg;
    animation-delay: 0.6s;
}

.card-chart .float-card-title {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(226, 232, 240, 0.6);
    margin-bottom: 0.7rem;
}

.mini-bars {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    height: 46px;
}

.mini-bars span {
    flex: 1;
    border-radius: 4px 4px 0 0;
    background: linear-gradient(180deg, #a78bfa, #667eea);
    animation: barGrow 2.4s ease-in-out infinite alternate;
}

.mini-bars span:nth-child(1) { height: 40%; animation-delay: 0s; }
.mini-bars span:nth-child(2) { height: 65%; animation-delay: 0.15s; }
.mini-bars span:nth-child(3) { height: 45%; animation-delay: 0.3s; }
.mini-bars span:nth-child(4) { height: 85%; animation-delay: 0.45s; }
.mini-bars span:nth-child(5) { height: 60%; animation-delay: 0.6s; }

@keyframes barGrow {
    0%   { transform: scaleY(0.85); }
    100% { transform: scaleY(1); }
}

.card-chart-caption {
    margin-top: 0.5rem;
    font-size: 0.7rem;
    color: rgba(226, 232, 240, 0.55);
}

/* Gauge card — bottom right */
.card-gauge {
    bottom: -4%;
    right: -2%;
    width: 150px;
    text-align: center;
    --tilt: -2deg;
    animation-delay: 2s;
}

.gauge-ring {
    width: 74px;
    height: 74px;
    margin: 0 auto 0.4rem;
    border-radius: 50%;
    background: conic-gradient(#4ade80 0% var(--gauge, 92%), rgba(255,255,255,0.12) var(--gauge, 92%) 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
}

.gauge-ring::before {
    content: '';
    position: absolute;
    inset: 7px;
    border-radius: 50%;
    background: rgba(20, 14, 42, 0.9);
}

.gauge-ring span {
    position: relative;
    z-index: 1;
    font-size: 0.85rem;
    font-weight: 700;
    color: #fff;
}

.card-gauge .float-card-title {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(226, 232, 240, 0.6);
}

@media (max-width: 900px) {
    .hero-float-cards { display: none; }
}

/* ---------- Hero scrubber: draggable line control ---------- */
.hero-scrubber {
    position: relative;
    z-index: 2;
    margin-top: 2.25rem;
    max-width: 420px;
}

.hero-scrubber-label {
    display: flex;
    justify-content: space-between;
    font-size: 0.78rem;
    color: rgba(226, 232, 240, 0.7);
    margin-bottom: 0.5rem;
}

.hero-scrubber-label strong {
    color: #fff;
    font-weight: 700;
}

.hero-scrubber input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 6px;
    border-radius: 999px;
    background: linear-gradient(90deg, #667eea var(--fill, 50%), rgba(255,255,255,0.15) var(--fill, 50%));
    outline: none;
    cursor: pointer;
}

.hero-scrubber input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #fff;
    border: 4px solid #764ba2;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    cursor: grab;
}

.hero-scrubber input[type="range"]::-webkit-slider-thumb:active {
    cursor: grabbing;
    transform: scale(1.1);
}

.hero-scrubber input[type="range"]::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #fff;
    border: 4px solid #764ba2;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    cursor: grab;
}

/* ---------- Ambient colour fills — no flat white space ---------- */
.features, .how-it-works, .categories {
    position: relative;
    z-index: 1;
}

.features::before, .how-it-works::before, .categories::before {
    content: '';
    position: absolute;
    z-index: -1;
    border-radius: 50%;
    filter: blur(90px);
    pointer-events: none;
}

.features::before {
    width: 46vw;
    height: 46vw;
    max-width: 640px;
    max-height: 640px;
    top: -10%;
    right: -14%;
    background: radial-gradient(circle at 40% 40%, rgba(37, 99, 235, 0.16), transparent 70%);
    animation: meshFloat2 26s ease-in-out infinite;
}

.how-it-works::before {
    width: 42vw;
    height: 42vw;
    max-width: 560px;
    max-height: 560px;
    top: 10%;
    left: -14%;
    background: radial-gradient(circle at 40% 40%, rgba(124, 58, 237, 0.14), transparent 70%);
    animation: meshFloat3 28s ease-in-out infinite;
}

.categories::before {
    width: 40vw;
    height: 40vw;
    max-width: 520px;
    max-height: 520px;
    bottom: -12%;
    right: -10%;
    background: radial-gradient(circle at 40% 40%, rgba(16, 185, 129, 0.15), transparent 70%);
    animation: meshFloat1 24s ease-in-out infinite;
}

.cta {
    position: relative;
    overflow: hidden;
}

@media (prefers-reduced-motion: reduce) {
    .features::before, .how-it-works::before, .categories::before {
        animation: none;
    }
}
