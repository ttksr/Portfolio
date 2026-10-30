// Scrolling band of live facts under the header. Everything shown is true and current:
// what you're working on, UTC time, the next real transit of HD 110067, the site's security setup.
// Built with DOM nodes only (the page enforces Trusted Types).

(() => {
    const track = document.getElementById('ticker-track');
    if (!track) return;
    const ticker = track.parentElement;
    const C = window.CONTENT;
    const pick = v => window.i18n.pick(v);
    const pad = n => String(n).padStart(2, '0');

    const live = {
        now: () => ['now', pick(C.now)],
        utc: () => {
            const d = new Date();
            return ['utc', `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`];
        },
        transit: () => {
            const t = window.site?.system?.nextTransit?.();
            if (!t) return null;
            if (t.transiting) return ['transit', `hd 110067 ${t.id} · transiting now`];
            const m = Math.max(0, Math.floor(t.days * 1440));
            const d = Math.floor(m / 1440);
            const hm = `${pad(Math.floor(m / 60) % 24)}h ${pad(m % 60)}m`;
            return ['next transit', `hd 110067 ${t.id} in ${d ? d + 'd ' : ''}${hm}`];
        },
        session: () => ['session', document.getElementById('session-id')?.textContent || '']
    };

    // One "run" of items; the track holds two identical runs so the loop is seamless
    const slots = [];

    function item(entry) {
        const wrap = document.createElement('span');
        wrap.className = 'ticker-item';
        const label = document.createElement('span');
        label.className = 'ticker-label';
        const text = document.createElement('span');
        text.className = 'ticker-text';
        const sep = document.createElement('span');
        sep.className = 'ticker-sep';
        sep.textContent = '//';
        wrap.append(label, text, sep);
        slots.push({ entry, label, text, wrap });
        return wrap;
    }

    function refresh() {
        slots.forEach(({ entry, label, text, wrap }) => {
            const pair = entry.live ? live[entry.live]?.() : [entry.label, pick(entry.text)];
            const visible = !!(pair && pair[1]);
            wrap.hidden = !visible;
            if (visible) {
                label.textContent = pair[0];
                text.textContent = pair[1];
            }
        });
    }

    for (let copy = 0; copy < 2; copy++) {
        const run = document.createElement('span');
        run.className = 'ticker-run';
        (C.ticker || []).forEach(entry => run.appendChild(item(entry)));
        track.appendChild(run);
    }

    // Snap the band onto the background dot grid (main.js: rows every 28 px, the first at 14 px)
    // so that a row of dots runs exactly through its middle: the row just above its CSS position,
    // kept between the header and the section titles (which start at the panels' top padding).
    // If no row fits, the band keeps its CSS position.
    const GRID = 28;
    const FIRST_ROW = GRID / 2;
    const HEADER_BOTTOM = 82;
    const TITLE_GAP = 8;

    function align() {
        ticker.style.top = '';
        const r = ticker.getBoundingClientRect();
        if (!r.height) return;
        const titles = parseFloat(getComputedStyle(document.querySelector('.panel:not(.panel--hero)')).paddingTop);
        const half = r.height / 2;
        let row = FIRST_ROW + GRID * Math.floor((r.top + half - FIRST_ROW) / GRID);
        if (row - half < HEADER_BOTTOM) row += GRID;
        if (row - half >= HEADER_BOTTOM && row + half <= titles - TITLE_GAP) ticker.style.top = `${row - half}px`;
    }

    // Constant speed whatever the content length: ~40 px per second
    function setSpeed() {
        const runWidth = track.firstElementChild.getBoundingClientRect().width;
        track.style.setProperty('--ticker-duration', `${Math.max(20, runWidth / 40)}s`);
    }

    refresh();
    align();
    requestAnimationFrame(setSpeed);
    window.addEventListener('resize', () => { align(); setSpeed(); });
    document.addEventListener('langchange', () => { refresh(); setSpeed(); });
    setInterval(refresh, 20000);
})();
