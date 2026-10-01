#!/usr/bin/env python3
"""Stops secrets from being committed.

    python scripts/check_secrets.py            # the files staged for commit
    python scripts/check_secrets.py --all      # every tracked file (CI)
    python scripts/check_secrets.py FILE...    # these files

Blocks: .env files, private keys, and values shaped like Twilio / Supabase /
Google / GitHub / AWS / Resend keys, JWTs, KEY=value assignments with a real
looking value, and database URLs with a password. Prints file, line and the
kind of secret, never the value. Exit 1 if anything is found.

A line that is deliberately fake can carry `secret-scan: allow`.
Standard library only, so it runs anywhere (copied as-is into both repos).
"""
import re
import subprocess
import sys

BLOCKED_NAMES = re.compile(r"(^|/)(\.env(\..+)?|.*\.pem|.*\.p12|id_rsa|id_ed25519)$")
ALLOWED_NAMES = re.compile(r"(^|/)\.env\.(example|sample|template)$")
SKIP_PATHS = re.compile(r"(^|/)(node_modules|\.next|\.git|__pycache__)/|\.(png|jpe?g|gif|ico|svg|woff2?|lock|pdf|bundle)$|(^|/)(package-lock\.json|pnpm-lock\.yaml)$")
SKIP_THIS = re.compile(r"(^|/)(check_secrets\.py|check_secret_scan\.py)$")

# Obvious stand-ins that are not secrets.
PLACEHOLDER = re.compile(r"(your|example|changeme|xxx|placeholder|dummy|fake|test|<|\{\{|\$\{|os\.getenv|process\.env|\bpw\b|password|secret$)", re.I)

PATTERNS = [
    ("private key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("Twilio account SID", re.compile(r"\bAC[0-9a-f]{32}\b")),
    ("Supabase secret key", re.compile(r"\bsb_secret_[A-Za-z0-9_\-]{8,}")),
    ("Google API key", re.compile(r"\bAIza[0-9A-Za-z_\-]{30,}\b")),
    ("GitHub token", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}\b")),
    ("AWS access key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("Resend key", re.compile(r"\bre_[A-Za-z0-9]{20,}\b")),
    ("secret-style key (sk_/sk-)", re.compile(r"\bsk[-_](live|test|proj)[-_][A-Za-z0-9]{16,}")),
    ("JWT", re.compile(r"\beyJ[A-Za-z0-9_\-]{15,}\.[A-Za-z0-9_\-]{15,}\.[A-Za-z0-9_\-]{8,}")),
    ("database URL with password", re.compile(r"postgres(?:ql)?://[^\s:'\"/@]+:([^\s@'\"]+)@")),
    ("secret assigned in code or env", re.compile(r"\b(TWILIO_TOKEN|TWILIO_SID|SUPABASE_KEY|SUPABASE_SERVICE_ROLE_KEY|GEMINI_API_KEY|RESEND_API_KEY|DATABASE_URL|REPORT_CRON_SECRET)\s*[:=]\s*['\"]?([A-Za-z0-9_\-\.:/@+]{16,})")),
]


def files_to_scan(argv):
    if argv and argv[0] == "--all":
        out = subprocess.run(["git", "ls-files"], capture_output=True, text=True).stdout
    elif argv:
        return argv
    else:
        out = subprocess.run(["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR"], capture_output=True, text=True).stdout
    return [f for f in out.split("\n") if f]


def scan(paths):
    found = []

    for path in paths:
        if SKIP_THIS.search(path):
            continue

        if BLOCKED_NAMES.search(path) and not ALLOWED_NAMES.search(path):
            found.append((path, 0, "secret-bearing file (.env / key file)"))
            continue

        if SKIP_PATHS.search(path):
            continue

        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as handle:
                lines = handle.read().split("\n")
        except OSError:
            continue

        for number, line in enumerate(lines, 1):
            if "secret-scan: allow" in line:
                continue

            for kind, pattern in PATTERNS:
                match = pattern.search(line)

                if not match:
                    continue

                value = match.group(match.lastindex) if match.lastindex else match.group(0)

                if kind in ("secret assigned in code or env", "database URL with password") and PLACEHOLDER.search(value):
                    continue

                found.append((path, number, kind))
                break

    return found


def main(argv):
    found = scan(files_to_scan(argv))

    if not found:
        return 0

    print("Possible secrets found (values not shown):")

    for path, number, kind in found:
        where = f"{path}:{number}" if number else path
        print(f"  {where}  {kind}")

    print(
        "\nDon't commit these. Move the value to the environment (Render / Vercel / a "
        "local .env that is gitignored). If it was already pushed, rotate it. "
        "A deliberately fake line can carry 'secret-scan: allow'."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
