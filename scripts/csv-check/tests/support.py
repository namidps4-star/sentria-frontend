"""Helpers shared by the csv-check tests."""
import importlib
import io
import json
import os
import sys

CHECK_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXAMPLES = os.path.join(CHECK_DIR, "examples")
BACKEND = os.environ.get(
    "SENTRIA_BACKEND",
    os.path.join(CHECK_DIR, "..", "..", "..", "sentria"),
)

if CHECK_DIR not in sys.path:
    sys.path.insert(0, CHECK_DIR)

import check  # noqa: E402

SCHEMAS = check.load_schemas()

# One filled value per column type, enough for every reader to accept it.
VALUES = {
    "number": "3",
    "date": "2026-01-05",
    "yesno": "yes",
    "flag": "yes",
    "boolean": "True",
    "text": "x",
}


def schema(sector, activity=None):
    return SCHEMAS[(sector, activity)]


def sample_row(one_schema, drop=()):
    """Header and one filled row for a schema's sample, minus the dropped names."""
    columns = [c for c in one_schema["sample"] if c not in drop]
    row = [VALUES.get(one_schema["types"].get(c, "text"), "x") for c in columns]
    return columns, row


def write(path, text):
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    return path


def write_rows(path, header, rows, sep=","):
    lines = [sep.join(header)] + [sep.join(str(v) for v in row) for row in rows]
    return write(path, "\n".join(lines) + "\n")


def run(csv_path, sector, activity=None, mapping=None, write_to=None):
    """Runs check.check and returns (exit code, printed report)."""
    out = io.StringIO()
    code = check.check(csv_path, sector, activity, mapping, write_to, out=out)
    return code, out.getvalue()


def write_mapping(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return path


def load_example_mapping():
    with open(os.path.join(EXAMPLES, "health-pharmacie.map.json"), encoding="utf-8") as f:
        return json.load(f)


def backend(name):
    """A module from the Sentria backend checkout, or None when it cannot be imported.

    pipeline/alerts.py builds a Supabase client when it is imported. The
    placeholders below are the ones the backend's own demo scripts use. The
    import makes no request, and nothing here reaches the network.
    """
    if not os.path.isdir(os.path.join(BACKEND, "pipeline")):
        return None
    os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
    os.environ.setdefault("SUPABASE_KEY", "fake-key")
    if BACKEND not in sys.path:
        sys.path.insert(0, BACKEND)
    try:
        return importlib.import_module(name)
    except Exception:
        return None
