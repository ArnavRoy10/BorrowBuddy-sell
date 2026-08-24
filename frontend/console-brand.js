/* BorrowBuddy — console branding banner */
(function () {
    if (window.__bbConsoleBannerShown) return;
    window.__bbConsoleBannerShown = true;

    console.log(
        '%c🔄 BorrowBuddy',
        'font-size: 28px; font-weight: 800; color: #2563eb; padding: 4px 0;'
    );
    console.log(
        '%cShare resources, build community 🤝',
        'font-size: 13px; color: #64748b;'
    );
    console.log(
        '%c✨ Built with ❤️ by Arnav Roy',
        'font-size: 14px; font-weight: 600; color: #7c3aed; padding-top: 4px;'
    );
    console.log(
        '%c👀 Poking around the console? Nice! If you spot a bug, feel free to reach out.',
        'font-size: 12px; color: #94a3b8; padding-top: 4px;'
    );
})();
