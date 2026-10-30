// The Vault — a small CTF hidden in the terminal: four locks, from beginner to expert.
//
// No flag is stored here: only their SHA-256 digests, compared with what players submit.
// The vault's files live in assets/ctf/. The virtual machine below is part of lock 4:
// reading this file is allowed (and, for that lock, necessary).

(() => {
    const BASE = 'assets/ctf/';

    const LOCKS = [
        { name: 'recon', level: 'beginner', digest: '7381cdd797599e08092a9f4a44189a441870a5cdcf698d26c28cb345b0acdd14' },
        { name: 'combination', level: 'intermediate', digest: '45fe86b72c49eb68b565d37e39b71b54da1971e9e714fcc94eb3520bda28bfdc' },
        { name: 'signal', level: 'advanced', digest: '461a41f1060f9cc0a4fdf9a8cc6d5ff4385db522d4d3e8f203ea4de8064865ff' },
        { name: 'lock', level: 'expert', digest: 'ce5a61bc1d64969c88ffbf23dfdf6be0e52807e48e44c287b2bed5b978308c94' }
    ];

    // Three hints per lock, from a nudge to a near-solution
    const HINTS = [
        [
            'Every site has files meant for robots, not for people. And comments meant for nobody.',
            'robots.txt mentions something that was moved. Hidden files are hidden, not gone.',
            'In this terminal: ls -a, then cd .vault'
        ],
        [
            'The note is sealed with a Vigenère variant that uses digits instead of letters.',
            'It’s the Gronsfeld cipher. The key is the dial’s combination — and the dial learned it in the Lab.',
            'Read the resonance chain left to right, both numbers of every ratio: ten digits.'
        ],
        [
            'Plot the flux. The dips are evenly spaced, but not all equally deep.',
            'Four depths: two bits per transit, most significant pair first. Eight bits make a character.',
            'Measure each dip against the flux just before and after it (the baseline drifts), then round to the nearest of four levels.'
        ],
        [
            'lock.bin is bytecode for the vault’s VM. The VM is in assets/js/ctf.js: every opcode is in its switch.',
            'Write a disassembler. Some instructions do nothing useful. The program checks the input one byte at a time and only answers at the very end.',
            'Each check is t = f(in[i], in[i-1]) == c, built from XOR, ADD, ROL and MUL. Invert f from the first byte (in[-1] = 0). The multipliers are odd: they have an inverse mod 256.'
        ]
    ];

    const VAULT_FILES = ['README.txt', 'lock.txt', 'signal.csv', 'lock.bin'];

    // --- Progress, kept in the browser only ---

    const KEY = 'vault';
    // "started": the player typed `ctf` at least once (the dial only shows its lock marks from then on)
    let state = { solved: [false, false, false, false], hints: [0, 0, 0, 0], started: false };
    try { state = { ...state, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) { }
    if (state.solved.includes(true)) state.started = true;
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { } };

    // The vault dial (main.js) mirrors the progress; "fresh" marks a lock opened just now
    const emit = (fresh) => document.dispatchEvent(new CustomEvent('vaultprogress', {
        detail: { solved: state.solved.slice(), started: !!state.started, fresh }
    }));
    emit(false);
    window.addEventListener('storage', (e) => {
        if (e.key !== KEY) return;
        try { state = { ...state, ...JSON.parse(e.newValue || '{}') }; } catch (err) { }
        emit(false);
    });

    async function sha256(text) {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async function fetchFile(name, as = 'text') {
        const res = await fetch(BASE + name);
        if (!res.ok) throw new Error(`${name}: ${res.status}`);
        return as === 'bytes' ? new Uint8Array(await res.arrayBuffer()) : res.text();
    }

    // --- The vault VM (lock 4) ---
    // A tiny stack machine on bytes. Program = "VLT1" magic + code. It returns true only if the
    // value on top of the stack is 1 when END is reached.

    function vm(bytes, input) {
        if (String.fromCharCode(...bytes.slice(0, 4)) !== 'VLT1') throw new Error('bad magic');
        const code = bytes.slice(4);
        const inp = new TextEncoder().encode(input);
        const stack = [];
        const reg = [0, 0, 0, 0];
        const push = v => stack.push(v & 0xFF);
        const pop = () => (stack.length ? stack.pop() : 0);
        let pc = 0;
        let steps = 0;

        while (pc < code.length && steps++ < 100000) {
            const op = code[pc++];
            switch (op) {
                case 0x01: push(code[pc++]); break;                                     // PUSH imm
                case 0x02: { const i = code[pc++]; push(i < inp.length ? inp[i] : 0); break; } // IN idx
                case 0x03: push(inp.length); break;                                     // LEN
                case 0x10: { const b = pop(), a = pop(); push(a + b); break; }          // ADD
                case 0x11: { const b = pop(), a = pop(); push(a - b); break; }          // SUB
                case 0x12: { const b = pop(), a = pop(); push(a ^ b); break; }          // XOR
                case 0x13: { const b = pop(), a = pop(); push(a * b); break; }          // MUL
                case 0x14: { const n = code[pc++] & 7, a = pop(); push((a << n) | (a >> (8 - n))); break; } // ROL n
                case 0x20: { const a = pop(); push(a); push(a); break; }                // DUP
                case 0x21: { const b = pop(), a = pop(); push(b); push(a); break; }     // SWAP
                case 0x22: pop(); break;                                                // DROP
                case 0x30: reg[code[pc++] & 3] = pop(); break;                          // ST r
                case 0x31: push(reg[code[pc++] & 3]); break;                            // LD r
                case 0x40: { const b = pop(), a = pop(); push(a === b ? 1 : 0); break; } // EQ
                case 0x41: { const b = pop(), a = pop(); push(a & b); break; }          // AND
                case 0xF0: return pop() === 1;                                          // END
                default: throw new Error(`illegal opcode 0x${op.toString(16)} at ${pc - 1}`);
            }
        }
        return false;
    }

    function hexdump(bytes) {
        const rows = [];
        for (let o = 0; o < bytes.length; o += 16) {
            const chunk = [...bytes.slice(o, o + 16)];
            const hex = chunk.map(b => b.toString(16).padStart(2, '0')).join(' ');
            const ascii = chunk.map(b => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('');
            rows.push(`${o.toString(16).padStart(8, '0')}  ${hex.padEnd(47)}  ${ascii}`);
        }
        return rows.join('\n');
    }

    // --- Terminal integration ---

    function install({ commands, files, dirs, line, span, cmdLink, resolve, close }) {
        const log = msg => window.site?.log?.(msg);

        // A hidden directory: only `ls -a` shows it
        dirs['~'].push('.vault/');
        dirs['~/.vault'] = [...VAULT_FILES];
        files['~/.vault/README.txt'] = () => fetchFile('README.txt');
        files['~/.vault/lock.txt'] = () => fetchFile('lock.txt');
        files['~/.vault/signal.csv'] = async () => {
            const rows = (await fetchFile('signal.csv')).trim().split('\n');
            return rows.slice(0, 10).join('\n') + `\n… ${rows.length - 2} rows in total — run 'download signal.csv' to analyse it`;
        };
        files['~/.vault/lock.bin'] = async () => hexdump(await fetchFile('lock.bin', 'bytes')) +
            "\n\nbytecode for the vault VM — try 'run lock.bin <input>'";

        function status() {
            line('THE VAULT — four locks, from beginner to expert.', 'term-accent');
            LOCKS.forEach((l, i) => {
                line([
                    span(`  ${i + 1}  ${l.name.padEnd(13)}${l.level.padEnd(14)}`, ''),
                    span(state.solved[i] ? '● open' : '○ locked', state.solved[i] ? 'term-ok' : 'term-dim')
                ], 'term-pre');
            });
            line('');
            line('submit <flag> · hint · ctf reset          flags look like SCA{…}', 'term-dim');
            if (!state.solved.includes(true)) {
                line('Start where every attacker starts: with what the site doesn’t show you.');
            }
        }

        commands.ctf = {
            desc: 'the vault — a small CTF',
            async run(args) {
                if (args[0] === 'reset') {
                    state = { solved: [false, false, false, false], hints: [0, 0, 0, 0], started: true };
                    save();
                    emit(false);
                    return line('progress reset.', 'term-dim');
                }
                if (!state.started) {
                    state.started = true;
                    save();
                    emit(false);
                }
                status();
            }
        };

        commands.submit = {
            hidden: true,
            async run(args) {
                const flag = args.join(' ').trim();
                if (!flag) return line('usage: submit SCA{…}', 'term-error');
                if (!(window.crypto && crypto.subtle)) return line('submit needs https (or localhost).', 'term-error');
                const digest = await sha256(flag);
                const i = LOCKS.findIndex(l => l.digest === digest);
                if (i === -1) return line('wrong flag.', 'term-error');
                if (state.solved[i]) return line(`lock ${i + 1} is already open.`, 'term-dim');
                state.solved[i] = true;
                save();
                emit(true);
                log(`ctf: lock ${i + 1} opened`);
                line(`lock ${i + 1}/4 · ${LOCKS[i].name} — opened (${LOCKS[i].level}).`, 'term-ok');
                if (state.solved.every(Boolean)) {
                    line('');
                    line('All four locks are open. Well played.', 'term-accent');
                    line([document.createTextNode('Last step, off the record: encrypt your lock 4 flag with my PGP key ('),
                        cmdLink('cat pubkey.asc', 'cat ~/pubkey.asc'),
                        document.createTextNode(') and mail it to me. I’ll answer.')]);
                } else {
                    const next = state.solved.indexOf(false);
                    line(`next: lock ${next + 1} · ${LOCKS[next].name} (${LOCKS[next].level}).`, 'term-dim');
                }
                // Step out of the terminal so the dial can show the lock opening (this output stays here)
                const last = state.solved.every(Boolean);
                line(last ? 'closing the terminal… watch the dial. (press t to come back to this message)'
                    : 'closing the terminal… watch the dial.', 'term-dim');
                setTimeout(() => {
                    if (!document.body.classList.contains('term-active')) return;
                    if (document.body.dataset.panel !== 'top') window.site?.goTo?.(0);
                    close?.();
                }, last ? 4000 : 2000);
            }
        };

        commands.hint = {
            hidden: true,
            run() {
                const i = state.solved.indexOf(false);
                if (i === -1) return line('nothing left to hint: the vault is open.', 'term-dim');
                const n = Math.min(state.hints[i], HINTS[i].length - 1);
                line(`hint ${n + 1}/${HINTS[i].length} · lock ${i + 1} (${LOCKS[i].level})`, 'term-dim');
                line(HINTS[i][n]);
                if (state.hints[i] < HINTS[i].length) state.hints[i]++;
                save();
                log(`ctf: hint ${n + 1} for lock ${i + 1}`);
            }
        };

        commands.download = {
            hidden: true,
            usage: '<file>',
            run(args) {
                const path = resolve(args[0] || '');
                const name = path.replace('~/.vault/', '');
                if (!path.startsWith('~/.vault/') || !VAULT_FILES.includes(name)) {
                    return line(`download: ${args[0] || '?'}: nothing to download here`, 'term-error');
                }
                const a = document.createElement('a');
                a.href = BASE + name;
                a.download = name;
                document.body.appendChild(a);
                a.click();
                a.remove();
                line(`downloading ${name}…`, 'term-dim');
            }
        };

        commands.run = {
            hidden: true,
            usage: '<program> [input]',
            async run(args) {
                const path = resolve(args[0] || '');
                if (path !== '~/.vault/lock.bin') return line(`run: ${args[0] || '?'}: not an executable`, 'term-error');
                const input = args.slice(1).join(' ');
                let granted;
                try {
                    granted = vm(await fetchFile('lock.bin', 'bytes'), input);
                } catch (e) {
                    return line(`run: ${e.message}`, 'term-error');
                }
                log(`ctf: run lock.bin → ${granted ? 'granted' : 'denied'}`);
                if (!granted) return line('ACCESS DENIED', 'term-error');
                line('ACCESS GRANTED', 'term-ok');
                line('That input is the lock 4 flag: submit it.', 'term-dim');
            }
        };
    }

    window.CTF = { install };
})();
