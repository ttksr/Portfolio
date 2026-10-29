// HD 110067 — live, interactive orbital view
// Positions come from the published linear ephemerides (Luque et al. 2023, Nature 623, Table 1 and
// Extended Data Table 3): each planet's angle is its phase since a measured mid-transit, so "now" on
// screen is now in the sky (to within the system's transit-timing variations, a few hours at most).

(() => {
    const body = document.body;
    const root = document.documentElement;
    const canvas = document.getElementById('orbit-canvas');
    const view = canvas.parentElement;
    const out = canvas.getContext('2d');
    const sysLayer = document.createElement('canvas');
    const ctx = sysLayer.getContext('2d');
    const swap = document.getElementById('system-swap');
    const tbody = document.getElementById('planet-rows');
    const simDate = document.getElementById('sim-date');
    const simBjd = document.getElementById('sim-bjd');
    const simOffset = document.getElementById('sim-offset');
    const speedButtons = [...document.querySelectorAll('[data-rate]')];

    const card = {
        el: document.getElementById('body-card'),
        title: document.getElementById('body-card-title'),
        sub: document.getElementById('body-card-sub'),
        stats: document.getElementById('body-card-stats'),
        curve: document.getElementById('light-curve'),
        lcCanvas: document.getElementById('lc-canvas'),
        lcLabel: document.getElementById('lc-label'),
        lcNext: document.getElementById('lc-next'),
        jump: document.getElementById('jump-transit'),
        close: document.getElementById('body-card-close')
    };

    // P (d), t0 (TJD = BJD_TDB - 2457000), Rp (R⊕), Rp/R⋆, a (au), Teq (K), transit duration (d),
    // inclination (deg), mass (M⊕; "<" = 99.7% upper limit)
    const PLANETS = [
        { id: 'b', P: 9.113678, t0: 2640.15797, R: 2.200, k: 0.0256, a: 0.0793, Teq: 800, tT: 0.12895, inc: 89.061, M: '5.69' },
        { id: 'c', P: 13.673694, t0: 2657.45704, R: 2.388, k: 0.0278, a: 0.1039, Teq: 699, tT: 0.15435, inc: 89.687, M: '< 6.3' },
        { id: 'd', P: 20.519617, t0: 2708.20282, R: 2.852, k: 0.0332, a: 0.1362, Teq: 602, tT: 0.15907, inc: 89.248, M: '8.52' },
        { id: 'e', P: 30.793091, t0: 2646.0919, R: 1.940, k: 0.0226, a: 0.1785, Teq: 533, tT: 0.20265, inc: 89.867, M: '< 3.9' },
        { id: 'f', P: 41.05854, t0: 2641.5763, R: 2.601, k: 0.03026, a: 0.2163, Teq: 489, tT: 0.2152, inc: 89.673, M: '5.04' },
        { id: 'g', P: 54.76992, t0: 2656.0921, R: 2.607, k: 0.0303, a: 0.2621, Teq: 440, tT: 0.2361, inc: 89.729, M: '< 8.4' }
    ];
    const RATIOS = ['3:2', '3:2', '3:2', '4:3', '4:3']; // between consecutive planets
    const A_MAX = PLANETS[PLANETS.length - 1].a;
    const BODIES = ['star', ...PLANETS.map(p => p.id)];

    // --- Time ---

    // UTC is used as a stand-in for BJD_TDB: the difference (~1–8 min) is far below what's visible
    const toTjd = ms => ms / 86400000 + 2440587.5 - 2457000;
    const fromTjd = tjd => (tjd + 2457000 - 2440587.5) * 86400000;

    let rate = 1;           // simulated ms per real ms; 1 = live, 0 = paused
    let simMs = Date.now();
    let lastFrame = performance.now();

    function phaseInfo(p, tjd) {
        const orbits = (tjd - p.t0) / p.P;
        const nearest = p.t0 + Math.round(orbits) * p.P;
        return {
            // Transit = planet between the star and us; "us" is straight down on screen
            angle: Math.PI / 2 + 2 * Math.PI * orbits,
            fromNearest: tjd - nearest,
            transiting: Math.abs(tjd - nearest) < p.tT / 2,
            next: p.t0 + Math.ceil(orbits) * p.P
        };
    }

    const pad = n => String(n).padStart(2, '0');

    function formatSpan(days, { seconds = true } = {}) {
        const s = Math.max(0, Math.floor(Math.abs(days) * 86400));
        const d = Math.floor(s / 86400);
        const hms = `${pad(Math.floor(s / 3600) % 24)}h ${pad(Math.floor(s / 60) % 60)}m`;
        return `${d}d ${hms}` + (seconds ? ` ${pad(s % 60)}s` : '');
    }

    function setRate(next, label) {
        rate = next;
        if (rate === 1) simMs = Date.now();
        speedButtons.forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.rate) === rate)));
        if (label) window.site.log(`orbit clock → ${label}`);
    }

    speedButtons.forEach(btn => btn.addEventListener('click', () => setRate(Number(btn.dataset.rate), btn.textContent.trim())));

    // --- Selection ---

    let selected = null;   // 'star' | planet id | null
    let hovered = null;

    const planetById = id => PLANETS.find(p => p.id === id);

    const rows = PLANETS.map(p => {
        const tr = document.createElement('tr');
        tr.dataset.planet = p.id;
        tr.innerHTML = `
            <td><button type="button" class="planet-pick">${p.id}</button></td>
            <td>${p.P.toFixed(3)}</td>
            <td>${p.R.toFixed(2)}</td>
            <td class="col-teq">${p.Teq}</td>
            <td class="planet-next"></td>`;
        tr.addEventListener('click', () => select(p.id));
        tr.addEventListener('mouseenter', () => { hovered = p.id; });
        tr.addEventListener('mouseleave', () => { hovered = null; });
        tbody.appendChild(tr);
        return { p, tr, next: tr.querySelector('.planet-next') };
    });

    function stat(label, value) {
        const dt = document.createElement('dt');
        dt.textContent = label;
        const dd = document.createElement('dd');
        dd.textContent = value;
        card.stats.append(dt, dd);
    }

    function fillCard(id) {
        card.stats.textContent = '';
        if (id === 'star') {
            card.title.textContent = 'HD 110067';
            card.sub.textContent = 'K0 V main-sequence star · Coma Berenices';
            stat('temperature', '5266 ± 64 K');
            stat('mass', '0.798 M☉');
            stat('radius', '0.788 R☉');
            stat('age', '8.1 ± 4.0 Gyr');
            stat('metallicity', '[Fe/H] −0.20');
            stat('distance', '32.22 pc · 105 ly');
            stat('brightness', 'V 8.42 · binoculars');
            stat('position', '12h39m21s +20°01′40″');
            card.curve.hidden = true;
            card.jump.hidden = true;
            return;
        }

        const i = PLANETS.findIndex(p => p.id === id);
        const p = PLANETS[i];
        const links = [];
        if (i > 0) links.push(`${RATIOS[i - 1]} with ${PLANETS[i - 1].id}`);
        if (i < PLANETS.length - 1) links.push(`${RATIOS[i]} with ${PLANETS[i + 1].id}`);

        card.title.textContent = `HD 110067 ${p.id}`;
        card.sub.textContent = `sub-Neptune · ${links.join(' · ')}`;
        stat('period', `${p.P} d`);
        stat('orbit', `${p.a} au`);
        stat('radius', `${p.R.toFixed(3)} R⊕`);
        stat('mass', p.M.startsWith('<') ? `${p.M} M⊕ (limit)` : `${p.M} M⊕`);
        stat('temperature', `${p.Teq} K`);
        stat('inclination', `${p.inc}°`);
        stat('transit', `${formatSpan(p.tT, { seconds: false }).replace(/^0d /, '')} long`);
        stat('depth', `${Math.round(p.k * p.k * 1e6)} ppm`);
        card.curve.hidden = false;
        card.jump.hidden = false;
        card.lcLabel.textContent = 'transit light curve';
    }

    function select(id) {
        if (id === selected) id = null;
        selected = id;
        rows.forEach(r => r.tr.classList.toggle('selected', r.p.id === selected));
        swap.classList.toggle('is-detail', !!selected);
        view.classList.toggle('is-body', !!selected);
        const now = performance.now();
        const progress = zoomProgress(now);
        if (selected) {
            if (view3d.shown && view3d.shown !== selected && progress > 0.5) {
                snapshot.width = canvas.width;
                snapshot.height = canvas.height;
                snapshot.getContext('2d').drawImage(canvas, 0, 0);
                view3d.swap = { start: performance.now() };
                card.el.animate(
                    [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
                    { duration: 380, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
                );
            }
            view3d.shown = selected;
            // Shade the new body (and its Earth) once, off screen, before the animation clock starts:
            // the cost lands on the click, not on the first frames of the zoom
            drawBodyView(primeCtx, toTjd(simMs), now);
        }
        const target = selected ? 1 : 0;
        if (target !== view3d.tween.to) {
            view3d.tween = { from: progress, to: target, start: performance.now(), dur: target ? 750 : 600 };
        }
        if (selected) {
            fillCard(selected);
            window.site.log(`inspect HD 110067${selected === 'star' ? '' : ' ' + selected}`);
        }
    }

    document.querySelectorAll('.body-card-step').forEach(btn => btn.addEventListener('click', () => {
        const i = BODIES.indexOf(selected);
        const next = BODIES[(i + Number(btn.dataset.step) + BODIES.length) % BODIES.length];
        select(next);
    }));

    card.close.addEventListener('click', () => select(null));
    document.getElementById('orbit-back').addEventListener('click', () => select(null));

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && selected && body.dataset.panel === 'lab' && !body.classList.contains('term-active')) {
            select(null);
        }
    });

    // Jump to just before the next ingress, at a speed where the crossing takes a few seconds
    card.jump.addEventListener('click', () => {
        const p = planetById(selected);
        if (!p) return;
        simMs = fromTjd(phaseInfo(p, toTjd(simMs)).next - p.tT * 0.9);
        setRate(3600, null);
        window.site.log(`jump → transit of ${p.id}`);
    });

    // --- Colors (follow the theme) ---

    let colors = {};

    function refreshColors() {
        const css = getComputedStyle(root);
        const v = name => css.getPropertyValue(name).trim();
        colors = {
            text: v('--color-text'),
            muted: v('--color-text-muted'),
            faint: v('--color-text-faint'),
            line: v('--color-line'),
            lineStrong: v('--color-line-strong'),
            accent: v('--color-accent'),
            accentSoft: v('--color-accent-soft'),
            star: v('--color-star')
        };
    }

    new MutationObserver(refreshColors).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    refreshColors();

    // --- Orbit canvas ---

    let size = 0;
    let dpr = 1;

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        size = view.clientWidth;
        canvas.width = sysLayer.width = size * dpr;
        canvas.height = sysLayer.height = size * dpr;
        const w = card.lcCanvas.clientWidth;
        card.lcCanvas.width = w * dpr;
        card.lcCanvas.height = card.lcCanvas.clientHeight * dpr;
    }

    new ResizeObserver(() => { resize(); warmGeometries(); }).observe(view);
    new ResizeObserver(resize).observe(card.lcCanvas);

    let geometry = { c: 0, k: 1, ring: 0, scale: 1 };
    let positions = [];

    // --- Close-up models (artist's impressions) ---
    // Each body is rendered per pixel on a small sphere buffer: orthographic projection, procedural
    // surface, lit from the star's real direction (so the terminator follows the orbit).

    // Seeded value noise, wrapping in both directions
    function makeNoise(seed) {
        let t = seed * 2654435761 >>> 0;
        const rnd = () => {
            t = (t + 0x6D2B79F5) >>> 0;
            let r = Math.imul(t ^ (t >>> 15), 1 | t);
            r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
            return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
        };
        const W = 96, H = 48;
        const grid = new Float32Array(W * H).map(() => rnd());
        const sample = (u, v) => {
            const x = (((u % 1) + 1) % 1) * W;
            const y = (((v % 1) + 1) % 1) * H;
            const x0 = Math.floor(x) % W, y0 = Math.floor(y) % H;
            const fx = x - Math.floor(x), fy = y - Math.floor(y);
            const x1 = (x0 + 1) % W, y1 = (y0 + 1) % H;
            const a = grid[y0 * W + x0], b = grid[y0 * W + x1];
            const c = grid[y1 * W + x0], d = grid[y1 * W + x1];
            const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
            return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
        };
        return (u, v) => 0.65 * sample(u, v) + 0.35 * sample(u * 2, v * 2);
    }

    const mix = (a, b, t) => a + (b - a) * t;
    const clamp01 = x => Math.max(0, Math.min(1, x));

    // Earth's land, as coarse continent outlines [lon, lat], rasterised once into an equirectangular mask
    const earthMask = (() => {
        const W = 360, H = 180;
        const shapes = [
            // North America
            [[-168, 65], [-156, 71], [-140, 70], [-128, 70], [-110, 73], [-95, 72], [-85, 69], [-80, 63], [-90, 58], [-82, 52], [-78, 57], [-70, 60], [-62, 58], [-56, 52], [-66, 45], [-70, 42], [-76, 38], [-76, 35], [-81, 31], [-80, 25], [-82, 27], [-84, 30], [-90, 30], [-97, 27], [-97, 22], [-92, 18], [-87, 21], [-88, 16], [-83, 10], [-79, 8], [-86, 12], [-92, 14], [-105, 20], [-110, 23], [-117, 32], [-121, 35], [-124, 40], [-124, 46], [-125, 49], [-132, 54], [-138, 59], [-146, 61], [-152, 59], [-158, 57], [-162, 59], [-165, 62]],
            // Canadian Arctic islands
            [[-120, 75], [-100, 79], [-80, 82], [-68, 81], [-80, 74], [-100, 71], [-120, 71]],
            // Greenland
            [[-73, 78], [-60, 82], [-35, 83], [-20, 81], [-18, 75], [-22, 70], [-30, 68], [-40, 65], [-44, 60], [-50, 62], [-53, 67], [-56, 72], [-66, 76]],
            // South America
            [[-80, 9], [-75, 11], [-70, 12], [-62, 10], [-55, 6], [-50, 1], [-44, -2], [-35, -5], [-35, -9], [-39, -15], [-41, -22], [-48, -26], [-53, -33], [-58, -38], [-62, -40], [-65, -45], [-68, -50], [-70, -54], [-74, -52], [-74, -45], [-72, -35], [-71, -28], [-70, -18], [-76, -14], [-80, -6], [-81, -2], [-78, 2], [-78, 7]],
            // Africa
            [[-17, 21], [-16, 28], [-10, 30], [-6, 36], [3, 37], [10, 37], [11, 33], [20, 31], [25, 32], [32, 31], [34, 28], [38, 22], [43, 12], [51, 12], [48, 5], [40, -3], [40, -10], [38, -18], [35, -24], [32, -29], [27, -34], [20, -35], [18, -32], [15, -26], [12, -17], [13, -8], [9, -1], [9, 4], [5, 6], [-3, 5], [-8, 4], [-13, 8], [-17, 14]],
            // Madagascar
            [[44, -25], [47, -25], [50, -15], [49, -12], [44, -17]],
            // Eurasia
            [[-9, 43], [-9, 37], [-5, 36], [0, 39], [3, 42], [8, 44], [12, 44], [16, 41], [18, 40], [13, 45], [19, 42], [23, 38], [26, 40], [29, 41], [36, 36], [35, 33], [34, 29], [39, 21], [43, 13], [52, 16], [59, 22], [56, 26], [50, 29], [57, 26], [62, 25], [67, 24], [72, 20], [77, 8], [80, 13], [80, 16], [87, 21], [91, 22], [94, 17], [98, 16], [98, 8], [100, 4], [104, 1], [103, 8], [100, 13], [105, 9], [109, 12], [108, 21], [115, 22], [121, 29], [122, 32], [120, 36], [122, 40], [118, 39], [121, 41], [126, 38], [129, 35], [129, 42], [135, 44], [141, 48], [140, 53], [135, 55], [142, 59], [155, 59], [163, 62], [171, 64], [180, 66], [180, 72], [150, 75], [140, 73], [113, 74], [105, 78], [95, 76], [80, 73], [70, 73], [60, 70], [45, 68], [40, 66], [32, 70], [25, 71], [15, 69], [10, 63], [5, 62], [6, 58], [10, 58], [12, 56], [9, 55], [8, 54], [4, 52], [2, 51], [-2, 48], [-5, 48], [-1, 46], [-2, 44]],
            // Great Britain, Ireland, Iceland
            [[-5, 50], [1, 51], [2, 53], [-2, 57], [-5, 58], [-6, 56], [-3, 54], [-5, 52]],
            [[-10, 52], [-6, 52], [-6, 55], [-8, 55]],
            [[-24, 64], [-14, 64], [-14, 66], [-22, 66]],
            // Japan, Borneo, Sumatra, New Guinea
            [[130, 31], [134, 34], [140, 36], [142, 40], [141, 45], [144, 44], [140, 41], [136, 35], [131, 33]],
            [[109, 1], [117, 7], [119, 1], [116, -4], [110, -3]],
            [[95, 5], [98, 4], [106, -6], [103, -5]],
            [[131, -1], [141, -2], [150, -10], [141, -9], [136, -5]],
            // Australia, New Zealand
            [[114, -22], [114, -26], [116, -34], [124, -34], [131, -31], [138, -35], [141, -38], [146, -39], [150, -37], [153, -31], [153, -25], [146, -19], [142, -11], [136, -12], [136, -15], [130, -12], [126, -14], [122, -18]],
            [[167, -46], [172, -41], [174, -41], [178, -38], [173, -35], [171, -44]],
            // Antarctica
            [[-180, -90], [180, -90], [180, -70], [150, -68], [100, -66], [60, -67], [20, -70], [-20, -72], [-60, -64], [-75, -72], [-120, -74], [-160, -78], [-180, -78]]
        ];
        const cv = document.createElement('canvas');
        cv.width = W;
        cv.height = H;
        const c2 = cv.getContext('2d');
        c2.fillStyle = '#fff';
        shapes.forEach(shape => {
            c2.beginPath();
            shape.forEach(([lon, lat], i) => {
                const x = (lon + 180) / 360 * W;
                const y = (90 - lat) / 180 * H;
                if (i) c2.lineTo(x, y); else c2.moveTo(x, y);
            });
            c2.closePath();
            c2.fill();
        });
        const px = c2.getImageData(0, 0, W, H).data;
        const land = new Float32Array(W * H);
        for (let i = 0; i < W * H; i++) land[i] = px[i * 4 + 3] / 255;
        // Bilinear lookup, u in [0,1) from lon -180, v in [0,1] from the north pole
        return (u, v) => {
            const x = (((u % 1) + 1) % 1) * W;
            const y = Math.max(0, Math.min(H - 1.001, v * H - 0.5));
            const x0 = Math.floor(x) % W, y0 = Math.floor(y);
            const x1 = (x0 + 1) % W;
            const fx = x - Math.floor(x), fy = y - y0;
            const a = land[y0 * W + x0], b = land[y0 * W + x1];
            const c = land[(y0 + 1) * W + x0], d = land[(y0 + 1) * W + x1];
            return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
        };
    })();

    const noises = {};
    [...BODIES, 'earth', 'clouds'].forEach((id, i) => { noises[id] = makeNoise(i + 7); });

    // Hazy sub-Neptune palettes, cooler (g, 440 K) to warmer (b, 800 K)
    function palette(p) {
        const t = (p.Teq - 440) / (800 - 440);
        const cool = { base: [138, 172, 188], band: [96, 134, 162], haze: [196, 220, 230] };
        const hot = { base: [214, 180, 142], band: [166, 120, 90], haze: [242, 216, 182] };
        const m = key => cool[key].map((c, i) => mix(c, hot[key][i], t));
        return { base: m('base'), band: m('band'), haze: m('haze'), bands: 5 + (p.R * 3 | 0) % 4 };
    }

    // Shading budget: at most one sphere is re-shaded per frame, and none while a transition runs
    // (except a first render), so zooms and cross-fades only cost a drawImage
    const shading = { frame: 0, usedOn: -1, frozen: false };

    // One sphere renderer = one buffer + its precomputed geometry; the shading is a per-pixel function
    function makeSphere(tilt, maxD) {
        const buf = document.createElement('canvas');
        const bctx = buf.getContext('2d');
        let D = 0, image = null, geo = null;
        let lastRender = 0, lastKey = null;
        const cache = new Map(); // geometry per buffer size (each planet's Earth has its own)

        function geometry(d) {
            if (cache.has(d)) return cache.get(d);
            const D = d;
            const n = D * D;
            const geo = {
                lat: new Float32Array(n), lon: new Float32Array(n),
                nx: new Float32Array(n), ny: new Float32Array(n), nz: new Float32Array(n),
                alpha: new Float32Array(n)
            };
            const cosT = Math.cos(tilt), sinT = Math.sin(tilt);
            for (let j = 0; j < D; j++) {
                for (let i = 0; i < D; i++) {
                    const k = j * D + i;
                    const x = ((i + 0.5) / D) * 2 - 1;
                    const y = ((j + 0.5) / D) * 2 - 1;
                    const r = Math.hypot(x, y);
                    geo.alpha[k] = clamp01((1 - r) * D / 2); // anti-aliased limb
                    if (r >= 1) continue;
                    const z = Math.sqrt(Math.max(0, 1 - r * r));
                    geo.nx[k] = x; geo.ny[k] = y; geo.nz[k] = z;
                    const yb = y * cosT - z * sinT;           // spin axis tilted towards the viewer
                    const zb = y * sinT + z * cosT;
                    geo.lat[k] = Math.asin(Math.max(-1, Math.min(1, -yb)));
                    geo.lon[k] = Math.atan2(x, zb);
                }
            }
            cache.set(d, geo);
            return geo;
        }

        function build(d) {
            D = d;
            buf.width = buf.height = D;
            image = bctx.createImageData(D, D);
            geo = geometry(d);
        }

        const sizeFor = radius => Math.max(48, Math.min(maxD, Math.round(radius * 2 * dpr)));

        return {
            warm(radius) { geometry(sizeFor(radius)); },
            draw(g, key, cx, cy, radius, shade) {
                const d = sizeFor(radius);
                const now = performance.now();
                // Re-shaded at ~30 fps (rotation is slow), drawn every frame
                const mustShade = d !== D || key !== lastKey;
                const mayShade = !shading.frozen && shading.usedOn !== shading.frame && now - lastRender > 33;
                if (mustShade || mayShade) {
                    shading.usedOn = shading.frame;
                    if (d !== D) build(d);
                    const data = image.data;
                    for (let k = 0; k < D * D; k++) {
                        const o = k * 4;
                        if (!geo.alpha[k]) { data[o + 3] = 0; continue; }
                        shade(geo, k, data, o);
                        data[o + 3] = geo.alpha[k] * 255;
                    }
                    bctx.putImageData(image, 0, 0);
                    lastRender = now;
                    lastKey = key;
                }
                g.imageSmoothingEnabled = true;
                g.drawImage(buf, cx - radius, cy - radius, radius * 2, radius * 2);
            }
        };
    }

    const bodySphere = makeSphere(0.32, 300);
    const earthSphere = makeSphere(0.41, 180); // 23.4° obliquity

    function planetShader(p, spin, L) {
        const pal = palette(p);
        const noise = noises[p.id];
        return (geo, k, data, o) => {
            const u = (geo.lon[k] + spin) / (2 * Math.PI);
            const v = geo.lat[k] / Math.PI + 0.5;
            const nse = noise(u, v);
            const band = 0.5 + 0.5 * Math.sin(geo.lat[k] * pal.bands + nse * 3.2);
            const t = band * 0.7 + nse * 0.3;
            // Soft terminator (thick atmosphere), plus a forward-scattering rim on the lit side
            const dot = geo.nx[k] * L[0] + geo.ny[k] * L[1] + geo.nz[k] * L[2];
            const lit = clamp01((dot + 0.12) / 1.12);
            const shade = 0.04 + lit * 0.96;
            const rim = Math.pow(1 - geo.nz[k], 3) * (0.25 + 0.75 * lit);
            for (let c = 0; c < 3; c++) {
                data[o + c] = mix(mix(pal.base[c], pal.band[c], t) * shade, pal.haze[c] * (0.35 + lit), rim * 0.8);
            }
        };
    }

    function starShader(time) {
        const noise = noises.star;
        const base = [255, 208, 160];
        return (geo, k, data, o) => {
            const u = (geo.lon[k] + time) / (2 * Math.PI);
            const v = geo.lat[k] / Math.PI + 0.5;
            // Granulation: fine, slowly churning cells
            const g = noise(u * 5 + time * 0.3, v * 5) * 0.6 + noise(u * 11 - time * 0.2, v * 11) * 0.4;
            // Limb darkening, reddening towards the limb
            const mu = geo.nz[k];
            const I = 1 - 0.62 * (1 - mu) - 0.12 * (1 - mu) * (1 - mu);
            const gran = 0.88 + 0.16 * g;
            data[o] = Math.min(255, base[0] * Math.pow(I, 0.7) * gran);
            data[o + 1] = Math.min(255, base[1] * I * gran);
            data[o + 2] = Math.min(255, base[2] * Math.pow(I, 1.5) * gran);
        };
    }

    // Earth: real continents, latitude-dependent biomes, ice caps, drifting clouds, sun glint on oceans
    function earthShader(spin, cloudSpin, L) {
        const noise = noises.earth;
        const clouds = noises.clouds;
        return (geo, k, data, o) => {
            const lat = geo.lat[k];
            const lonDeg = ((((geo.lon[k] + spin) * 180 / Math.PI + 180) % 360) + 360) % 360 - 180;
            const u = (lonDeg + 180) / 360;
            const v = 0.5 - lat / Math.PI;
            const n = noise(u * 0.5, v * 0.5);
            // Rough up the coastlines a little
            const land = clamp01((earthMask(u + (n - 0.5) * 0.01, v + (n - 0.5) * 0.01) - 0.45) * 6);
            const absLat = Math.abs(lat) * 180 / Math.PI;

            // Biomes: deserts around the subtropics, forests elsewhere, ice at the poles
            const desert = clamp01(1 - Math.abs(absLat - 24) / 14) * clamp01(n * 1.6 - 0.2);
            const ice = clamp01((absLat - 66) / 8) + (absLat > 60 && lonDeg > -75 && lonDeg < -15 ? 0.7 : 0);
            let r = mix(mix(52, 168, desert), 236, clamp01(ice));
            let g = mix(mix(92, 146, desert), 240, clamp01(ice));
            let b = mix(mix(48, 96, desert), 246, clamp01(ice));
            // Oceans, a touch lighter near the coasts
            const coast = clamp01(earthMask(u, v) * 2.5);
            const sea = [mix(16, 34, coast), mix(46, 84, coast), mix(92, 132, coast)];
            const seaIce = clamp01((absLat - 72) / 6);
            r = mix(mix(sea[0], 230, seaIce), r, land);
            g = mix(mix(sea[1], 236, seaIce), g, land);
            b = mix(mix(sea[2], 244, seaIce), b, land);

            // Clouds, on their own slower layer
            const cu = (geo.lon[k] + cloudSpin) / (2 * Math.PI);
            const cv = lat / Math.PI + 0.5;
            // Low frequencies only, stretched along the latitude bands, so they read as weather systems
            // (the noise grid has 96 cells around, so a factor < 1 is what makes features larger than a pixel)
            const cl = 0.85 * clamp01((clouds(cu * 0.35, cv * 0.7) * 0.75 + clouds(cu * 0.8, cv * 1.6) * 0.25 - 0.5) * 2.4);

            const nx = geo.nx[k], ny = geo.ny[k], nz = geo.nz[k];
            const dot = nx * L[0] + ny * L[1] + nz * L[2];
            const lit = clamp01((dot + 0.05) / 1.05);
            // Specular glint on water: reflect L about the normal, compare with the view direction (0,0,1)
            const rz = 2 * dot * nz - L[2];
            const glint = (1 - land) * (1 - cl) * Math.pow(clamp01(rz), 40) * 0.9;
            const rim = Math.pow(1 - nz, 2.5) * (0.2 + 0.8 * lit);

            const shade = 0.03 + lit * 0.97;
            data[o] = Math.min(255, (mix(r, 245, cl) * shade + glint * 255) * (1 - rim * 0.5) + 110 * rim);
            data[o + 1] = Math.min(255, (mix(g, 248, cl) * shade + glint * 255) * (1 - rim * 0.5) + 160 * rim);
            data[o + 2] = Math.min(255, (mix(b, 252, cl) * shade + glint * 255) * (1 - rim * 0.5) + 255 * rim);
        };
    }

    // Close-up composition: model, scale reference, caption
    const view3d = {
        spin: 0,
        shown: null,
        tween: { from: 0, to: 0, start: 0, dur: 1 },
        swap: null // { start } while cross-fading from the previous body (snapshot)
    };
    const snapshot = document.createElement('canvas');
    const primeCtx = document.createElement('canvas').getContext('2d');
    const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    function zoomProgress(now) {
        const { from, to, start, dur } = view3d.tween;
        const t = clamp01((now - start) / dur);
        return from + (to - from) * easeInOut(t);
    }

    function bodyRadius(id) {
        return size * (id === 'star' ? 0.24 : 0.2);
    }

    // Precompute every sphere geometry while the browser is idle, one per slice
    const idle = window.requestIdleCallback || (fn => setTimeout(fn, 200));
    function warmGeometries() {
        if (!size) return;
        const jobs = [
            () => bodySphere.warm(bodyRadius('b')),
            () => bodySphere.warm(bodyRadius('star')),
            ...PLANETS.map(p => () => earthSphere.warm(bodyRadius(p.id) / p.R))
        ];
        const next = () => { const job = jobs.shift(); if (job) { job(); idle(next); } };
        idle(next);
    }

    function drawBodyView(g, tjd, now) {
        const c = size / 2;
        const k = Math.max(0.75, Math.min(1.45, size / 560));
        const ring = c - 26 * k;
        const id = view3d.shown;
        const isStar = id === 'star';
        const p = planetById(id);
        // Sized so the scale references (Sun outline, Earth) stay inside the ring
        const radius = bodyRadius(id);
        const cx = c;
        const cy = c - 18 * k;

        // Same graduated ring as the system view
        g.strokeStyle = colors.faint;
        g.lineWidth = 1;
        for (let i = 0; i < 72; i++) {
            const a = (i / 72) * Math.PI * 2;
            const len = (i % 6 === 0 ? 9 : 4) * k;
            g.beginPath();
            g.moveTo(c + Math.cos(a) * ring, c + Math.sin(a) * ring);
            g.lineTo(c + Math.cos(a) * (ring - len), c + Math.sin(a) * (ring - len));
            g.stroke();
        }

        g.font = `${10 * k}px "JetBrains Mono", monospace`;

        if (isStar) {
            // Corona glow, then the Sun's outline to scale (HD 110067 is 0.788 R☉)
            const glow = g.createRadialGradient(cx, cy, radius * 0.9, cx, cy, radius * 1.7);
            glow.addColorStop(0, 'rgba(255, 196, 140, 0.35)');
            glow.addColorStop(1, 'rgba(255, 196, 140, 0)');
            g.fillStyle = glow;
            g.beginPath();
            g.arc(cx, cy, radius * 1.7, 0, Math.PI * 2);
            g.fill();
            bodySphere.draw(g, 'star', cx, cy, radius, starShader(now * 0.00003));
            g.setLineDash([3 * k, 5 * k]);
            g.strokeStyle = colors.muted;
            g.beginPath();
            g.arc(cx, cy, radius / 0.788, 0, Math.PI * 2);
            g.stroke();
            g.setLineDash([]);
            g.textAlign = 'left';
            g.fillStyle = colors.muted;
            g.fillText('sun', cx + (radius / 0.788) * 0.72 + 6 * k, cy - (radius / 0.788) * 0.72);
        } else {
            // Light comes from the star, whose direction depends on where the planet is on its orbit
            const { angle } = phaseInfo(p, tjd);
            const lx = -Math.cos(angle), ly = -Math.sin(angle), lz = 0.22;
            const ln = Math.hypot(lx, ly, lz);
            const L = [lx / ln, ly / ln, lz / ln];
            bodySphere.draw(g, id, cx, cy, radius, planetShader(p, view3d.spin + now * 0.00005, L));

            // Earth to scale, under the same light
            const er = radius / p.R;
            const ed = radius + er + 20 * k;
            const ex = cx + ed * Math.cos(0.6);
            const ey = cy + ed * Math.sin(0.6);
            earthSphere.draw(g, 'earth', ex, ey, er, earthShader(view3d.spin + now * 0.00012, now * 0.00009, L));
            g.textAlign = 'center';
            g.fillStyle = colors.muted;
            g.fillText('earth', ex, ey + er + 14 * k);

            // Where the light comes from
            const ax = cx + lx / Math.hypot(lx, ly) * (radius + 26 * k);
            const ay = cy + ly / Math.hypot(lx, ly) * (radius + 26 * k);
            g.fillStyle = colors.star;
            g.beginPath();
            g.arc(ax, ay, 2.5 * k, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = colors.faint;
            g.fillText('★ light', ax, ay - 8 * k);
        }

        // Caption, at the bottom of the view, clear of the scale references
        const capY = c + ring - 46 * k;
        g.textAlign = 'center';
        g.font = `${11 * k}px "JetBrains Mono", monospace`;
        g.fillStyle = colors.text;
        g.fillText(isStar ? 'HD 110067 · K0 V' : `HD 110067 ${id} · ${p.R.toFixed(2)} R⊕`, cx, capY);
        g.font = `${10 * k}px "JetBrains Mono", monospace`;
        g.fillStyle = colors.faint;
        const note = isStar
            ? '5266 K · limb-darkened photosphere'
            : ['b', 'd', 'f'].includes(id) ? 'low density · likely H/He envelope' : 'mass not yet measured';
        g.fillText(`${note} · artist's impression`, cx, capY + 16 * k);
    }

    function brackets(x, y, r, color) {
        // Four corner marks around the selected body
        const l = r * 0.45;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => {
            ctx.beginPath();
            ctx.moveTo(x + sx * r, y + sy * (r - l));
            ctx.lineTo(x + sx * r, y + sy * r);
            ctx.lineTo(x + sx * (r - l), y + sy * r);
            ctx.stroke();
        });
    }

    function draw(tjd) {
        if (!size) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, size, size);

        const c = size / 2;
        const k = Math.max(0.75, Math.min(1.45, size / 560));
        const ring = c - 26 * k;               // graduated outer ring
        const scale = (ring - 24 * k) / A_MAX; // px per au
        geometry = { c, k, ring, scale };

        const infos = PLANETS.map(p => phaseInfo(p, tjd));
        const anyTransit = infos.some(i => i.transiting);
        const selIndex = PLANETS.findIndex(p => p.id === selected);

        // Graduated ring, same vocabulary as the vault dial
        ctx.strokeStyle = colors.faint;
        ctx.lineWidth = 1;
        for (let i = 0; i < 72; i++) {
            const a = (i / 72) * Math.PI * 2;
            const len = (i % 6 === 0 ? 9 : 4) * k;
            ctx.beginPath();
            ctx.moveTo(c + Math.cos(a) * ring, c + Math.sin(a) * ring);
            ctx.lineTo(c + Math.cos(a) * (ring - len), c + Math.sin(a) * (ring - len));
            ctx.stroke();
        }

        // Line of sight: a planet crossing it is transiting, seen from Earth
        ctx.save();
        ctx.setLineDash([2 * k, 5 * k]);
        ctx.strokeStyle = anyTransit ? colors.accent : colors.lineStrong;
        ctx.beginPath();
        ctx.moveTo(c, c + 14 * k);
        ctx.lineTo(c, c + ring - 12 * k);
        ctx.stroke();
        ctx.restore();

        ctx.font = `${10 * k}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = anyTransit ? colors.accent : colors.faint;
        ctx.fillText(anyTransit ? '↓ transit visible from earth' : '↓ earth · 32.2 pc', c, c + ring + 17 * k);

        // Orbits; the selected planet's resonant neighbours are dashed
        PLANETS.forEach((p, i) => {
            const isSel = i === selIndex;
            const isNeighbour = selIndex >= 0 && Math.abs(i - selIndex) === 1;
            const isHover = p.id === hovered;
            ctx.save();
            ctx.lineWidth = 1;
            ctx.strokeStyle = isSel || isHover ? colors.accent : colors.lineStrong;
            if (isNeighbour) {
                ctx.strokeStyle = colors.accent;
                ctx.globalAlpha = 0.45;
                ctx.setLineDash([3 * k, 5 * k]);
            }
            ctx.beginPath();
            ctx.arc(c, c, p.a * scale, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        });

        // Star (K0 V, ~5270 K)
        const glowR = 40 * k;
        const glow = ctx.createRadialGradient(c, c, 0, c, c, glowR);
        glow.addColorStop(0, colors.star);
        glow.addColorStop(0.2, colors.star);
        glow.addColorStop(1, 'transparent');
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(c, c, glowR, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = colors.star;
        ctx.beginPath();
        ctx.arc(c, c, 7 * k, 0, Math.PI * 2);
        ctx.fill();
        if (selected === 'star' || hovered === 'star') brackets(c, c, 16 * k, colors.accent);

        // Planets, with a short trail showing the direction of motion
        positions = PLANETS.map((p, i) => {
            const { angle, transiting } = infos[i];
            const r = p.a * scale;
            const x = c + Math.cos(angle) * r;
            const y = c + Math.sin(angle) * r;
            const isSel = p.id === selected;
            const active = isSel || p.id === hovered || transiting;
            const color = active ? colors.accent : colors.text;

            const TRAIL = 0.45;
            const STEPS = 14;
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5 * k;
            for (let s = 0; s < STEPS; s++) {
                ctx.globalAlpha = (s / STEPS) * 0.45;
                ctx.beginPath();
                ctx.arc(c, c, r, angle - TRAIL * (1 - s / STEPS), angle - TRAIL * (1 - (s + 1) / STEPS));
                ctx.stroke();
            }
            ctx.globalAlpha = 1;

            // Radii exaggerated but proportional (1.94–2.85 R⊕)
            const pr = (1.8 + (p.R - 1.8) * 2) * k;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, pr, 0, Math.PI * 2);
            ctx.fill();
            if (isSel) brackets(x, y, pr + 8 * k, colors.accent);
            else if (active) {
                ctx.strokeStyle = colors.accent;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(x, y, pr + 5 * k, 0, Math.PI * 2);
                ctx.stroke();
            }

            // Letter, pushed outward from the star; hover adds the countdown
            const lx = x + Math.cos(angle) * 15 * k;
            const ly = y + Math.sin(angle) * 15 * k + 3.5 * k;
            ctx.fillStyle = active ? colors.accent : colors.muted;
            ctx.fillText(p.id, lx, ly);
            if (p.id === hovered && !isSel) {
                ctx.fillStyle = colors.muted;
                const label = transiting ? 'transiting' : 'transit in ' + formatSpan(infos[i].next - tjd, { seconds: false });
                ctx.fillText(label, lx, ly + 13 * k);
            }

            return { id: p.id, x, y };
        });
    }

    function composite(tjd, now, t) {
        out.setTransform(1, 0, 0, 1, 0, 0);
        out.clearRect(0, 0, canvas.width, canvas.height);

        if (t < 0.999) {
            // Zoom into the focused body while fading the system out
            const focus = view3d.shown === 'star' || !view3d.shown
                ? { x: size / 2, y: size / 2 }
                : positions.find(p => p.id === view3d.shown) || { x: size / 2, y: size / 2 };
            const z = 1 + t * 2.2;
            out.save();
            out.globalAlpha = 1 - t;
            out.translate(focus.x * dpr, focus.y * dpr);
            out.scale(z, z);
            out.translate(-focus.x * dpr, -focus.y * dpr);
            out.drawImage(sysLayer, 0, 0);
            out.restore();
        }

        if (t > 0.001 && view3d.shown) {
            out.save();
            out.setTransform(dpr, 0, 0, dpr, 0, 0);
            const swapIn = view3d.swap ? easeInOut(clamp01((now - view3d.swap.start) / 420)) : 1;
            out.globalAlpha = t * swapIn;
            const s = 0.85 + 0.15 * t;
            out.translate(size / 2, size / 2);
            out.scale(s, s);
            out.translate(-size / 2, -size / 2);
            drawBodyView(out, tjd, now);
            out.restore();
        }

        // Cross-fade out the previous body
        if (view3d.swap) {
            const u = clamp01((now - view3d.swap.start) / 420);
            if (u >= 1) view3d.swap = null;
            else {
                out.save();
                out.setTransform(1, 0, 0, 1, 0, 0);
                out.globalAlpha = 1 - easeInOut(u);
                out.drawImage(snapshot, 0, 0);
                out.restore();
            }
        }
    }

    // --- Light curve of the selected planet ---

    function drawLightCurve(tjd) {
        const p = planetById(selected);
        const cv = card.lcCanvas;
        if (!p || !cv.width) return;
        const lc = cv.getContext('2d');
        const w = cv.width / dpr;
        const h = cv.height / dpr;
        lc.setTransform(dpr, 0, 0, dpr, 0, 0);
        lc.clearRect(0, 0, w, h);

        const info = phaseInfo(p, tjd);
        const half = p.tT * 1.6;                       // window: ±1.6 transit durations
        const ingress = p.tT * p.k / (1 + p.k);        // contact 1 → 2
        const top = 10;
        const bottom = h - 10;
        const fluxAt = dt => {
            const x = Math.abs(dt);
            if (x >= p.tT / 2) return 0;
            if (x <= p.tT / 2 - ingress) return 1;
            return (p.tT / 2 - x) / ingress;
        };
        const X = dt => ((dt + half) / (2 * half)) * w;
        const Y = f => top + f * (bottom - top);

        lc.strokeStyle = colors.line;
        lc.lineWidth = 1;
        lc.beginPath();
        lc.moveTo(0, top);
        lc.lineTo(w, top);
        lc.stroke();

        lc.strokeStyle = colors.muted;
        lc.lineWidth = 1.5;
        lc.beginPath();
        for (let i = 0; i <= 120; i++) {
            const dt = -half + (i / 120) * 2 * half;
            const x = X(dt);
            const y = Y(fluxAt(dt));
            if (i) lc.lineTo(x, y); else lc.moveTo(x, y);
        }
        lc.stroke();

        // "Now" marker, only while the current time is inside the window
        const now = info.fromNearest;
        if (Math.abs(now) < half) {
            const x = X(now);
            lc.strokeStyle = colors.accent;
            lc.lineWidth = 1;
            lc.beginPath();
            lc.moveTo(x, 2);
            lc.lineTo(x, h - 2);
            lc.stroke();
            lc.fillStyle = colors.accent;
            lc.beginPath();
            lc.arc(x, Y(fluxAt(now)), 3, 0, Math.PI * 2);
            lc.fill();
        }

        card.lcLabel.textContent = `transit light curve · −${Math.round(p.k * p.k * 1e6)} ppm`;
        card.lcNext.textContent = info.transiting
            ? 'transiting now'
            : Math.abs(now) < half && now > 0
                ? 'transit just ended'
                : 'next in ' + formatSpan(info.next - tjd, { seconds: false });
        card.lcNext.classList.toggle('is-live', info.transiting);
    }

    // --- Pointer: hover, click, and drag around the centre to turn time ---

    function bodyAt(x, y) {
        const { c, k } = geometry;
        let best = null;
        let bestD = 18 * k;
        positions.forEach(p => {
            const d = Math.hypot(p.x - x, p.y - y);
            if (d < bestD) { best = p.id; bestD = d; }
        });
        if (!best && Math.hypot(x - c, y - c) < 16 * k) best = 'star';
        return best;
    }

    const local = e => {
        const r = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    let drag = null;

    canvas.addEventListener('pointerdown', (e) => {
        const { x, y } = local(e);
        drag = { startX: x, startY: y, lastX: x, angle: Math.atan2(y - geometry.c, x - geometry.c), moved: false };
        canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointermove', (e) => {
        const { x, y } = local(e);
        if (drag) {
            if (!drag.moved && Math.hypot(x - drag.startX, y - drag.startY) > 5) {
                drag.moved = true;
                if (!selected) setRate(0, 'scrub');
                canvas.classList.add('is-dragging');
            }
            if (drag.moved && selected) {
                view3d.spin += (x - drag.lastX) * 0.012;
                drag.lastX = x;
            } else if (drag.moved) {
                // Turning the pointer around the star turns the reference planet with it, like a dial
                const angle = Math.atan2(y - geometry.c, x - geometry.c);
                let delta = angle - drag.angle;
                if (delta > Math.PI) delta -= 2 * Math.PI;
                if (delta < -Math.PI) delta += 2 * Math.PI;
                drag.angle = angle;
                const ref = planetById(selected) || PLANETS[0];
                simMs += (delta / (2 * Math.PI)) * ref.P * 86400000;
            }
            return;
        }
        hovered = selected ? null : bodyAt(x, y);
        canvas.classList.toggle('over-body', !!hovered);
        body.classList.toggle('hovering', !!hovered);
        rows.forEach(r => r.tr.classList.toggle('hovered', r.p.id === hovered));
    });

    canvas.addEventListener('pointerup', (e) => {
        if (drag && !drag.moved) {
            const { x, y } = local(e);
            if (!selected) {
                const id = bodyAt(x, y);
                if (id) select(id);
            }
        }
        drag = null;
        canvas.classList.remove('is-dragging');
    });

    canvas.addEventListener('pointerleave', () => {
        if (drag) return;
        hovered = null;
        body.classList.remove('hovering');
        rows.forEach(r => r.tr.classList.remove('hovered'));
    });

    // --- Text ---

    function updateText(tjd) {
        rows.forEach(r => {
            const info = phaseInfo(r.p, tjd);
            r.tr.classList.toggle('transiting', info.transiting);
            r.next.textContent = info.transiting ? 'transiting' : formatSpan(info.next - tjd);
        });
        simDate.textContent = new Date(simMs).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
        const offset = (simMs - Date.now()) / 86400000;
        simBjd.textContent = 'BJD ' + (tjd + 2457000).toFixed(5);
        simOffset.textContent = Math.abs(offset) > 1 / 1440
            ? `${offset > 0 ? '+' : '−'}${formatSpan(offset, { seconds: false })} from now`
            : '';
    }

    // --- Loop: only draws while the panel is on screen ---

    let lastText = 0;

    function frame(now) {
        const dt = now - lastFrame;
        lastFrame = now;
        if (rate === 1) simMs = Date.now();
        else simMs += dt * rate;

        if (body.dataset.panel === 'lab' && !document.hidden && !body.classList.contains('term-active')) {
            const tjd = toTjd(simMs);
            const t = zoomProgress(now);
            shading.frame++;
            shading.frozen = (t > 0.001 && t < 0.999) || !!view3d.swap;
            if (!selected && t < 0.001) view3d.shown = null;
            if (t < 0.999) draw(tjd);
            composite(tjd, now, t);
            if (selected && selected !== 'star') drawLightCurve(tjd);
            if (now - lastText > 200) {
                updateText(tjd);
                lastText = now;
            }
        }
        requestAnimationFrame(frame);
    }

    updateText(toTjd(simMs));
    requestAnimationFrame(frame);

    // --- Shared with the terminal ---

    window.site.system = {
        describe() {
            const tjd = toTjd(Date.now());
            return [
                'HD 110067 — K0 V star, 32.2 pc, Coma Berenices',
                'six sub-Neptunes in a 3:2 · 3:2 · 3:2 · 4:3 · 4:3 resonant chain',
                '',
                'planet  period (d)   radius (R⊕)  Teq (K)  next transit',
                ...PLANETS.map(p => {
                    const info = phaseInfo(p, tjd);
                    return `${p.id.padEnd(8)}${p.P.toFixed(6).padEnd(12)}${p.R.toFixed(3).padEnd(13)}${String(p.Teq).padEnd(9)}${info.transiting ? 'transiting now' : 'in ' + formatSpan(info.next - tjd)}`;
                }),
                '',
                'source: Luque et al. 2023, Nature 623, 932–937 (linear ephemeris)'
            ].join('\n');
        }
    };
})();
