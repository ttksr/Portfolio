# Matteo Scaringella — Portfolio

Personal portfolio of a cybersecurity student at Ynov: projects, CTF writeups, certifications,
and a small live astronomy lab. Hand-written HTML, CSS and JavaScript, no framework, no build step,
no third-party request.

**Live:** https://matteoscaringella.dev/

---

## Features

- **Single screen, no scrolling.** Seven panels that swap in place with animated transitions,
  navigable by menu, keyboard (`←` `→`, `0`–`6`), mouse wheel or swipe. Deep links work (`#writeups`).
- **Terminal mode.** Press `t` (or click `>_`): the whole site becomes a shell — `ls`, `cd`, `cat`,
  `open`, zsh-style tab completion with a selectable menu, history. It reads the same content as the page.
- **The Vault.** A small CTF hidden in the site — four locks, from beginner to expert
  (recon, classical crypto, signal analysis, reversing a custom VM). Type `ctf` in the terminal.
  Only the SHA-256 digests of the flags are shipped.
- **Session log.** A live, access-log style trace of what the visitor does (`GET /about`,
  `inspect secure-chat.md`), also readable with `cat session.log`.
- **Lab — HD 110067.** A real-time view of six exoplanets, computed from the published transit
  ephemerides (Luque et al. 2023, *Nature* 623). Interactive orbits, transit countdowns and light curves,
  and per-pixel rendered close-ups of each planet and of the star, with Earth to scale.
- **FR / EN**, dark / light theme, both remembered.

## Security & privacy

The site is small, but treated like production:

- **No third party.** Fonts are self-hosted (SIL OFL licences in `assets/fonts/`); no CDN, no analytics,
  no cookies, no tracker. The browser never talks to another domain.
- **Strict Content-Security-Policy** (meta tag):
  `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; require-trusted-types-for 'script'; trusted-types 'none'; upgrade-insecure-requests`.
  No inline script — even the pre-paint theme script lives in its own file (`boot.js`).
- **No markup injection, enforced by the browser.** The CSP requires **Trusted Types** with no policy
  allowed (`require-trusted-types-for 'script'; trusted-types 'none'`): `innerHTML` and the other DOM
  XSS sinks simply refuse strings. The code builds everything with DOM nodes; links from the content
  file are restricted to `http(s)`, `mailto` and relative paths.
- **[`/.well-known/security.txt`](.well-known/security.txt)** (RFC 9116) with a contact and an encryption key,
  **signed with the PGP key** below (`gpg --verify security.txt`).
- **PGP key** published in [`assets/pgp/pubkey.asc`](assets/pgp/pubkey.asc) —
  fingerprint `61BF A2DD D908 3789 7E6B  8B1A FD46 6D32 77FE 602F`.
- `rel="noopener noreferrer"` on external links, strict referrer policy.
- **HTTP security headers** (Cloudflare Pages, [`_headers`](_headers)): the same CSP plus `frame-ancestors 'none'`,
  HSTS, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
  `Cross-Origin-Opener-Policy` / `Cross-Origin-Resource-Policy`. The `.dev` TLD is itself HSTS-preloaded:
  browsers never reach the site over plain HTTP.
- **Domain:** DNSSEC-signed zone, and anti-spoofing for a domain that sends no mail
  (SPF `-all`, DMARC `p=reject`, empty DKIM key).
- Results (2026-10-29):
  - **A+** on [securityheaders.com](https://securityheaders.com/?q=matteoscaringella.dev&followRedirects=on)
  - **A+ (145/100)** on [Mozilla Observatory](https://developer.mozilla.org/en-US/observatory/analyze?host=matteoscaringella.dev)
  - **100 %** on the [internet.nl](https://internet.nl/mail/matteoscaringella.dev/) email test (Hall of Fame)
  - **95 %** on the [internet.nl](https://internet.nl/site/matteoscaringella.dev/) website test — the two remaining
    points (cipher-suite order, SHA-1 accepted for the TLS 1.2 key-exchange signature) are fixed at Cloudflare's
    edge and can't be changed on the free plan; modern browsers negotiate TLS 1.3 (AES-256-GCM) anyway.

## Leak guard

The repository sits next to private material (the PGP private key, the CTF solutions), so leaks are
blocked twice:

- **Before each commit** — [`.githooks/check-secrets.sh`](.githooks/check-secrets.sh) refuses private
  keys, revocation certificates, private files, and CTF flags in clear. Flags are recognised by their
  SHA-256 (the digests already in `ctf.js`), so the guard itself contains no flag. Enable it once per clone:
  `git config core.hooksPath .githooks`
- **On every push** — the [Leak guard workflow](.github/workflows/leak-guard.yml) runs the same rules on
  every file and on the whole history, then [gitleaks](https://github.com/gitleaks/gitleaks) (binary
  checked against its published SHA-256 before running).

## Static analysis

[CodeQL](.github/workflows/codeql.yml) analyses the JavaScript (`security-extended` queries) and the
GitHub Actions workflows on every push and every Monday. Results are in the repository's Security tab.

## Accessibility & performance

- Lighthouse on the live site (2026-10-29): **100 / 100 / 100** on desktop for performance, accessibility
  and best practices; on mobile, 97 for performance and 100 for the rest. (SEO will read 100 once the
  temporary `noindex` is lifted.)
- Colours meet WCAG AA contrast in both themes.
- Fully keyboard-usable; focus moves to each section's title on navigation and back to the opener when
  a detail view closes. Animated titles keep a clean text alternative for screen readers.
- `prefers-reduced-motion` is respected.
- Without JavaScript, the page falls back to a plain, readable, scrolling document.

## Editing the content

Everything editorial lives in **one file: [`assets/data/content.js`](assets/data/content.js)** —
profile and links, projects (with their detail pages), writeups, certifications, education.
Texts that change with the language are written `{ en: '…', fr: '…' }`; empty fields are hidden.
The page and the terminal both read from it.

Interface texts (menus, buttons, section intros) are in `assets/js/i18n.js`.

## Structure

```
index.html                 the page (seven panels)
404.html                   custom "not found" page
.well-known/security.txt   security contact (RFC 9116)
_headers                   HTTP security headers (Cloudflare Pages)
assets/
  data/content.js          ← site content
  css/                     reset, self-hosted fonts, design tokens, styles, no-JS fallback
  js/
    boot.js                theme + language before first paint
    i18n.js                FR / EN
    sections.js            projects, writeups, certifications (built from content.js)
    main.js                panels, navigation, background, cursor, session log
    system.js              HD 110067 lab: ephemerides, orbit view, planet rendering
    terminal.js            terminal mode
    ctf.js                 the vault: progress, hints, and the VM for lock 4
  fonts/                   Inter, JetBrains Mono (woff2, latin)
  img/                     link preview, touch icon
  pgp/pubkey.asc           public key
  ctf/                     the vault's files (challenge material, no flags in clear)
```

## Run locally

Any static server works; from the repository root:

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

(Hosted on Cloudflare Pages: the custom 404 page and the `_headers` file only apply there.)

## Credits

- Planetary data: R. Luque et al., *A resonant sextuplet of sub-Neptunes transiting the bright star
  HD 110067*, Nature 623, 932–937 (2023).
- Fonts: [Inter](https://github.com/rsms/inter) and [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono),
  SIL Open Font License 1.1.

## License

Code under the [MIT license](LICENSE). Personal content (texts, writeups, images), the CTF material and
the PGP key are not covered: all rights reserved. Fonts keep their own SIL Open Font License.

© Matteo Scaringella
