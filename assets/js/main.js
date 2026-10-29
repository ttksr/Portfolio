// Main JavaScript

const root = document.documentElement;
const body = document.body;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// Mouse position shared by the cursor and the background grid
const mouse = { x: -9999, y: -9999 };

// --- Theme ---

const themeToggle = document.getElementById('theme-toggle');

function setTheme(theme) {
    root.dataset.theme = theme;
    try { localStorage.setItem('theme', theme); } catch (e) { }
    grid.refreshColors();
    sessionLog.log(`theme → ${theme}`);
}

themeToggle.addEventListener('click', () => setTheme(root.dataset.theme === 'light' ? 'dark' : 'light'));

// --- Language ---

document.getElementById('lang-toggle').addEventListener('click', () => {
    const next = window.i18n.lang === 'fr' ? 'en' : 'fr';
    window.i18n.setLang(next);
    sessionLog.log(`lang → ${next}`);
});

// Scrambled titles keep their final text (and their screen-reader label) in sync with the language
document.addEventListener('langchange', () => {
    document.querySelectorAll('[data-scramble]').forEach(el => {
        el.dataset.text = el.textContent.trim();
        if (el.nextElementSibling?.classList.contains('sr-only')) el.nextElementSibling.textContent = el.dataset.text;
    });
    setMenu(body.classList.contains('menu-open'));
});

// The terminal overlay owns the keyboard and the wheel while it's open
const terminalOpen = () => body.classList.contains('term-active');

// --- Mobile menu ---

const menuToggle = document.getElementById('menu-toggle');

function setMenu(open) {
    body.classList.toggle('menu-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', window.i18n.t(open ? 'aria.menuClose' : 'aria.menu'));
}

menuToggle.addEventListener('click', () => setMenu(!body.classList.contains('menu-open')));

// --- Text scramble ("decrypt" effect) ---

const GLYPHS = '0123456789abcdef#%&*+=<>/\\';

function scramble(el) {
    const finalText = el.dataset.text;
    if (el.dataset.scrambling) return;
    if (reducedMotion) {
        el.textContent = finalText;
        return;
    }

    const duration = 700 + finalText.length * 25;
    const start = performance.now();
    el.dataset.scrambling = '1';

    // Each character resolves at a random moment, biased left-to-right
    const resolveAt = [...finalText].map((_, i) => (i / finalText.length) * 0.6 + Math.random() * 0.4);

    // Built with DOM nodes, never with an HTML string: the page enforces Trusted Types,
    // so innerHTML is off-limits by design.
    function frame(now) {
        const t = Math.min((now - start) / duration, 1);
        const nodes = [];
        let plain = '';
        for (let i = 0; i < finalText.length; i++) {
            const ch = finalText[i];
            if (ch === ' ' || t >= resolveAt[i]) {
                plain += ch;
            } else {
                if (plain) { nodes.push(document.createTextNode(plain)); plain = ''; }
                const glyph = document.createElement('span');
                glyph.className = 'glyph';
                glyph.textContent = GLYPHS[(Math.random() * GLYPHS.length) | 0];
                nodes.push(glyph);
            }
        }
        if (plain) nodes.push(document.createTextNode(plain));
        el.replaceChildren(...nodes);
        if (t < 1) requestAnimationFrame(frame);
        else delete el.dataset.scrambling;
    }

    requestAnimationFrame(frame);
}

document.querySelectorAll('[data-scramble]').forEach(el => {
    el.dataset.text = el.textContent.trim();
    // Screen readers get the clean text, not the animated glyphs
    const label = document.createElement('span');
    label.className = 'sr-only';
    label.textContent = el.dataset.text;
    el.after(label);
    el.setAttribute('aria-hidden', 'true');
});

// --- Panels ---

const panels = [...document.querySelectorAll('.panel')];
const ids = panels.map(p => p.id);
const navLinks = [...document.querySelectorAll('.nav-link')];
const pagerTicks = [...document.querySelectorAll('.pager-tick')];
const pagerCurrent = document.getElementById('pager-current');
const progress = document.querySelector('.panel-progress');
let current = 0;

// Stagger the reveal of each panel's blocks, and the redaction bars inside them
panels.forEach(panel => {
    panel.querySelectorAll('.reveal').forEach((el, i) => {
        el.style.setProperty('--delay', `${0.25 + i * 0.08}s`);
    });
    panel.querySelectorAll('.redact').forEach((mark, i) => {
        mark.style.setProperty('--d', `${0.9 + i * 0.18}s`);
    });
});

function revealPanel(panel) {
    panel.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
    panel.querySelectorAll('[data-scramble]').forEach(el => setTimeout(() => scramble(el), 250));
}

const pathOf = index => (ids[index] === 'top' ? '/' : '/' + ids[index]);

function updateIndicators(index) {
    const id = ids[index];
    body.dataset.panel = id;
    navLinks.forEach(link => {
        const active = link.hash === '#' + id;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
    });
    pagerTicks.forEach((tick, i) => tick.classList.toggle('active', i === index));
    pagerCurrent.textContent = String(index).padStart(2, '0');
    progress.style.transform = `scaleX(${index / (panels.length - 1)})`;
}

function goTo(index, { push = true, focus = false } = {}) {
    index = Math.max(0, Math.min(panels.length - 1, index));
    setMenu(false);
    if (index === current) return;

    const from = panels[current];
    const to = panels[index];
    const dir = index > current ? 1 : -1;

    // Outgoing panel drifts away in the travel direction
    from.style.setProperty('--y', `${-dir * 30}px`);
    from.classList.remove('active');

    // Incoming panel starts on the opposite side, without animating there
    to.classList.add('no-transition');
    to.style.setProperty('--y', `${dir * 30}px`);
    to.querySelectorAll('.reveal').forEach(el => el.classList.remove('in'));
    to.scrollTop = 0;
    void to.offsetWidth;
    to.classList.remove('no-transition');
    to.classList.add('active');
    revealPanel(to);

    // Reset the old panel once it's gone so it replays next time
    setTimeout(() => {
        if (!from.classList.contains('active')) {
            from.querySelectorAll('.reveal').forEach(el => el.classList.remove('in'));
        }
    }, 800);

    current = index;
    updateIndicators(index);
    dial.turn(dir);
    sessionLog.log(`GET ${pathOf(index)}`, 'nav');

    if (push) history.pushState(null, '', index === 0 ? location.pathname : '#' + ids[index]);
    document.dispatchEvent(new CustomEvent('panelchange', { detail: { id: ids[index] } }));

    // Keyboard users land on the new section's title (mouse users keep their focus where it was)
    if (focus) {
        const heading = to.querySelector('h1, h2');
        if (heading) {
            heading.setAttribute('tabindex', '-1');
            heading.focus({ preventScroll: true });
        }
    }
}

// Every in-page link (nav, logo, buttons, pager) switches panels instead of jumping
document.querySelectorAll('[data-panel-link]').forEach(link => {
    link.addEventListener('click', (e) => {
        const index = ids.indexOf(link.hash.slice(1));
        if (index === -1) return;
        e.preventDefault();
        // detail === 0: activated from the keyboard (Enter), not a pointer
        goTo(index, { focus: e.detail === 0 });
    });
});

window.addEventListener('popstate', () => {
    goTo(Math.max(0, ids.indexOf(location.hash.slice(1))), { push: false });
});

// Keyboard: arrows / page keys / digits
document.addEventListener('keydown', (e) => {
    if (terminalOpen()) return;
    if (e.key === 'Escape') return setMenu(false);
    if (e.altKey || e.ctrlKey || e.metaKey) return;

    const next = ['ArrowRight', 'ArrowDown', 'PageDown'];
    const prev = ['ArrowLeft', 'ArrowUp', 'PageUp'];

    if (next.includes(e.key)) { e.preventDefault(); goTo(current + 1, { focus: true }); }
    else if (prev.includes(e.key)) { e.preventDefault(); goTo(current - 1, { focus: true }); }
    else if (e.key === 'Home') goTo(0, { focus: true });
    else if (e.key === 'End') goTo(panels.length - 1, { focus: true });
    else if (/^[0-9]$/.test(e.key) && Number(e.key) < panels.length) goTo(Number(e.key), { focus: true });
});

// Touch: swipe between panels. Horizontal swipes always work (the projects strip and the orbit
// view keep theirs); vertical ones only once the panel can't scroll further in that direction.
let touchStart = null;

document.addEventListener('touchstart', (e) => {
    if (body.classList.contains('menu-open') || terminalOpen()) return;
    const panel = panels[current];
    touchStart = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        horizontalOk: !e.target.closest('.project-grid, .orbit-view, .filters'),
        verticalOk: !e.target.closest('.orbit-view'),
        atTop: panel.scrollTop <= 0,
        atBottom: panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 1
    };
}, { passive: true });

document.addEventListener('touchend', (e) => {
    if (!touchStart) return;
    const { x, y, horizontalOk, verticalOk, atTop, atBottom } = touchStart;
    const dx = e.changedTouches[0].clientX - x;
    const dy = e.changedTouches[0].clientY - y;
    touchStart = null;
    if (horizontalOk && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        goTo(current + (dx < 0 ? 1 : -1));
    } else if (verticalOk && Math.abs(dy) > 80 && Math.abs(dy) > Math.abs(dx) * 1.5) {
        if (dy < 0 && atBottom) goTo(current + 1);
        if (dy > 0 && atTop) goTo(current - 1);
    }
}, { passive: true });

// Wheel / trackpad: one gesture = one panel. The lock holds until the gesture's
// inertia has died out, so a single flick never skips two panels.
const WHEEL_THRESHOLD = 40;
const WHEEL_MIN_LOCK = 900;
const WHEEL_IDLE = 180;
let wheelDelta = 0;
let wheelLockedAt = 0;
let lastWheel = 0;

window.addEventListener('wheel', (e) => {
    if (terminalOpen() || body.classList.contains('menu-open') || e.ctrlKey) return;

    const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : 0;
    const now = performance.now();
    const panel = panels[current];

    // Let a panel that overflows (very small screens) scroll natively first
    const canScroll = delta > 0
        ? panel.scrollTop + panel.clientHeight < panel.scrollHeight - 1
        : panel.scrollTop > 0;
    if (delta && canScroll) return;

    e.preventDefault();

    if (wheelLockedAt && (now - wheelLockedAt < WHEEL_MIN_LOCK || now - lastWheel < WHEEL_IDLE)) {
        lastWheel = now;
        return;
    }
    wheelLockedAt = 0;
    if (now - lastWheel > 300) wheelDelta = 0;
    lastWheel = now;

    wheelDelta += delta;
    if (Math.abs(wheelDelta) < WHEEL_THRESHOLD) return;

    goTo(current + (wheelDelta > 0 ? 1 : -1));
    wheelDelta = 0;
    wheelLockedAt = now;
}, { passive: false });

// --- Project cards: real SHA-256 fingerprint of each title + cursor light ---

async function fingerprint(text) {
    if (!window.crypto || !crypto.subtle) return null;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].slice(0, 4).map(b => b.toString(16).padStart(2, '0')).join('');
}

document.querySelectorAll('.project-card').forEach(card => {
    const hashEl = card.querySelector('.card-hash');
    fingerprint(card.querySelector('h3').textContent).then(hash => {
        if (!hash) return;
        hashEl.textContent = `sha256:${hash}`;
        hashEl.dataset.text = hashEl.textContent;
    });

    const file = card.querySelector('h3').textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.md';
    card.addEventListener('mouseenter', () => {
        if (hashEl.dataset.text) scramble(hashEl);
        sessionLog.log(`inspect ${file}`);
    });
    card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - r.left}px`);
        card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
});

// --- Copy email ---

const emailCopy = document.getElementById('email-copy');
const emailHint = emailCopy.querySelector('.email-copy-hint');

emailCopy.addEventListener('click', async () => {
    const email = emailCopy.dataset.email;
    try {
        await navigator.clipboard.writeText(email);
        emailCopy.classList.add('copied');
        sessionLog.log('email → clipboard');
        emailHint.textContent = window.i18n.t('contact.copied');
        setTimeout(() => {
            emailCopy.classList.remove('copied');
            emailHint.textContent = window.i18n.t('contact.copy');
        }, 2000);
    } catch (e) {
        window.location.href = `mailto:${email}`;
    }
});

// --- Session id ---

const sessionBytes = crypto.getRandomValues(new Uint8Array(4));
document.getElementById('session-id').textContent =
    [...sessionBytes].map(b => b.toString(16).padStart(2, '0')).join('');

// --- Session log ---

const sessionLog = (() => {
    const panel = document.getElementById('session-log');
    const list = document.getElementById('session-log-list');
    const entries = [];
    const MAX_VISIBLE = 14;
    const KEEPALIVE = 30000;
    let last = { text: '', at: 0 };
    let lastActivity = performance.now();

    const stamp = () => new Date().toLocaleTimeString('en-GB', { hour12: false });

    function log(text, kind = '') {
        const now = performance.now();
        // Don't spam the same line (e.g. hovering back and forth on a card)
        if (text === last.text && now - last.at < 2500) return;
        last = { text, at: now };
        lastActivity = now;

        const entry = { time: stamp(), text };
        entries.push(entry);
        if (entries.length > 200) entries.shift();

        const li = document.createElement('li');
        li.className = 'log-entry' + (kind ? ` log-entry--${kind}` : '');
        const time = document.createElement('span');
        time.className = 'log-time';
        time.textContent = entry.time;
        const msg = document.createElement('span');
        msg.className = 'log-msg';
        msg.textContent = text;
        msg.dataset.text = text;
        li.append(time, msg);
        list.appendChild(li);

        while (list.children.length > MAX_VISIBLE) list.firstElementChild.remove();
        list.classList.toggle('is-full', list.firstElementChild.offsetTop < 0);
        if (panel.offsetParent) scramble(msg);
    }

    // A quiet heartbeat so the log keeps breathing when nothing happens
    setInterval(() => {
        if (!document.hidden && performance.now() - lastActivity > KEEPALIVE) log('keepalive ok', 'dim');
    }, 5000);

    document.addEventListener('visibilitychange', () => {
        log(document.hidden ? 'session idle' : 'session resumed', 'dim');
    });

    // Outbound links: socials, contact buttons, mail
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[target="_blank"], a[href^="mailto:"]');
        if (!link) return;
        const label = link.href.startsWith('mailto:') ? 'mail' : (link.getAttribute('aria-label') || link.textContent);
        log(`open ${label.trim().toLowerCase()}`);
    });

    return { log, entries };
})();

sessionLog.log(`session ${document.getElementById('session-id').textContent} opened`, 'dim');

// --- Vault dial ---

const dial = (() => {
    const el = document.querySelector('.dial');
    const ticks = el.querySelector('.dial-ticks');
    const NS = 'http://www.w3.org/2000/svg';

    for (let i = 0; i < 60; i++) {
        const major = i % 5 === 0;
        const line = document.createElementNS(NS, 'line');
        line.setAttribute('x1', 200);
        line.setAttribute('x2', 200);
        line.setAttribute('y1', 10);
        line.setAttribute('y2', major ? 26 : 18);
        line.setAttribute('transform', `rotate(${i * 6} 200 200)`);
        if (major) line.classList.add('major');
        ticks.appendChild(line);
    }

    // Each ring eases toward a target; the inner one "enters a combination" every few seconds
    const rings = {
        outer: { el: el.querySelector('.dial-ring--outer'), angle: 0, target: 0, drift: 0.03 },
        mid: { el: el.querySelector('.dial-ring--mid'), angle: 0, target: 0, drift: -0.06 },
        inner: { el: el.querySelector('.dial-ring--inner'), angle: 0, target: 0, drift: 0 }
    };
    let lastStep = 0;
    const STEP = 2600;

    const rotate = (ring) => ring.el.setAttribute('transform', `rotate(${ring.angle} 200 200)`);

    requestAnimationFrame(() => el.classList.add('ready'));

    return {
        // A panel change spins the whole lock, like dialing a new number
        turn(dir) {
            rings.outer.target += dir * 72;
            rings.mid.target -= dir * 108;
            rings.inner.target += dir * 144;
            lastStep = performance.now();
        },
        update(now) {
            if (now - lastStep > STEP) {
                lastStep = now;
                const dir = Math.random() > 0.5 ? 1 : -1;
                rings.inner.target += dir * (36 + Math.round(Math.random() * 10) * 12);
            }
            Object.values(rings).forEach(ring => {
                ring.target += ring.drift;
                ring.angle += (ring.target - ring.angle) * 0.05;
                rotate(ring);
            });
        }
    };
})();

// --- Background dot grid ---

const grid = (() => {
    const canvas = document.querySelector('.bg-grid');
    const ctx = canvas.getContext('2d');
    const GAP = 28;
    const RADIUS = 170;
    let w = 0, h = 0, dpr = 1;
    let base = '255, 255, 255';
    let active = '127, 209, 193';
    let packets = [];

    function refreshColors() {
        const styles = getComputedStyle(root);
        base = styles.getPropertyValue('--grid-dot').trim();
        active = styles.getPropertyValue('--grid-dot-active').trim();
        if (reducedMotion) draw();
    }

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        w = window.innerWidth;
        h = window.innerHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (reducedMotion) draw();
    }

    // Occasional packets travelling along a grid line
    function spawnPacket() {
        const horizontal = Math.random() > 0.5;
        const lane = horizontal
            ? Math.floor(Math.random() * (h / GAP)) * GAP + GAP / 2
            : Math.floor(Math.random() * (w / GAP)) * GAP + GAP / 2;
        packets.push({
            horizontal,
            lane,
            pos: -40,
            speed: 1.2 + Math.random() * 1.6,
            length: 40 + Math.random() * 80,
            limit: horizontal ? w : h
        });
    }

    function draw() {
        ctx.clearRect(0, 0, w, h);
        const offset = GAP / 2;

        for (let x = offset; x < w; x += GAP) {
            for (let y = offset; y < h; y += GAP) {
                const dx = x - mouse.x;
                const dy = y - mouse.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < RADIUS) {
                    const k = 1 - d / RADIUS;
                    ctx.fillStyle = `rgba(${active}, ${0.08 + k * 0.5})`;
                    ctx.fillRect(x - 0.75, y - 0.75, 1.5 + k, 1.5 + k);
                } else {
                    ctx.fillStyle = `rgba(${base}, 0.1)`;
                    ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
                }
            }
        }

        if (reducedMotion) return;

        if (packets.length < 3 && Math.random() < 0.012) spawnPacket();

        packets = packets.filter(p => p.pos - p.length < p.limit);
        packets.forEach(p => {
            p.pos += p.speed;
            const grad = p.horizontal
                ? ctx.createLinearGradient(p.pos - p.length, 0, p.pos, 0)
                : ctx.createLinearGradient(0, p.pos - p.length, 0, p.pos);
            grad.addColorStop(0, `rgba(${active}, 0)`);
            grad.addColorStop(1, `rgba(${active}, 0.35)`);
            ctx.fillStyle = grad;
            if (p.horizontal) ctx.fillRect(p.pos - p.length, p.lane - 0.5, p.length, 1);
            else ctx.fillRect(p.lane - 0.5, p.pos - p.length, 1, p.length);
        });
    }

    window.addEventListener('resize', resize);
    resize();
    refreshColors();

    return { draw, refreshColors };
})();

// --- Custom cursor ---

const cursorDot = document.querySelector('.cursor-dot');
const cursorRing = document.querySelector('.cursor-ring');
const ring = { x: 0, y: 0 };
const useCursor = finePointer && !reducedMotion;

if (useCursor) body.classList.add('has-cursor');

document.addEventListener('mousemove', (e) => {
    if (mouse.x === -9999) { ring.x = e.clientX; ring.y = e.clientY; }
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    body.classList.add('cursor-active');
    if (reducedMotion) grid.draw();
}, { passive: true });

document.addEventListener('mouseleave', () => {
    body.classList.remove('cursor-active');
    mouse.x = mouse.y = -9999;
});

document.addEventListener('mouseover', (e) => {
    body.classList.toggle('hovering', !!e.target.closest('a, button, .project-card'));
});

// --- Main loop (paused when the tab is hidden) ---

function loop(now) {
    if (!document.hidden) {
        grid.draw();
        dial.update(now);

        if (useCursor) {
            ring.x += (mouse.x - ring.x) * 0.18;
            ring.y += (mouse.y - ring.y) * 0.18;
            cursorDot.style.transform = `translate(${mouse.x}px, ${mouse.y}px)`;
            cursorRing.style.transform = `translate(${ring.x}px, ${ring.y}px)`;
        }
    }
    requestAnimationFrame(loop);
}

if (reducedMotion) {
    dial.update(0);
} else {
    requestAnimationFrame(loop);
}

// --- Initial panel (supports deep links like #projects) ---

const startIndex = Math.max(0, ids.indexOf(location.hash.slice(1)));
panels.forEach((p, i) => p.classList.toggle('active', i === startIndex));
current = startIndex;
updateIndicators(startIndex);
if (startIndex === 0) {
    // The hero's entrance already runs in CSS (see heroIn): hand over once it has finished
    setTimeout(() => {
        panels[0].querySelectorAll('.reveal').forEach(el => {
            el.style.transitionDelay = '0s';
            el.classList.add('in');
            setTimeout(() => { el.style.transitionDelay = ''; }, 50);
        });
        panels[0].querySelectorAll('[data-scramble]').forEach(scramble);
    }, 1200);
    panels[0].querySelectorAll('[data-scramble]').forEach(el => setTimeout(() => scramble(el), 250));
} else {
    requestAnimationFrame(() => revealPanel(panels[startIndex]));
}
sessionLog.log(`GET ${pathOf(startIndex)}`, 'nav');

// Shared with terminal.js
window.site = {
    goTo,
    ids,
    setTheme,
    getTheme: () => root.dataset.theme || 'dark',
    log: sessionLog.log,
    logEntries: sessionLog.entries
};
