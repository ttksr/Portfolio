// Content-driven sections: projects, writeups, certifications, contact links.
// Everything is read from window.CONTENT (assets/data/content.js) and built with DOM text nodes only,
// so nothing in the content file can inject markup or script.

(() => {
    const C = window.CONTENT;
    const { t, pick } = window.i18n;
    const body = document.body;

    // --- Helpers ---

    function el(tag, attrs = {}, ...children) {
        const node = document.createElement(tag);
        Object.entries(attrs).forEach(([k, v]) => {
            if (v === false || v === null || v === undefined) return;
            if (k === 'class') node.className = v;
            else if (k === 'text') node.textContent = v;
            else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
            else node.setAttribute(k, v === true ? '' : v);
        });
        children.flat().forEach(c => { if (c !== null && c !== undefined && c !== false) node.append(c); });
        return node;
    }

    // Only http(s), mailto and same-site relative links: a javascript: URL in the content file goes nowhere
    function safeUrl(url) {
        if (!url) return '';
        const u = String(url).trim();
        if (/^(https?:|mailto:)/i.test(u)) return u;
        if (!/^[a-z][a-z0-9+.-]*:/i.test(u) && !u.startsWith('//')) return u;
        return '';
    }

    const isExternal = url => /^https?:/i.test(url);
    const pad2 = n => String(n).padStart(2, '0');
    const exampleBadge = item => item.example ? el('span', { class: 'badge badge--example', text: t('badge.example') }) : null;
    const log = msg => window.site?.log?.(msg);

    function linkEl(label, url, cls = 'detail-link') {
        const href = safeUrl(url);
        if (!href) return null;
        return el('a', {
            class: cls,
            href,
            target: isExternal(href) ? '_blank' : null,
            rel: isExternal(href) ? 'noopener noreferrer' : null,
            text: label + (isExternal(href) ? ' ↗' : '')
        });
    }

    // --- List ⇄ detail swap (shared by projects and writeups) ---

    function makeSwap({ swapId, detailId, items, render, logName }) {
        const swap = document.getElementById(swapId);
        const detail = document.getElementById(detailId);
        const panel = swap.closest('.panel');
        let index = -1;
        let opener = null;

        function head() {
            return el('div', { class: 'detail-head' },
                el('button', { type: 'button', class: 'detail-back', onclick: close },
                    el('kbd', { text: 'esc' }), ' ' + t('detail.back')),
                el('div', { class: 'detail-nav' },
                    el('button', { type: 'button', class: 'detail-step', 'aria-label': t('detail.prev'), onclick: () => step(-1), text: '‹' }),
                    el('span', { class: 'detail-count', text: `${pad2(index + 1)} / ${pad2(items().length)}` }),
                    el('button', { type: 'button', class: 'detail-step', 'aria-label': t('detail.next'), onclick: () => step(1), text: '›' })
                )
            );
        }

        function fill() {
            detail.textContent = '';
            detail.append(head(), ...render(items()[index], index).filter(Boolean));
        }

        function open(i, from) {
            index = i;
            opener = from || null;
            fill();
            swap.classList.add('is-detail');
            panel.scrollTop = 0;
            detail.querySelector('.detail-back').focus({ preventScroll: true });
            log(`open ${logName}/${items()[i].id || i}`);
        }

        function step(dir) {
            const n = items().length;
            index = (index + dir + n) % n;
            fill();
            detail.animate(
                [{ opacity: 0, transform: `translateX(${dir * 10}px)` }, { opacity: 1, transform: 'none' }],
                { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
            );
            detail.querySelector('.detail-back').focus({ preventScroll: true });
        }

        function close() {
            if (!swap.classList.contains('is-detail')) return;
            swap.classList.remove('is-detail');
            index = -1;
            if (opener && document.body.contains(opener)) opener.focus({ preventScroll: true });
        }

        const isOpen = () => swap.classList.contains('is-detail');

        return { open, close, isOpen, refresh: () => isOpen() && fill(), panel };
    }

    // --- Projects ---

    const projectGrid = document.getElementById('project-grid');

    function detailSection(titleKey, value) {
        const text = pick(value);
        return el('section', { class: 'detail-block' },
            el('h4', { text: t(titleKey) }),
            el('p', { class: text ? '' : 'detail-todo', text: text || t('detail.todo') })
        );
    }

    const projectSwap = makeSwap({
        swapId: 'projects-swap',
        detailId: 'project-detail',
        logName: 'projects',
        items: () => C.projects,
        render: (p, i) => {
            const links = (p.links || []).map(l => linkEl(l.label, l.url)).filter(Boolean);
            const digest = projectGrid.querySelectorAll('.card-hash')[i]?.dataset.text;
            return [
                el('div', { class: 'detail-title' },
                    el('span', { class: 'card-id', text: '0x' + pad2(i + 1) }),
                    el('h3', { text: p.title }),
                    exampleBadge(p)),
                el('ul', { class: 'tags' }, (p.tags || []).map(tag => el('li', { text: tag }))),
                el('div', { class: 'detail-grid' },
                    el('div', { class: 'detail-main' },
                        el('p', { class: 'detail-summary', text: pick(p.summary) }),
                        detailSection('detail.context', p.context),
                        detailSection('detail.approach', p.approach),
                        detailSection('detail.result', p.result)),
                    el('aside', { class: 'detail-side' },
                        el('dl', { class: 'detail-meta' },
                            el('dt', { text: t('detail.stack') }),
                            el('dd', { text: (p.stack || []).join(', ') || '—' }),
                            digest ? el('dt', { text: 'digest' }) : null,
                            digest ? el('dd', { text: digest }) : null),
                        links.length ? el('h4', { text: t('detail.links') }) : null,
                        links.length ? el('div', { class: 'detail-links' }, links) : null))
            ];
        }
    });

    const projectSummaries = [];

    C.projects.forEach((p, i) => {
        const summary = el('p', { text: pick(p.summary) });
        projectSummaries.push(summary);
        const card = el('article', { class: 'project-card reveal' },
            el('div', { class: 'card-top' },
                el('span', { class: 'card-id', text: '0x' + pad2(i + 1) }),
                el('span', { class: 'card-hash', 'aria-hidden': 'true' })),
            el('h3', { text: p.title }),
            summary,
            el('ul', { class: 'tags' }, (p.tags || []).map(tag => el('li', { text: tag }))),
            el('span', { class: 'card-more', 'aria-hidden': 'true', text: '→' })
        );
        // A real button covering the card: keyboard and screen readers get a proper control
        const opener = el('button', {
            type: 'button',
            class: 'card-open',
            'aria-label': `${t('detail.open')} — ${p.title}`,
            onclick: () => projectSwap.open(i, opener)
        });
        card.prepend(opener);
        projectGrid.appendChild(card);
    });

    // --- Writeups ---

    const writeupList = document.getElementById('writeup-list');
    const writeupFilters = document.getElementById('writeup-filters');
    let filter = 'all';

    const writeupSwap = makeSwap({
        swapId: 'writeups-swap',
        detailId: 'writeup-detail',
        logName: 'writeups',
        items: () => C.writeups,
        render: w => {
            const read = linkEl(t('detail.read'), w.url, 'btn btn-ghost btn-small');
            return [
                el('div', { class: 'detail-title' },
                    el('h3', { text: w.title }),
                    exampleBadge(w)),
                el('div', { class: 'writeup-meta' },
                    el('span', { text: w.platform }),
                    el('span', { class: 'pill', text: w.category }),
                    el('span', { class: `pill pill--${w.difficulty}`, text: w.difficulty }),
                    el('span', { text: w.date })),
                el('p', { class: 'detail-summary', text: pick(w.summary) }),
                (w.steps || []).length ? el('section', { class: 'detail-block' },
                    el('h4', { text: t('detail.steps') }),
                    el('ol', { class: 'steps' }, w.steps.map(s => el('li', { text: pick(s) })))) : null,
                (w.tools || []).length ? el('section', { class: 'detail-block' },
                    el('h4', { text: t('detail.tools') }),
                    el('ul', { class: 'tags' }, w.tools.map(tool => el('li', { text: tool })))) : null,
                read
            ];
        }
    });

    function renderWriteups() {
        const categories = ['all', ...new Set(C.writeups.map(w => w.category))];
        writeupFilters.textContent = '';
        writeupFilters.setAttribute('aria-label', t('writeups.title'));
        categories.forEach(cat => {
            writeupFilters.appendChild(el('button', {
                type: 'button',
                class: 'chip',
                'aria-pressed': String(cat === filter),
                text: cat === 'all' ? t('writeups.all') : cat,
                onclick: () => {
                    filter = cat;
                    renderWriteups();
                    log(`filter writeups ${cat}`);
                }
            }));
        });

        writeupList.textContent = '';
        const shown = C.writeups.map((w, i) => ({ w, i })).filter(({ w }) => filter === 'all' || w.category === filter);
        if (!shown.length) {
            writeupList.appendChild(el('li', { class: 'writeup-empty', text: t('writeups.empty') }));
            return;
        }
        shown.forEach(({ w, i }) => {
            const row = el('button', { type: 'button', class: 'writeup-row' },
                el('span', { class: 'wr-date', text: w.date }),
                el('span', { class: 'wr-platform', text: w.platform }),
                el('span', { class: 'wr-title' }, w.title, exampleBadge(w)),
                el('span', { class: 'pill', text: w.category }),
                el('span', { class: `pill pill--${w.difficulty}`, text: w.difficulty }),
                el('span', { class: 'wr-arrow', 'aria-hidden': 'true', text: '→' }));
            row.addEventListener('click', () => writeupSwap.open(i, row));
            writeupList.appendChild(el('li', {}, row));
        });
    }

    // --- Certifications & education ---

    const certList = document.getElementById('cert-list');
    const eduList = document.getElementById('edu-list');

    function timelineItem({ status, name, meta, extra, example }) {
        return el('li', { class: `timeline-item is-${status}` },
            el('span', { class: 'tl-dot', 'aria-hidden': 'true' }),
            el('div', { class: 'tl-body' },
                el('p', { class: 'tl-name' }, name, example ? el('span', { class: 'badge badge--example', text: t('badge.example') }) : null),
                el('p', { class: 'tl-meta' },
                    meta.filter(Boolean).join(' · '),
                    el('span', { class: `tl-status tl-status--${status}`, text: t('status.' + status) })),
                extra));
    }

    function renderCerts() {
        certList.textContent = '';
        C.certifications.forEach(c => {
            const verify = linkEl(t('cert.verify'), c.url, 'tl-link');
            const extra = (c.credential || verify)
                ? el('p', { class: 'tl-extra' }, c.credential ? `${t('cert.id')} ${c.credential} ` : '', verify)
                : null;
            certList.appendChild(timelineItem({
                status: c.status, name: pick(c.name), meta: [c.issuer, c.date], extra, example: c.example
            }));
        });
        eduList.textContent = '';
        (C.education || []).forEach(e => {
            eduList.appendChild(timelineItem({
                status: e.status, name: pick(e.name), meta: [e.school, e.dates], extra: null, example: e.example
            }));
        });
    }

    // --- Contact & social links (hidden until filled in content.js) ---

    // keepEmpty: the link stays visible even without a URL (a reminder to fill content.js);
    // clicking it then does nothing instead of opening a new tab on '#'
    function setLink(id, url, { keepEmpty = false } = {}) {
        const a = document.getElementById(id);
        const href = safeUrl(url);
        if (!a) return;
        a.hidden = !href && !keepEmpty;
        a.href = href || '#';
        a.dataset.empty = String(!href);
    }

    document.addEventListener('click', (e) => {
        if (e.target.closest('a[data-empty="true"]')) e.preventDefault();
    });

    function renderProfile() {
        const p = C.profile;
        setLink('contact-github', p.github, { keepEmpty: true });
        setLink('contact-htb', p.htb, { keepEmpty: true });
        setLink('contact-thm', p.thm, { keepEmpty: true });
        setLink('contact-pgp', p.pgp);
        setLink('footbar-github', p.github, { keepEmpty: true });
        setLink('footbar-htb', p.htb, { keepEmpty: true });
        setLink('footbar-thm', p.thm, { keepEmpty: true });
        const fingerprint = document.getElementById('contact-fingerprint');
        fingerprint.querySelector('.fingerprint').textContent = p.pgpFingerprint || '';
        fingerprint.hidden = !(p.pgp && p.pgpFingerprint);
        const now = document.getElementById('hero-now');
        document.getElementById('hero-now-text').textContent = pick(C.now);
        now.hidden = !pick(C.now);
        // "updated oct 2026", from the date of the "now" line: it moves each time that line is refreshed
        const updated = document.getElementById('footbar-updated');
        const [year, month] = String(C.now?.updated || '').split('-').map(Number);
        updated.hidden = !(year && month);
        if (!updated.hidden) {
            const date = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(window.i18n.lang,
                { month: 'short', year: 'numeric', timeZone: 'UTC' });
            updated.textContent = `${window.i18n.t('foot.updated')} ${date}`;
        }
        const seeking = document.getElementById('contact-seeking');
        seeking.textContent = pick(p.seeking);
        seeking.hidden = !seeking.textContent;
    }

    // --- Mark freshly rendered blocks as revealed when their panel is already on screen ---

    function settle(container) {
        if (container.closest('.panel')?.classList.contains('active')) {
            container.querySelectorAll('.reveal').forEach(r => r.classList.add('in'));
        }
    }

    // --- Toolbox (About) ---

    const toolbox = document.getElementById('toolbox');
    (C.toolbox || []).forEach(group => {
        toolbox.appendChild(el('li', { class: 'focus-item' },
            el('span', { class: 'focus-key', text: group.category }),
            el('ul', { class: 'tags toolbox-tools' }, group.tools.map(t => el('li', { text: t })))));
    });

    renderWriteups();
    renderCerts();
    renderProfile();

    // --- Escape closes an open detail ---

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || body.classList.contains('term-active')) return;
        [projectSwap, writeupSwap].forEach(s => {
            if (s.isOpen() && s.panel.classList.contains('active')) s.close();
        });
    });

    // Leaving a panel resets its detail view, so coming back starts from the list
    document.addEventListener('panelchange', () => {
        [projectSwap, writeupSwap].forEach(s => {
            if (!s.panel.classList.contains('active')) setTimeout(() => s.close(), 600);
        });
    });

    // --- Language switch ---

    document.addEventListener('langchange', () => {
        C.projects.forEach((p, i) => { projectSummaries[i].textContent = pick(p.summary); });
        projectGrid.querySelectorAll('.card-open').forEach((b, i) => {
            b.setAttribute('aria-label', `${t('detail.open')} — ${C.projects[i].title}`);
        });
        renderWriteups();
        renderCerts();
        renderProfile();
        settle(writeupList);
        projectSwap.refresh();
        writeupSwap.refresh();
    });
})();
