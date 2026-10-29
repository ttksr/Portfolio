// Runs in <head>, before first paint: flags JS, restores theme and language.
// Kept in a file (not inline) so the Content-Security-Policy can forbid inline scripts.

(() => {
    const root = document.documentElement;
    root.classList.add('js');
    try {
        if (localStorage.getItem('theme') === 'light') root.dataset.theme = 'light';
        const saved = localStorage.getItem('lang');
        const lang = saved || ((navigator.language || 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en');
        root.lang = lang;
    } catch (e) { }
})();
