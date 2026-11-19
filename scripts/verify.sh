#!/usr/bin/env bash
# One command for the checks that must pass before a task is reported done.
# Mirrors .github/workflows/ci.yml (install, types, lint, unit tests, build)
# and adds the secret scan. Stops at the first failed check and exits non-zero.
#
#   scripts/verify.sh            the checks above
#   scripts/verify.sh --audit    also the dependency audit (critical findings fail)
#
# Not run here: tests/e2e (needs a built server, see gotcha.md), check-i18n.mjs,
# validate-palette.mjs. Run those for the feature you touched.
set -uo pipefail
cd "$(dirname "$0")/.."

AUDIT=0
for arg in "$@"; do
  case "$arg" in
    --audit) AUDIT=1 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

# The build needs these to exist. They point at nothing real (same as CI).
export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-https://ci.invalid}"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-ci-anon-key}"

PASSED=()
step() {
  local name="$1"; shift
  echo
  echo "== $name"
  echo "   \$ $*"
  if "$@"; then
    echo "   PASS: $name"
    PASSED+=("$name")
  else
    local code=$?
    echo "   FAIL: $name (exit $code)"
    echo
    echo "verify.sh: STOPPED at '$name'. Passed before it: ${PASSED[*]:-none}."
    exit 1
  fi
}

step "install (frozen lockfile)" pnpm install --frozen-lockfile
step "types"                     npx tsc --noEmit -p .
step "lint (errors only)"        npx eslint . --quiet
step "unit tests"                pnpm test:unit
step "secret scan"               python3 scripts/check_secrets.py --all
step "production build"          pnpm build

if [ "$AUDIT" -eq 1 ]; then
  step "dependency audit (critical)" pnpm audit --prod --audit-level critical
fi

echo
echo "verify.sh: ALL PASSED (${#PASSED[@]} checks): ${PASSED[*]}"
if [ "$AUDIT" -eq 0 ]; then
  echo "NOT RUN: dependency audit (use --audit), tests/e2e, check-i18n.mjs, validate-palette.mjs"
else
  echo "NOT RUN: tests/e2e, check-i18n.mjs, validate-palette.mjs"
fi
