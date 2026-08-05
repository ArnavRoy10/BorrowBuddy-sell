// BorrowBuddy — Dark Mode Manager
// Include dark-mode.css + dark-mode.js on every page for full support.

const THEME_KEY = 'borrowbuddy_theme';

// ── Apply theme IMMEDIATELY (before DOMContentLoaded) to avoid flash ──
(function applyThemeEarly() {
    const saved = localStorage.getItem(THEME_KEY);
    const theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
})();

function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    updateAllToggles(theme);
}

function toggleTheme() {
    const next = getCurrentTheme() === 'dark' ? 'light' : 'dark';
    setTheme(next);
}

// ── Keep every toggle switch/button on the page in sync ────────────
function updateAllToggles(theme) {
    document.querySelectorAll('.theme-switch-input').forEach(input => {
        input.checked = theme === 'dark';
    });
    document.querySelectorAll('.theme-toggle-icon').forEach(icon => {
        icon.innerHTML = theme === 'dark'
            ? '<i class="fas fa-moon"></i>'
            : '<i class="fas fa-sun"></i>';
    });
    const quickBtn = document.getElementById('darkModeQuickToggle');
    if (quickBtn) {
        quickBtn.innerHTML = theme === 'dark'
            ? '<i class="fas fa-sun"></i>'
            : '<i class="fas fa-moon"></i>';
    }
}

// ── Inject a settings-page toggle wherever #darkModeToggleContainer exists ──
function injectSettingsToggle() {
    const container = document.getElementById('darkModeToggleContainer');
    if (!container || document.getElementById('themeSwitchMain')) return;

    const theme = getCurrentTheme();

    container.innerHTML = `
        <div class="theme-toggle-wrap">
            <div class="theme-toggle-label">
                <div class="theme-toggle-icon" id="themeToggleIconMain">
                    <i class="fas fa-${theme === 'dark' ? 'moon' : 'sun'}"></i>
                </div>
                <div>
                    <div>Dark Mode</div>
                    <div style="font-size:.78rem;font-weight:400;color:#9ca3af;margin-top:.15rem">
                        Switch between light and dark themes
                    </div>
                </div>
            </div>
            <label class="theme-switch">
                <input type="checkbox" id="themeSwitchMain" class="theme-switch-input" ${theme === 'dark' ? 'checked' : ''}>
                <span class="theme-switch-slider"></span>
            </label>
        </div>
    `;

    document.getElementById('themeSwitchMain').addEventListener('change', (e) => {
        setTheme(e.target.checked ? 'dark' : 'light');
    });

    // Sync the class-based icon too
    document.querySelectorAll('.theme-toggle-icon').forEach(icon => {
        icon.classList.add('theme-toggle-icon'); // ensure selector match
    });
}

// ── Optional floating quick-toggle button (bottom-right, every page) ──
function injectQuickToggle() {
    if (document.getElementById('darkModeQuickToggle')) return;

    const theme = getCurrentTheme();
    const btn = document.createElement('button');
    btn.id = 'darkModeQuickToggle';
    btn.title = 'Toggle dark mode';
    btn.innerHTML = theme === 'dark'
        ? '<i class="fas fa-sun"></i>'
        : '<i class="fas fa-moon"></i>';
    btn.addEventListener('click', toggleTheme);
    document.body.appendChild(btn);
}

document.addEventListener('DOMContentLoaded', () => {
    injectSettingsToggle();
    injectQuickToggle();
    updateAllToggles(getCurrentTheme());

    // Auto-switch if OS theme changes and user hasn't manually chosen yet
    if (!localStorage.getItem(THEME_KEY)) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem(THEME_KEY)) {
                setTheme(e.matches ? 'dark' : 'light');
            }
        });
    }
});

window.BorrowBuddyTheme = { getCurrentTheme, setTheme, toggleTheme };