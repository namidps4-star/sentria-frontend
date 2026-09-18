#!/usr/bin/env node
/**
 * Finds French text that is not translated yet.
 *
 * "Selecting English must make literally everything English, no
 * exception" is not something you can confirm by clicking around: the
 * app has hundreds of strings across thirty-two files, and the ones you
 * miss are always on the screen you did not open. This answers the
 * question mechanically.
 *
 * Run:  node scripts/check-i18n.mjs          report, exit 0
 *       node scripts/check-i18n.mjs --strict  exit 1 if anything is left
 *       node scripts/check-i18n.mjs --file components/sentria/x.tsx
 *
 *
 * How it decides
 * --------------
 *
 * The first version of this looked for French: diacritics and French
 * function words. It missed "Mensuel" and "Annuel", which carry neither,
 * and it could never have caught the three plan descriptions that were
 * English ONLY, where a French operator read English.
 *
 * So it does not look for a language. It flags any user-facing text that
 * is not wrapped in a translation call, whatever language it happens to
 * be in. That is the actual invariant: every string a user reads goes
 * through tx(), localized(), or the fr.ts catalogue.
 *
 * Wrapped text is recognised by being an argument of tx() or
 * localized(), the fr:/en: field of a pair, or a t("key") lookup.
 *
 * It over-reports by design. A false positive costs a glance; a false
 * negative ships the wrong language to a paying customer.
 */

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const ROOT = process.cwd()

/* Files that are allowed to hold French: the catalogues themselves. */
const ALLOWED = [
  "lib/i18n/fr.ts",
  "lib/i18n/en.ts",
  "lib/i18n/index.ts",
  "scripts/check-i18n.mjs",
]

const SEARCH_DIRS = ["components", "lib", "app"]

/** Is this a piece of text a user reads?
 *
 *  Everything excluded here is machinery: Tailwind classes, ids, keys,
 *  urls, media types, ISO codes. If something user-facing slips into
 *  this list the tool goes quiet about it, so the exclusions stay narrow
 *  and shape-based rather than a list of words.
 */
function isUserFacing(text) {
  const trimmed = text.trim()

  /* A single short token with no space is almost always an id, a key or
     a class fragment. Real UI copy of that length ("OK", "Non") is rare
     enough to accept the gap. */
  if (trimmed.length < 3) return false

  /* Data, not copy: a stored default such as '["industry"]' or '{}'. */
  if (/^[[{]/.test(trimmed)) {
    try {
      JSON.parse(trimmed)
      return false
    } catch {
      /* Not JSON, so judge it on the rules below. */
    }
  }

  /* Tailwind and CSS. */
  if (/^[a-z0-9-]+(:[a-z0-9-]+)*$/.test(trimmed) && !/ /.test(trimmed)) return false
  if (/[[\]{}]/.test(trimmed) && /(-|:)/.test(trimmed)) return false
  if (/^(flex|grid|block|inline|hidden|absolute|relative|sticky|fixed)\b/.test(trimmed)) return false
  if (/\b(rounded|border|bg|text|font|shadow|ring|gap|px|py|pt|pb|pl|pr|mx|my|mt|mb|ml|mr|w|h|min|max|space|divide|items|justify|self|overflow|truncate|leading|tracking|opacity|transition|duration|ease|animate|motion|hover|focus|group|peer|dark|sm|md|lg|xl)-/.test(trimmed)) return false

  /* Identifiers, dotted keys, urls, formats, codes. */
  if (/^[a-z0-9_.]+$/i.test(trimmed) && !/ /.test(trimmed)) return false
  if (/^https?:\/\//.test(trimmed)) return false
  if (/^[A-Z][a-z]+([A-Z][a-z]+)+$/.test(trimmed)) return false
  if (/^[A-Z0-9_]+$/.test(trimmed)) return false
  if (/^(application|text|image|audio|video)\//.test(trimmed)) return false
  if (/^[\d\s.,:%+\-/()€$₦]+$/.test(trimmed)) return false
  if (/^(fr|en|es|pt|ar|sw|fr-FR|en-US|en-GB|utf-8|UTF-8)$/i.test(trimmed)) return false

  /* Must contain at least one letter group that reads like a word. */
  return /[A-Za-zÀ-ÿ]{3}/.test(trimmed)
}

/** Replace a span with spaces, keeping its newlines.
 *
 *  Blanking a multi-line comment with plain spaces deleted its newlines
 *  and every line number reported after it came out too low. The offsets
 *  were right; the line count was not. */
function blank(text) {
  return text.replace(/[^\n]/g, " ")
}

/** Does this text between a ">" and a "<" read as code rather than copy?
 *
 *  Only shapes UI copy never has: an assignment, a statement separator, a
 *  fat arrow, a quoted string, a hook call. A sentence with an equals
 *  sign in it would be missed, and that is the trade this makes. */
function isCode(text) {
  return /=>|=|;|["'`]|\buseState\b|\bconst\b|\blet\b|\breturn\b/.test(text)
}

/** Spans that are already translated, so their French half is fine.
 *
 *  Matches the first argument of tx("...", "...") and of
 *  localized("...", "...") and the fr: "..." of a Localized literal.
 */
function translatedSpans(source) {
  const spans = []

  const patterns = [
    /\b(?:tx|localized)\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1\s*,\s*(["'`])((?:\\.|(?!\3)[^\\])*)\3/g,
    /\bfr:\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/g,
    /\ben:\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/g,
    /\bt\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/g,

    /* Not copy: a needle matched against data. Translating
       .includes("froid") would break the match it exists to make. */
    /\.(?:includes|startsWith|endsWith|indexOf|lastIndexOf|search|split)\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/g,

    /* Not copy: written for whoever opens the console, not for the
       operator. A translated stack trace helps nobody. */
    /\bconsole\.(?:log|warn|error|info|debug)\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/g,
    /\bnew Error\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/g,

    /* Not copy: a value being compared against. Translating the right
       side of `data.message === "Processed successfully"` would break the
       comparison, which is the opposite of what this tool is for. */
    /[=!]==\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/g,
  ]

  for (const re of patterns) {
    let m
    while ((m = re.exec(source))) {
      spans.push([m.index, m.index + m[0].length])
    }
  }

  return spans
}

function inSpans(index, spans) {
  return spans.some(([a, b]) => index >= a && index < b)
}

function findings(file) {
  const source = readFileSync(file, "utf8")
  const skip = translatedSpans(source)
  const out = []

  /* Blank out everything that is not UI copy, keeping byte offsets so
     the reported line numbers stay right:
       - comments, because a French explanation of the code is not copy
       - import and export-from lines, whose strings are module paths
       - "use client" and friends */
  // An explicit, reviewable opt-out for spans that are not copy at all:
  // CSV header names the customer's own file must carry, for instance.
  // Wrap them between an "i18n-ignore-start: why" block comment and an
  // "i18n-ignore-end" one. An unclosed start runs to the end of the
  // file, which is loud enough to notice. Nothing else in this tool lets
  // a string through, so this marker is the only place a reader has to
  // check before believing a zero.
  const withoutIgnored = source.replace(
    /i18n-ignore-start[\s\S]*?(?:i18n-ignore-end|$)/g,
    blank
  )

  const code = withoutIgnored
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:])\/\/[^\n]*/g, blank)
    .replace(/^\s*(?:import|export)\s[\s\S]*?from\s*["'][^"'\n]*["']/gm, blank)
    .replace(/^\s*(?:import|export)\s[^\n]*$/gm, blank)
    .replace(/^\s*["'](?:use client|use server|use strict)["'][^\n]*$/gm, blank)

  /* 1. String literals. */
  const strRe = /(["'])((?:\\.|(?!\1)[^\\\n])*)\1/g
  let m
  while ((m = strRe.exec(code))) {
    if (inSpans(m.index, skip)) continue
    if (isUserFacing(m[2])) {
      out.push({
        line: code.slice(0, m.index).split("\n").length,
        text: m[2].slice(0, 70),
      })
    }
  }

  /* 2. JSX text between tags, which no string-literal scan would see.
        A generic argument list puts code between a ">" and a "<", so
        useState<string[]>([...]) read as copy until isCode() rejected
        it. */
  const jsxRe = />([^<>{}]{4,200})</g
  while ((m = jsxRe.exec(code))) {
    if (!isCode(m[1]) && isUserFacing(m[1])) {
      out.push({
        line: code.slice(0, m.index).split("\n").length,
        text: m[1].trim().replace(/\s+/g, " ").slice(0, 70),
      })
    }
  }

  return out.sort((a, b) => a.line - b.line)
}

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)

    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue
      walk(full, acc)
    } else if (/\.(tsx?|mjs)$/.test(entry)) {
      acc.push(full)
    }
  }

  return acc
}

/* ------------------------------------------------------------------ */

const args = process.argv.slice(2)
const strict = args.includes("--strict")
const only = args.includes("--file") ? args[args.indexOf("--file") + 1] : null

const files = only
  ? [join(ROOT, only)]
  : SEARCH_DIRS.flatMap((d) => {
      try {
        return walk(join(ROOT, d))
      } catch {
        return []
      }
    })

let total = 0
const rows = []

for (const file of files) {
  const rel = relative(ROOT, file)

  if (ALLOWED.includes(rel)) continue

  const found = findings(file)

  if (found.length === 0) continue

  total += found.length
  rows.push({ rel, found })
}

rows.sort((a, b) => b.found.length - a.found.length)

if (only) {
  for (const { rel, found } of rows) {
    console.log(`\n${rel}`)
    for (const f of found) console.log(`  ${String(f.line).padStart(5)}  ${f.text}`)
  }
} else {
  console.log("Unlocalized user-facing text, by file:\n")
  for (const { rel, found } of rows) {
    console.log(`${String(found.length).padStart(5)}  ${rel}`)
  }
}

console.log(`\n${total} unlocalized string${total === 1 ? "" : "s"} in ${rows.length} file${rows.length === 1 ? "" : "s"}.`)

if (strict && total > 0) {
  console.error("\nStrict mode: English is not complete.")
  process.exit(1)
}
