// 404 page: shows the requested path, follows the visitor's language, draws the dial's ticks.

(() => {
    const lang = document.documentElement.lang === 'fr' ? 'fr' : 'en';

    document.querySelectorAll('[data-en]').forEach(el => {
        el.textContent = el.dataset[lang] || el.dataset.en;
    });

    // The path is shown as text only (never as HTML), and shortened if someone pastes a novel in the URL
    const raw = location.pathname || '/';
    let path = raw;
    try { path = decodeURIComponent(raw); } catch (e) { } // malformed %-sequences: show as typed
    document.getElementById('nf-path').textContent = path.length > 60 ? path.slice(0, 57) + '…' : path;

    // The vault isn't on the server: point curious players back to the terminal
    if (path.startsWith('/.vault')) {
        const vault = {
            en: ['Good reflex. Wrong place.', 'The vault isn’t on the server. It lives closer to you: open the terminal on the home page (press t).'],
            fr: ['Bon réflexe. Mauvais endroit.', 'Le coffre n’est pas sur le serveur. Il est plus près de vous : ouvrez le terminal sur l’accueil (touche t).']
        }[lang];
        document.querySelector('.nf-title').textContent = vault[0];
        document.querySelector('.nf-text').textContent = vault[1];
    }

    const ticks = document.querySelector('.nf-ticks');
    for (let i = 0; i < 60; i++) {
        const major = i % 5 === 0;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', 200);
        line.setAttribute('x2', 200);
        line.setAttribute('y1', 10);
        line.setAttribute('y2', major ? 26 : 18);
        line.setAttribute('transform', `rotate(${i * 6} 200 200)`);
        if (major) line.classList.add('major');
        ticks.appendChild(line);
    }
})();
