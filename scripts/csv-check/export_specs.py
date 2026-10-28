#!/usr/bin/env python3
"""Exports the backend's upload rules to specs/upload_specs.json.

Re-run after any change to pipeline/upload_check.py or to the readers in
pipeline/alerts.py and pipeline/port_flow.py:

    python3 scripts/csv-check/export_specs.py --backend /path/to/Sentria

Check that the committed file is current (exit 1 when it differs):

    python3 scripts/csv-check/export_specs.py --backend /path/to/Sentria --check

The backend is imported and read, never written. Do not edit the JSON by hand.
The backend_commit field is left out of the --check comparison.

What comes from where:
  specs, messages, single_store  pipeline/upload_check.py (SPECS, MESSAGES, SINGLE_STORE)
  date_formats                   pipeline/alerts.py _parse_date, read from its source
  yes_words                      the literal word tuples in alerts.py and port_flow.py
  types                          column_types.py. The backend declares no types, so that
                                 table is hand-written. "basis" says whether a type was
                                 read from a backend reader ("read") or taken from the
                                 column name ("name").
"""
import argparse
import ast
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "specs", "upload_specs.json")
sys.path.insert(0, HERE)

from column_types import NO_WORDS, TYPES  # noqa: E402


def _tree(path):
    with open(path, encoding="utf-8") as f:
        return ast.parse(f.read(), filename=path)


def date_formats(backend):
    for node in ast.walk(_tree(os.path.join(backend, "pipeline", "alerts.py"))):
        if isinstance(node, ast.FunctionDef) and node.name == "_parse_date":
            for sub in ast.walk(node):
                if isinstance(sub, ast.For) and isinstance(sub.iter, ast.Tuple):
                    formats = [e.value for e in sub.iter.elts if isinstance(e, ast.Constant)]
                    if formats and all("%" in f for f in formats):
                        return formats
    raise SystemExit("export_specs: no date formats found in _parse_date")


def yes_words(backend):
    """alerts.py reads yesno columns, port_flow.py reads flag columns. The lists differ."""
    out = {}
    for key, name in (("alerts", "alerts.py"), ("port_flow", "port_flow.py")):
        found = set()
        for node in ast.walk(_tree(os.path.join(backend, "pipeline", name))):
            if isinstance(node, ast.Tuple):
                values = [e.value for e in node.elts if isinstance(e, ast.Constant) and isinstance(e.value, str)]
                if "yes" in values and len(values) == len(node.elts):
                    found.update(values)
        if not found:
            raise SystemExit(f"export_specs: no yes words found in {name}")
        out[key] = sorted(found)
    return out


def backend_commit(backend):
    try:
        return subprocess.check_output(["git", "-C", backend, "rev-parse", "HEAD"], text=True).strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return "unknown"


def export(backend):
    sys.path.insert(0, backend)
    import pipeline.upload_check as uc

    entries, seen, problems = [], [], []
    for (sector, business_type), spec in uc.SPECS.items():
        names = list(dict.fromkeys([n for g in spec["required"] for n in g] + list(spec["sample"])))
        for name in names:
            if name not in TYPES:
                problems.append(f"{sector}/{business_type}: no type for {name!r} (add it to column_types.py)")
        alias_of = next((k for k, s in seen if s is spec), None)
        seen.append((f"{sector}/{business_type or 'default'}", spec))
        entries.append({
            "key": {"sector": sector, "business_type": business_type},
            "alias_of": alias_of,
            "required": [list(g) for g in spec["required"]],
            "sample": list(spec["sample"]),
            "types": {n: {"type": TYPES[n][0], "basis": TYPES[n][1]} for n in names if n in TYPES},
        })
    if problems:
        raise SystemExit("export_specs:\n" + "\n".join(problems))
    return {
        "backend_commit": backend_commit(backend),
        "date_formats": date_formats(backend),
        "yes_words": yes_words(backend),
        "no_words": list(NO_WORDS),
        "single_store": [list(k) for k in sorted(uc.SINGLE_STORE, key=lambda k: (k[0], k[1] or ""))],
        "messages": uc.MESSAGES,
        "specs": entries,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--backend", required=True)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    fresh = export(os.path.abspath(args.backend))

    if args.check:
        with open(OUT, encoding="utf-8") as f:
            committed = json.load(f)
        a = {k: v for k, v in committed.items() if k != "backend_commit"}
        b = {k: v for k, v in fresh.items() if k != "backend_commit"}
        if a != b:
            print("specs/upload_specs.json differs from a fresh export. Re-run export_specs.py.")
            return 1
        print("specs/upload_specs.json is current")
        return 0

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(fresh, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"wrote {OUT} ({len(fresh['specs'])} specs)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
