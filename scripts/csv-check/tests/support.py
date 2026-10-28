"""Helpers shared by the csv-check tests.

Backend-dependent tests run only when SENTRIA_BACKEND points at a checkout of
the Sentria backend (read only). Without it they skip with a message.
"""
import csv
import importlib
import io
import json
import os
import sys

CHECK_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.dirname(os.path.dirname(CHECK_DIR))
BACKEND = os.environ.get("SENTRIA_BACKEND", "")
SKIP_MESSAGE = "SENTRIA_BACKEND is not set to a Sentria backend checkout"

if CHECK_DIR not in sys.path:
    sys.path.insert(0, CHECK_DIR)

import check  # noqa: E402

DATA = check.load_specs()
TABLE = check.spec_table(DATA)
VALUES = {"number": "3", "date": "2026-01-05", "yesno": "yes", "flag": "yes", "boolean": "True", "text": "x"}


def sample_header_row(entry, drop=()):
    cols = [c for c in entry["sample"] if c not in drop]
    return cols, [VALUES[entry["types"][c]["type"]] for c in cols]


def write_rows(path, header, rows, sep=","):
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, delimiter=sep, lineterminator="\n")
        writer.writerow(header)
        writer.writerows(rows)
    return path


def run(csv_path, sector, business_type=None, **kw):
    out = io.StringIO()
    code = check.check(csv_path, sector, business_type, out=out, **kw)
    return code, out.getvalue()


def backend(name):
    """A backend module, or None when SENTRIA_BACKEND is unset or the import fails.
    pipeline/alerts.py builds a Supabase client on import; the placeholders are the
    ones the backend's own demo scripts use, and no request is made."""
    if not BACKEND or not os.path.isdir(os.path.join(BACKEND, "pipeline")):
        return None
    os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
    os.environ.setdefault("SUPABASE_KEY", "fake-key")
    if BACKEND not in sys.path:
        sys.path.insert(0, BACKEND)
    try:
        return importlib.import_module(name)
    except Exception:
        return None


def example_mapping():
    with open(os.path.join(CHECK_DIR, "mappings", "example.json"), encoding="utf-8") as f:
        return json.load(f)
