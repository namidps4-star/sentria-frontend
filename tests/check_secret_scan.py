"""The secret scanner (scripts/check_secrets.py): catches secret-shaped
values, ignores placeholders, never prints a value, and the pre-commit hook
really blocks a commit.

    python tests/check_secret_scan.py
"""
import os
import subprocess
import sys
import tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SCRIPT = os.path.join(ROOT, "scripts", "check_secrets.py")
HOOK = os.path.join(ROOT, ".githooks", "pre-commit")
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import check_secrets as cs  # noqa: E402

failures = 0


def check(label, ok, detail=""):
    global failures
    failures += not ok
    print(f"{'PASS' if ok else 'FAIL'} {label}" + (f"\n     {detail}" if detail and not ok else ""))


tmp = tempfile.mkdtemp()


def write(name, text):
    path = os.path.join(tmp, name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as handle:
        handle.write(text)
    return path


def kinds(name, text):
    return [k for _, _, k in cs.scan([write(name, text)])]


# Built from pieces so this file itself holds no secret-shaped literal.
twilio = "AC" + "0123456789abcdef" * 2
supa = "sb_" + "secret_" + "A1b2C3d4E5f6G7h8"
jwt = "ey" + "J" + "hbGciOiJIUzI1NiJ9" + "." + "eyJ" + "yb2xlIjoiYW5vbiIsImV4cCI6MX0" + "." + "abcDEF123456xyz"
goog = "AI" + "za" + "SyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q"

print("== it catches")
check("a .env file, by name", [k for _, _, k in cs.scan([write(".env", "A=1")])] == ["secret-bearing file (.env / key file)"])
check("a .env.production file", cs.scan([write(".env.production", "A=1")]) != [])
check("but .env.example is allowed", cs.scan([write(".env.example", "TWILIO_TOKEN=your-token-here")]) == [])
check("a private key file by name", cs.scan([write("keys/server.pem", "x")]) != [])
check("a Twilio SID", "Twilio account SID" in kinds("a.py", f'sid = "{twilio}"'))
check("a Supabase secret key", "Supabase secret key" in kinds("a.py", f'k = "{supa}"'))
check("a JWT", "JWT" in kinds("a.ts", f'const t = "{jwt}"'))
check("a Google API key", "Google API key" in kinds("a.py", f'g = "{goog}"'))
check("a private key block", "private key" in kinds("a.txt", "-----BEGIN RSA PRIVATE KEY-----\nabc"))
check("a real-looking TWILIO_TOKEN assignment", "secret assigned in code or env" in kinds("a.env.txt", "TWILIO_TOKEN=83669abcdef0123456789abcdef01234"))
check("a database URL with a password", "database URL with password" in kinds("a.py", 'u = "postgresql://postgres:Sup3rS3cretPw99@db.example.supabase.co:5432/postgres"'))

print("== it leaves alone")
check("placeholders", kinds("a.md", "TWILIO_TOKEN=your-twilio-token-here") == [] and kinds("a.md", "GEMINI_API_KEY=<paste key>") == [])
check("reading from the environment", kinds("a.py", 'TWILIO_TOKEN = os.getenv("TWILIO_TOKEN")') == [] and kinds("a.ts", "const k = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY") == [])
check("a fake test URL", kinds("t.py", 'u = "postgres://user:pw@host/db"') == [])
check("a line marked secret-scan: allow", kinds("t.py", f'x = "{twilio}"  # secret-scan: allow') == [])
check("lockfiles and images", cs.scan([write("pnpm-lock.yaml", f"x: {twilio}"), write("logo.png", f"{twilio}")]) == [])
check("ordinary code", kinds("a.py", "def f(x):\n    return x * 2\nname = 'AB' + 'CD'") == [])

print("== it never prints the value")
bad = write("leak.py", f'sid = "{twilio}"\nk = "{supa}"\n')
run = subprocess.run([sys.executable, SCRIPT, bad], capture_output=True, text=True)
check("exit code 1", run.returncode == 1)
check("shows file, line and kind", "leak.py:1" in run.stdout and "Twilio account SID" in run.stdout and "leak.py:2" in run.stdout, run.stdout)
check("shows no part of either secret", twilio[:8] not in run.stdout and supa[-8:] not in run.stdout and twilio not in run.stderr, run.stdout)
check("clean files exit 0", subprocess.run([sys.executable, SCRIPT, write("ok.py", "x = 1")]).returncode == 0)

print("== the hook blocks a real commit")
repo = tempfile.mkdtemp()
os.makedirs(os.path.join(repo, "scripts"))
os.makedirs(os.path.join(repo, ".githooks"))
for src, dst in ((SCRIPT, "scripts/check_secrets.py"), (HOOK, ".githooks/pre-commit")):
    with open(src) as a, open(os.path.join(repo, dst), "w") as b:
        b.write(a.read())
os.chmod(os.path.join(repo, ".githooks/pre-commit"), 0o755)
git = lambda *a: subprocess.run(["git", "-C", repo, "-c", "user.email=t@t", "-c", "user.name=t", *a], capture_output=True, text=True)
git("init", "-q")
git("config", "core.hooksPath", ".githooks")
with open(os.path.join(repo, "app.py"), "w") as f:
    f.write(f'sid = "{twilio}"\n')
git("add", "app.py")
r = git("commit", "-m", "leak")
check("a commit with a secret is refused", r.returncode != 0 and "Possible secrets" in (r.stdout + r.stderr), r.stdout + r.stderr)
check("and nothing was committed", git("rev-list", "--all", "--count").stdout.strip() in ("0", ""), git("log", "--oneline").stdout)
with open(os.path.join(repo, "app.py"), "w") as f:
    f.write('sid = os.getenv("TWILIO_SID")\n')
git("add", "app.py")
check("the same file without the secret commits", git("commit", "-m", "ok").returncode == 0)
with open(os.path.join(repo, ".env"), "w") as f:
    f.write("A=1\n")
git("add", "-f", ".env")
check("a .env is refused even with git add -f", git("commit", "-m", "env").returncode != 0)

print(f"\n{failures} failure(s)")
sys.exit(1 if failures else 0)
