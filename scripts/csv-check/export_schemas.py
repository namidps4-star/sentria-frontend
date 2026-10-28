"""Writes one schema per sector and activity, from the backend's own source.

    python3 scripts/csv-check/export_schemas.py --backend /path/to/Sentria

Reads pipeline/upload_check.py (SPECS, SINGLE_STORE) by importing it, and
pipeline/alerts.py and pipeline/port_flow.py for the date formats and the
yes words. The backend is never written. Run again whenever the backend
changes; tests/test_schemas.py fails until the schemas are regenerated.
"""
import argparse
import ast
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from column_types import NO_WORDS, TYPES  # noqa: E402

SCHEMA_DIR = os.path.join(HERE, "schemas")


def _tree(path):
    with open(path, encoding="utf-8") as f:
        return ast.parse(f.read(), filename=path)


def date_formats(backend):
    """The formats _parse_date tries, in order, read from its source."""
    for node in ast.walk(_tree(os.path.join(backend, "pipeline", "alerts.py"))):
        if isinstance(node, ast.FunctionDef) and node.name == "_parse_date":
            for sub in ast.walk(node):
                if isinstance(sub, ast.For) and isinstance(sub.iter, ast.Tuple):
                    formats = [e.value for e in sub.iter.elts if isinstance(e, ast.Constant)]
                    if formats and all("%" in f for f in formats):
                        return formats
    raise SystemExit("export_schemas: could not find the date formats in _parse_date")


def yes_words(backend):
    """The yes words each reader uses, from its own literal tuple.
    alerts.py reads yesno columns; port_flow.py reads flag columns. They differ."""
    sets = {}
    for key, name in (("alerts", "alerts.py"), ("port_flow", "port_flow.py")):
        found = set()
        for node in ast.walk(_tree(os.path.join(backend, "pipeline", name))):
            if isinstance(node, ast.Tuple):
                values = [e.value for e in node.elts if isinstance(e, ast.Constant) and isinstance(e.value, str)]
                if "yes" in values and len(values) == len(node.elts):
                    found.update(values)
        if not found:
            raise SystemExit(f"export_schemas: no yes words found in {name}")
        sets[key] = sorted(found)
    return sets


def backend_commit(backend):
    try:
        return subprocess.check_output(["git", "-C", backend, "rev-parse", "HEAD"], text=True).strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return "unknown"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--backend", required=True, help="a checkout of the Sentria backend (read only)")
    args = parser.parse_args()
    backend = os.path.abspath(args.backend)

    sys.path.insert(0, backend)
    import pipeline.upload_check as uc  # noqa: E402

    formats = date_formats(backend)
    yes = yes_words(backend)
    commit = backend_commit(backend)

    os.makedirs(SCHEMA_DIR, exist_ok=True)
    for old in os.listdir(SCHEMA_DIR):
        if old.endswith(".json"):
            os.remove(os.path.join(SCHEMA_DIR, old))

    problems = []
    for (sector, activity), spec in sorted(uc.SPECS.items(), key=lambda kv: (kv[0][0], kv[0][1] or "")):
        names = {n for group in spec["required"] for n in group} | set(spec["sample"])
        for name in sorted(names):
            if name not in TYPES:
                problems.append(f"{sector}/{activity}: no type for column {name!r} (add it to column_types.py)")
    if problems:
        raise SystemExit("export_schemas: \n" + "\n".join(problems))

    for (sector, activity), spec in sorted(uc.SPECS.items(), key=lambda kv: (kv[0][0], kv[0][1] or "")):
        alias_of = None
        if (sector, activity) == ("health", None):
            alias_of = "health/pharmacie"
        key = f"{sector}/{activity or 'default'}"
        names = [n for group in spec["required"] for n in group] + list(spec["sample"])
        schema = {
            "schema_version": 1,
            "key": key,
            "sector": sector,
            "activity": activity,
            "alias_of": alias_of,
            "single_store": (sector, activity) in uc.SINGLE_STORE,
            "required": [list(group) for group in spec["required"]],
            "sample": list(spec["sample"]),
            "types": {n: TYPES[n][0] for n in dict.fromkeys(names)},
            "type_basis": {n: TYPES[n][1] for n in dict.fromkeys(names)},
            "date_formats": formats,
            "yes_words": yes,  # {"alerts": yesno columns, "port_flow": flag columns}
            "no_words": list(NO_WORDS),
            "source": {
                "backend_commit": commit,
                "spec": "pipeline/upload_check.py SPECS",
                "date_formats": "pipeline/alerts.py _parse_date",
                "yes_words": "pipeline/alerts.py, pipeline/port_flow.py literal tuples",
            },
        }
        filename = f"{sector}__{activity or 'default'}.json"
        with open(os.path.join(SCHEMA_DIR, filename), "w", encoding="utf-8") as f:
            json.dump(schema, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"wrote schemas/{filename}")


if __name__ == "__main__":
    main()
