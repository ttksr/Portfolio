// Terminal mode
// A small shell over the site's own content: everything it prints is read from the page,
// so editing index.html updates the terminal too.

(() => {
    const body = document.body;
    const term = document.getElementById('terminal');
    const output = document.getElementById('term-output');
    const termBody = document.getElementById('term-body');
    const form = document.getElementById('term-form');
    const input = document.getElementById('term-input');
    const promptEl = document.getElementById('term-prompt');
    const closeBtn = document.getElementById('term-close');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let isOpen = false;
    let booted = false;
    let opener = null;
    let cwd = '~';
    const history = [];
    let historyIndex = 0;

    // --- Content, read from the page ---

    const clean = el => el.textContent.replace(/\s+/g, ' ').trim();
    const slugify = str => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const C = window.CONTENT;
    const pick = v => window.i18n.pick(v);
    const email = C.profile.email;
    const socialHref = key => C.profile[key] || '';

    const projects = C.projects.map((p, i) => ({
        ...p,
        file: p.id + '.md',
        hash: document.querySelectorAll('#project-grid .card-hash')[i]
    }));
    const writeups = C.writeups.map(w => ({ ...w, file: (w.id || slugify(w.title)) + '.md' }));

    const section = (title, value) => (pick(value) ? ['', `## ${title}`, pick(value)] : []);

    const files = {
        '~/about.txt': () => [...document.querySelectorAll('.about-text p')].map(clean).join('\n\n'),
        '~/now.txt': () => (C.now && pick(C.now)
            ? `${pick(C.now)}\n\n(updated ${C.now.updated || '?'})`
            : 'nothing announced right now.'),
        '~/toolbox.txt': () => (C.toolbox || [])
            .map(g => g.category.padEnd(11) + g.tools.join(', '))
            .join('\n'),
        '~/certifications.txt': () => [
            ...C.certifications.map(c =>
                `[${c.status.padEnd(11)}] ${pick(c.name)} — ${c.issuer}${c.date ? ' (' + c.date + ')' : ''}${c.example ? '  (example)' : ''}`),
            '',
            ...(C.education || []).map(e => `[${e.status.padEnd(11)}] ${pick(e.name)} — ${e.school}${e.dates ? ' (' + e.dates + ')' : ''}`)
        ].join('\n'),
        '~/hd110067.txt': () => window.site.system.describe(),
        '~/session.log': () => window.site.logEntries.map(e => `${e.time}  ${e.text}`).join('\n'),
        // The published /.well-known/security.txt itself (RFC 9116, PGP-signed): one source of truth
        '~/security.txt': async () => {
            try {
                const res = await fetch('.well-known/security.txt');
                if (!res.ok) throw new Error(res.status);
                return (await res.text()).trim() + "\n\n(verify the signature: gpg --verify security.txt)";
            } catch (e) {
                return `Contact: mailto:${email}\n(full file: /.well-known/security.txt)`;
            }
        },
        // The real key file (same origin, allowed by the CSP); falls back to its link when fetch isn't possible
        '~/pubkey.asc': async () => {
            if (!C.profile.pgp) return 'no public key published yet.';
            try {
                const res = await fetch(C.profile.pgp);
                if (!res.ok) throw new Error(res.status);
                return (await res.text()).trim() + (C.profile.pgpFingerprint ? `\n\nfingerprint: ${C.profile.pgpFingerprint}` : '');
            } catch (e) {
                return `public key: ${C.profile.pgp}\nfingerprint: ${C.profile.pgpFingerprint || '?'}\n(run 'open pgp' to download it)`;
            }
        },
        '~/contact.txt': () => [
            'email     ' + email,
            'github    ' + (socialHref('github') || '(not linked yet)'),
            'htb       ' + (socialHref('htb') || '(not linked yet)'),
            'thm       ' + (socialHref('thm') || '(not linked yet)'),
            pick(C.profile.seeking) ? '\n' + pick(C.profile.seeking) : null,
            '',
            "tip: run 'email' to copy the address"
        ].filter(l => l !== null).join('\n')
    };

    projects.forEach((p, i) => {
        files['~/projects/' + p.file] = () => [
            `# ${p.title}`,
            '',
            pick(p.summary),
            ...section('context', p.context),
            ...section('approach', p.approach),
            ...section('result', p.result),
            '',
            `id      0x${String(i + 1).padStart(2, '0')}`,
            `tags    ${(p.tags || []).join(', ')}`,
            (p.stack || []).length ? `stack   ${p.stack.join(', ')}` : null,
            p.hash?.dataset.text ? `digest  ${p.hash.dataset.text}` : null,
            ...(p.links || []).map(l => `link    ${l.label}: ${l.url}`)
        ].filter(line => line !== null).join('\n');
    });

    writeups.forEach(w => {
        files['~/writeups/' + w.file] = () => [
            `# ${w.title}${w.example ? '  (example)' : ''}`,
            `${w.platform} · ${w.category} · ${w.difficulty} · ${w.date}`,
            '',
            pick(w.summary),
            '',
            ...(w.steps || []).map((st, i) => `${i + 1}. ${pick(st)}`),
            '',
            (w.tools || []).length ? `tools   ${w.tools.join(', ')}` : null,
            w.url ? `full    ${w.url}` : null
        ].filter(line => line !== null).join('\n');
    });

    const dirs = {
        '~': ['about.txt', 'now.txt', 'toolbox.txt', 'certifications.txt', 'contact.txt', 'hd110067.txt', 'security.txt', 'pubkey.asc', 'session.log', 'projects/', 'writeups/'],
        '~/projects': projects.map(p => p.file),
        '~/writeups': writeups.map(w => w.file)
    };

    const sections = {
        home: 'top', about: 'about', projects: 'projects', writeups: 'writeups',
        certifications: 'certifications', lab: 'lab', system: 'lab', contact: 'contact'
    };

    // Resolve a path relative to the current directory ("..", "~", trailing slashes)
    function resolve(arg = '') {
        const raw = arg === '' || arg === '/' ? '~' : arg.startsWith('~') ? arg : `${cwd}/${arg}`;
        const parts = [];
        raw.split('/').filter(Boolean).forEach(part => {
            if (part === '.') return;
            if (part === '..') { if (parts.length > 1) parts.pop(); return; }
            parts.push(part);
        });
        return parts.join('/') || '~';
    }

    // --- Output helpers ---

    function line(content = '', cls = '') {
        const div = document.createElement('div');
        div.className = 'term-row' + (cls ? ' ' + cls : '');
        if (typeof content === 'string') div.textContent = content;
        else div.append(...[].concat(content));
        output.appendChild(div);
        termBody.scrollTop = termBody.scrollHeight;
        return div;
    }

    function span(text, cls) {
        const s = document.createElement('span');
        s.className = cls;
        s.textContent = text;
        return s;
    }

    // Clickable output: runs a command as if it had been typed
    function cmdLink(label, command, cls = '') {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'term-link' + (cls ? ' ' + cls : '');
        b.textContent = label;
        b.addEventListener('click', () => { run(command); input.focus({ preventScroll: true }); });
        return b;
    }

    // Clickable output that only pre-fills the prompt (for commands that need an argument)
    function fillLink(label, text) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'term-link';
        b.textContent = label;
        b.addEventListener('click', () => { input.value = text; input.focus({ preventScroll: true }); });
        return b;
    }

    const promptText = () => `visitor@scaringella:${cwd}$`;

    function renderPrompt() {
        promptEl.textContent = promptText();
    }

    function echo(command) {
        line([span(promptText(), 'term-accent'), document.createTextNode(' ' + command)]);
    }

    // --- Commands ---

    const commands = {
        help: {
            desc: 'list available commands',
            run() {
                line('available commands:', 'term-dim');
                Object.entries(commands).filter(([, c]) => !c.hidden).forEach(([name, c]) => {
                    const label = name.padEnd(8);
                    line([
                        c.usage ? fillLink(label, name + ' ') : cmdLink(label, name),
                        span((c.usage || '').padEnd(14), 'term-dim'),
                        span(c.desc, 'term-dim')
                    ], 'term-pre');
                });
                line('');
                line("tab completes · ↑ ↓ history · ctrl+l clears · esc returns to the site", 'term-dim');
            }
        },
        ls: {
            desc: 'list files',
            usage: '[-a] [dir]',
            run(argv) {
                // -a / -la / -al: also show hidden (dot) entries
                const showAll = argv.some(a => /^-[a-z]*a/.test(a));
                const args = argv.filter(a => !a.startsWith('-'));
                const path = resolve(args[0] ?? '.');
                if (files[path]) return line(args[0]);
                if (!dirs[path]) return line(`ls: cannot access '${args[0]}': no such directory`, 'term-error');
                const entries = dirs[path].filter(name => showAll || !name.startsWith('.'));
                line(entries.map(name => {
                    const isDir = name.endsWith('/');
                    const target = (path === cwd ? '' : (args[0].replace(/\/$/, '') + '/')) + name;
                    return cmdLink(name, isDir ? `cd ${target} && ls` : `cat ${target}`, isDir ? 'term-dir' : '');
                }), 'term-list');
            }
        },
        cd: {
            desc: 'change directory',
            usage: '<dir>',
            run(args) {
                const path = resolve(args[0]);
                if (!dirs[path]) return line(`cd: no such directory: ${args[0]}`, 'term-error');
                cwd = path;
                renderPrompt();
            }
        },
        cat: {
            desc: 'print a file',
            usage: '<file>',
            async run(args) {
                if (!args[0]) return line('usage: cat <file>', 'term-error');
                const path = resolve(args[0]);
                if (dirs[path]) return line(`cat: ${args[0]}: is a directory`, 'term-error');
                if (!files[path]) return line(`cat: ${args[0]}: no such file`, 'term-error');
                line(await files[path](), 'term-file');
            }
        },
        open: {
            desc: 'go to a section or link',
            usage: '<target>',
            run(args) {
                const target = (args[0] || '').toLowerCase();
                if (target in sections) {
                    line(`opening ${target}…`, 'term-dim');
                    setTimeout(() => {
                        close();
                        window.site.goTo(window.site.ids.indexOf(sections[target]));
                    }, 350);
                    return;
                }
                if (['github', 'htb', 'thm', 'pgp'].includes(target)) {
                    const href = socialHref(target);
                    if (!/^(https?:\/\/|[\w./-]+$)/i.test(href)) return line(`${target}: link not configured yet`, 'term-error');
                    window.open(href, '_blank', 'noopener,noreferrer');
                    return line(`opened ${href}`, 'term-dim');
                }
                if (target === 'mail') {
                    window.location.href = `mailto:${email}`;
                    return;
                }
                line('usage: open <target>', 'term-error');
                line([...Object.keys(sections).filter(k => k !== 'system'), 'github', 'htb', 'thm', 'pgp', 'mail'].map(t => cmdLink(t, `open ${t}`)), 'term-list');
            }
        },
        whoami: {
            desc: 'who are you',
            run() {
                line('uid=1000(visitor) gid=1000(guest) groups=guest');
                line("you're browsing Matteo Scaringella's portfolio.", 'term-dim');
            }
        },
        email: {
            desc: 'copy the email address',
            async run() {
                try {
                    await navigator.clipboard.writeText(email);
                    line(`copied to clipboard: ${email}`, 'term-ok');
                } catch (e) {
                    line(email);
                }
            }
        },
        theme: {
            desc: 'switch dark / light',
            usage: '[dark|light]',
            run(args) {
                const current = window.site.getTheme();
                const next = args[0] || (current === 'light' ? 'dark' : 'light');
                if (next !== 'dark' && next !== 'light') return line('usage: theme [dark|light]', 'term-error');
                window.site.setTheme(next);
                line(`theme set to ${next}`, 'term-dim');
            }
        },
        lang: {
            desc: 'switch english / français',
            usage: '[en|fr]',
            run(args) {
                const next = args[0] || (window.i18n.lang === 'fr' ? 'en' : 'fr');
                if (next !== 'en' && next !== 'fr') return line('usage: lang [en|fr]', 'term-error');
                window.i18n.setLang(next);
                line(`language set to ${next}`, 'term-dim');
            }
        },
        pwd: {
            desc: 'print working directory',
            run() { line(cwd.replace('~', '/home/visitor')); }
        },
        history: {
            desc: 'show command history',
            run() { history.forEach((h, i) => line(`${String(i + 1).padStart(4)}  ${h}`)); }
        },
        clear: {
            desc: 'clear the screen',
            run() { output.textContent = ''; }
        },
        exit: {
            desc: 'back to the site',
            run() { close(); }
        },
        echo: { hidden: true, run(args) { line(args.join(' ')); } },
        sudo: {
            hidden: true,
            run() { line('visitor is not in the sudoers file. This incident will be reported.', 'term-error'); }
        }
    };

    // The vault (assets/js/ctf.js): hidden files and its own commands
    window.CTF?.install({ commands, files, dirs, line, span, cmdLink, resolve });

    const aliases = { quit: 'exit', q: 'exit', dir: 'ls', ll: 'ls', cls: 'clear', goto: 'open' };

    async function runOne(raw) {
        const [name, ...args] = raw.trim().split(/\s+/);
        if (!name) return;
        const cmd = commands[aliases[name] || name];
        if (!cmd) return line(`command not found: ${name}. type 'help' to list commands.`, 'term-error');
        await cmd.run(args);
    }

    async function run(raw, { record = true } = {}) {
        if (raw.trim()) window.site.log(`$ ${raw.trim()}`);
        echo(raw);
        if (record && raw.trim()) {
            history.push(raw.trim());
            historyIndex = history.length;
        }
        // Supports "a && b" so clickable directory entries can cd then ls
        for (const part of raw.split('&&')) await runOne(part);
        renderPrompt();
    }

    // --- Completion ---

    function commonPrefix(words) {
        return words.reduce((a, b) => {
            let i = 0;
            while (i < a.length && a[i] === b[i]) i++;
            return a.slice(0, i);
        });
    }

    // Works out what the last word of the line can complete to
    function completionContext() {
        const tokens = input.value.split(/\s+/);
        const last = tokens[tokens.length - 1];
        const cmd = aliases[tokens[0]] || tokens[0];
        let candidates;
        let base = '';

        if (tokens.length === 1) {
            candidates = Object.keys(commands).filter(c => !commands[c].hidden);
        } else if (cmd === 'open') {
            candidates = [...Object.keys(sections).filter(k => k !== 'system'), 'github', 'htb', 'thm', 'pgp', 'mail'];
        } else if (cmd === 'lang') {
            candidates = ['en', 'fr'];
        } else if (cmd === 'theme') {
            candidates = ['dark', 'light'];
        } else {
            const slash = last.lastIndexOf('/');
            base = slash >= 0 ? last.slice(0, slash + 1) : '';
            candidates = dirs[resolve(base || '.')] || [];
            if (!last.slice(base.length).startsWith('.')) candidates = candidates.filter(c => !c.startsWith('.'));
            if (cmd === 'cd') candidates = candidates.filter(c => c.endsWith('/'));
        }

        const needle = last.slice(base.length);
        return {
            head: tokens.slice(0, -1).concat('').join(' ') + base,
            needle,
            isCommand: tokens.length === 1,
            matches: candidates.filter(c => c.startsWith(needle))
        };
    }

    // zsh-style menu: 1st Tab lists the matches, next Tabs cycle through them
    const menuEl = document.createElement('div');
    menuEl.className = 'term-menu';
    menuEl.setAttribute('role', 'listbox');
    form.after(menuEl);

    let menu = null; // { head, matches, index, original, items }

    function renderMenu(ctx) {
        menuEl.textContent = '';
        menuEl.classList.toggle('term-menu--described', ctx.isCommand);
        const items = ctx.matches.map((match, i) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'term-menu-item' + (match.endsWith('/') ? ' term-dir' : '');
            item.setAttribute('role', 'option');
            item.append(span(match, 'term-menu-name'));
            if (ctx.isCommand) item.append(span('-- ' + commands[match].desc, 'term-menu-desc'));
            // mousedown keeps focus in the input
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                select(i);
                acceptMenu();
            });
            menuEl.appendChild(item);
            return item;
        });
        termBody.scrollTop = termBody.scrollHeight;
        return items;
    }

    function select(index) {
        const n = menu.matches.length;
        menu.index = ((index % n) + n) % n;
        menu.items.forEach((item, i) => item.setAttribute('aria-selected', String(i === menu.index)));
        input.value = menu.head + menu.matches[menu.index];
        menu.items[menu.index].scrollIntoView({ block: 'nearest' });
    }

    function closeMenu({ restore = false } = {}) {
        if (!menu) return;
        if (restore) input.value = menu.original;
        menu = null;
        menuEl.textContent = '';
    }

    function acceptMenu() {
        const choice = menu.matches[menu.index];
        input.value = menu.head + choice + (choice.endsWith('/') ? '' : ' ');
        closeMenu();
    }

    // Number of columns in the menu grid, for up/down moves
    function menuColumns() {
        const top = menu.items[0].offsetTop;
        const cols = menu.items.findIndex(item => item.offsetTop !== top);
        return cols === -1 ? menu.items.length : cols;
    }

    function complete(step = 1) {
        if (menu) return select(menu.index + step);

        const ctx = completionContext();
        if (!ctx.matches.length) return;

        if (ctx.matches.length === 1) {
            const done = ctx.matches[0];
            input.value = ctx.head + done + (done.endsWith('/') ? '' : ' ');
            return;
        }

        // First Tab: extend to the common prefix and show the choices, nothing selected yet
        const original = input.value;
        input.value = ctx.head + commonPrefix(ctx.matches);
        menu = { head: ctx.head, matches: ctx.matches, index: -1, original };
        menu.items = renderMenu(ctx);
    }

    // --- Boot sequence ---

    function boot() {
        booted = true;
        const session = document.getElementById('session-id').textContent;
        const steps = [
            ['[ ok ] loading profile', 'term-dim'],
            [`[ ok ] mounting ~/projects (${projects.length}) and ~/writeups (${writeups.length})`, 'term-dim'],
            [`[ ok ] session ${session} established`, 'term-dim'],
            [''],
            ['scaringella.sh — interactive portfolio', ''],
            [null]
        ];
        const delay = reducedMotion ? 0 : 90;
        steps.forEach(([text, cls], i) => setTimeout(() => {
            if (text === null) {
                line([document.createTextNode('type '), cmdLink('help', 'help'),
                    document.createTextNode(' to list commands, or try '), cmdLink('ls', 'ls'),
                    document.createTextNode(' · '), cmdLink('cat about.txt', 'cat about.txt')]);
                line('');
            } else {
                line(text, cls);
            }
        }, i * delay));
    }

    // --- Open / close ---

    function open(from) {
        if (isOpen) return;
        isOpen = true;
        opener = from || null;

        // The terminal grows out of whatever opened it
        // (origin is set with transitions off, otherwise the circle slides in from the old origin)
        const r = from && from.getBoundingClientRect();
        term.style.transition = 'none';
        term.style.setProperty('--ox', r && r.width ? `${r.left + r.width / 2}px` : '50%');
        term.style.setProperty('--oy', r && r.width ? `${r.top + r.height / 2}px` : '50%');
        void term.offsetWidth;
        term.style.transition = '';

        body.classList.add('term-active');
        window.site.log('tty1 attached', 'nav');
        term.classList.add('open');
        term.setAttribute('aria-hidden', 'false');
        renderPrompt();
        if (!booted) boot();
        setTimeout(() => input.focus({ preventScroll: true }), reducedMotion ? 0 : 350);
    }

    function close() {
        if (!isOpen) return;
        isOpen = false;
        body.classList.remove('term-active');
        window.site.log('tty1 detached', 'nav');
        term.classList.remove('open');
        term.setAttribute('aria-hidden', 'true');
        input.blur();
        if (opener && opener.offsetParent) opener.focus({ preventScroll: true });
    }

    // --- Events ---

    document.querySelectorAll('[data-term-open]').forEach(btn => {
        btn.addEventListener('click', () => open(btn));
    });

    closeBtn.addEventListener('click', close);

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        closeMenu();
        const value = input.value;
        input.value = '';
        run(value);
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            complete(e.shiftKey ? -1 : 1);
            return;
        }

        // While the menu is open, arrows move the selection, Enter accepts, Esc cancels
        if (menu) {
            const selecting = menu.index !== -1;
            const moves = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: menuColumns(), ArrowUp: -menuColumns() };
            if (e.key in moves) {
                e.preventDefault();
                select(selecting ? menu.index + moves[e.key] : 0);
                return;
            }
            if (e.key === 'Enter' && selecting) {
                e.preventDefault();
                acceptMenu();
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                closeMenu({ restore: selecting });
                return;
            }
            // Any other key keeps what's in the line and leaves the menu
            if (!['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) closeMenu();
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (historyIndex > 0) input.value = history[--historyIndex];
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            historyIndex = Math.min(history.length, historyIndex + 1);
            input.value = history[historyIndex] || '';
        } else if (e.ctrlKey && e.key.toLowerCase() === 'l') {
            e.preventDefault();
            output.textContent = '';
        } else if (e.ctrlKey && e.key.toLowerCase() === 'c' && input.selectionStart === input.selectionEnd) {
            e.preventDefault();
            echo(input.value + '^C');
            input.value = '';
        }
    });

    input.addEventListener('blur', () => closeMenu());

    // Clicking anywhere in the terminal (but not on a selection) focuses the prompt
    termBody.addEventListener('click', () => {
        if (!window.getSelection().toString()) input.focus({ preventScroll: true });
    });

    document.addEventListener('keydown', (e) => {
        if (isOpen && e.key === 'Escape') {
            e.preventDefault();
            close();
            return;
        }
        // "t" opens the terminal from anywhere on the site
        const typing = e.target.closest && e.target.closest('input, textarea, [contenteditable]');
        if (!isOpen && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 't') {
            e.preventDefault();
            open(document.querySelector('.term-open--bar').offsetParent
                ? document.querySelector('.term-open--bar')
                : document.querySelector('.term-open--header'));
            opener = null; // opened from the keyboard: don't move focus to a button on close
        }
    });
})();
