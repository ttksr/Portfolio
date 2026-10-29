#!/usr/bin/env bash
# Leak guard for this repository. Refuses anything that must never become public:
#   - private keys (PGP, SSH, RSA/EC/PKCS#8) and PGP revocation certificates;
#   - CTF flags in clear (compared by SHA-256 with the digests in assets/js/ctf.js,
#     so this script never contains a flag itself);
#   - files from the private folders (KeysPortfolio, CTF-private) or typical secret files.
#
# Usage:
#   check-secrets.sh --staged    files about to be committed (pre-commit hook)
#   check-secrets.sh --all       every tracked file (CI)
#   check-secrets.sh --history   every version of every file in the whole history
#
# Exit code 1 if something is found.

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

MODE="${1:---staged}"
FAIL=0

# The only flag allowed in clear: lock 1's, inside the vault's README (finding it is the challenge)
ALLOWED_FILE='assets/ctf/README.txt'

# Flag digests, read from the CTF engine (lock 1 is the first one)
mapfile -t DIGESTS < <(grep -oE "digest: '[0-9a-f]{64}'" assets/js/ctf.js | grep -oE '[0-9a-f]{64}')
LOCK1="${DIGESTS[0]:-}"

# Paths that must never be tracked
BAD_PATHS='(^|/)(KeysPortfolio|CTF-private)(/|$)|(^|/)(private-key\.asc|gen_vault\.py|solve_vault\.py|SOLUTIONS\.md|\.env(\..*)?)$|\.(rev|pem|key|p12|pfx|gpg)$|(^|/)id_(rsa|ed25519|ecdsa)$'

# Content markers of private material. They are assembled from pieces so that this file never
# contains a marker in one piece (otherwise the guard would block itself).
DASHES='-----'
BEGIN="${DASHES}BEGIN "
KEYS='(PGP PRIVATE KEY BLOCK|OPENSSH PRIVATE KEY|RSA PRIVATE KEY|EC PRIVATE KEY|DSA PRIVATE KEY|PRIVATE KEY|ENCRYPTED PRIVATE KEY)'
REVOKED='This is a revo''cation certificate'
BAD_CONTENT="${BEGIN}${KEYS}${DASHES}|${REVOKED}"

report() { printf '  \033[31m✗\033[0m %s\n' "$1"; FAIL=1; }

# $1 = label (path or commit:path), $2 = path, content on stdin.
# Called with a here-string, never at the end of a pipe: a pipe would run it in a subshell
# and FAIL would be lost.
check_content() {
    local label="$1" path="$2" content
    content="$(cat)"
    if grep -qE -- "$BAD_CONTENT" <<<"$content"; then
        report "$label: private key or revocation certificate"
    fi
    while read -r flag; do
        [ -z "$flag" ] && continue
        local h
        h="$(printf '%s' "$flag" | sha256sum | cut -d' ' -f1)"
        for d in "${DIGESTS[@]}"; do
            if [ "$h" = "$d" ] && ! { [ "$h" = "$LOCK1" ] && [ "$path" = "$ALLOWED_FILE" ]; }; then
                report "$label: CTF flag in clear"
            fi
        done
    done < <(grep -oE 'SCA\{[^}[:space:]]{1,100}\}' <<<"$content" || true)
}

case "$MODE" in
    --staged)
        while IFS= read -r f; do
            grep -qE "$BAD_PATHS" <<<"$f" && report "$f: private file (must stay outside the repository)"
            check_content "$f" "$f" <<<"$(git show ":$f" 2>/dev/null | grep -I '' || true)"
        done < <(git diff --cached --name-only --diff-filter=ACMR)
        ;;
    --all)
        while IFS= read -r f; do
            grep -qE "$BAD_PATHS" <<<"$f" && report "$f: private file (must stay outside the repository)"
            check_content "$f" "$f" <<<"$(grep -I '' "$f" || true)"
        done < <(git ls-files)
        ;;
    --history)
        while IFS= read -r c; do
            while IFS= read -r f; do
                grep -qE "$BAD_PATHS" <<<"$f" && report "${c:0:7}:$f: private file in history"
                check_content "${c:0:7}:$f" "$f" <<<"$(git show "$c:$f" 2>/dev/null | grep -I '' || true)"
            done < <(git show --name-only --diff-filter=ACMR --format= "$c")
        done < <(git rev-list --all)
        ;;
    *)
        echo "usage: $0 [--staged|--all|--history]" >&2
        exit 2
        ;;
esac

if [ "$FAIL" -ne 0 ]; then
    echo
    echo "Leak guard: blocked. Remove the items above (git restore --staged <file>)."
    echo "If it's already in a pushed commit, the secret must be considered public: rotate it."
    exit 1
fi
echo "Leak guard: nothing private found (${MODE#--})."
