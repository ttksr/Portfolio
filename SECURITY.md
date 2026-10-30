# Security policy

Thank you for taking the time to look. This policy covers **https://matteoscaringella.dev** and this
repository.

## Reporting a vulnerability

Please report privately, never in a public issue:

- **GitHub** — [Report a vulnerability](https://github.com/ttksr/Portfolio/security/advisories/new)
  (private vulnerability reporting), or
- **Email** — mat.scaringella@gmail.com, ideally encrypted with my PGP key:
  [`pubkey.asc`](https://matteoscaringella.dev/assets/pgp/pubkey.asc),
  fingerprint `61BF A2DD D908 3789 7E6B  8B1A FD46 6D32 77FE 602F`.

Please include what you found, where, how to reproduce it, and its impact as you see it.

## What to expect

- An acknowledgement within **5 days**.
- An assessment, and a fix for confirmed issues, as fast as the issue warrants — usually within 30 days.
- Credit below once fixed, if you want it (name or handle, and a link).

This is a personal site maintained by a student: there is no bug bounty, only sincere thanks.

## Scope

In scope:

- the website and its client-side code (XSS, CSP or Trusted Types bypass, header weaknesses, open
  redirects, information leaks…);
- this repository (secrets, workflow weaknesses, supply-chain issues);
- **the CTF itself**: the vault is a game, so solving it is not a vulnerability — but getting a flag
  *without* solving its lock (a leak, a shortcut, a bug in the checks) is, and I'd love to hear about it.

Out of scope:

- Cloudflare's or GitHub's own infrastructure, and the TLS settings imposed by Cloudflare's free plan
  (cipher-suite order, SHA-1 for the TLS 1.2 key-exchange signature);
- denial of service, load or volumetric testing, automated scanning that generates heavy traffic;
- social engineering, phishing, physical attacks;
- missing best practices with no demonstrable impact.

## Safe harbor

Good-faith research that respects this policy — no data destruction, no service degradation, no
privacy violation, reasonable time to fix before any disclosure — is welcome, and I will not take any
action against it.

## Acknowledgments

People who reported a vulnerability, and people who opened all four locks of the vault and sent me the
last flag encrypted with my key:

*Nobody yet — be the first.*
