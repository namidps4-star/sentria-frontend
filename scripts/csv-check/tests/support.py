"""Helpers shared by the csv-check tests.

Backend-dependent tests run only when SENTRIA_BACKEND points at a checkout of
the Sentria backend (read only). Without it they skip with a message.
"""
import ast
import datetime
import types
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


def from_source(path, names, env):
    """Compiles the named top-level functions from a backend source file, without running its
    imports. pipeline/alerts.py imports twilio and a Supabase client at load time, so the tests
    read the few functions they need from its source. env supplies the names they read."""
    with open(path, encoding="utf-8") as fh:
        tree = ast.parse(fh.read(), filename=path)
    body = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in names]
    missing = set(names) - {node.name for node in body}
    if missing:
        raise RuntimeError(f"{path} does not define {sorted(missing)}")
    namespace = dict(env)
    exec(compile(ast.Module(body, []), path, "exec"), namespace)
    return types.SimpleNamespace(**{name: namespace[name] for name in names})


def backend(name):
    """A backend module, or None when SENTRIA_BACKEND is unset or the import fails.
    Modules that import twilio are read from source instead, so the tests need no
    Twilio installed. pipeline/alerts.py builds a Supabase client on import; the
    placeholders are the ones the backend's own demo scripts use, and no request is made."""
    if not BACKEND or not os.path.isdir(os.path.join(BACKEND, "pipeline")):
        return None
    if BACKEND not in sys.path:
        sys.path.insert(0, BACKEND)
    if name == "pipeline.alerts":
        try:
            import pandas
            upload_check = importlib.import_module("pipeline.upload_check")
        except Exception:
            return None
        return from_source(
            os.path.join(BACKEND, "pipeline", "alerts.py"),
            ["_parse_date", "_num", "read_upload"],
            {"pd": pandas, "datetime": datetime.datetime, "clean_header": upload_check.clean_header},
        )
    if name == "pipeline.port_flow":
        return from_source(os.path.join(BACKEND, "pipeline", "port_flow.py"), ["_flag"], {})
    os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
    os.environ.setdefault("SUPABASE_KEY", "fake-key")
    try:
        return importlib.import_module(name)
    except Exception:
        return None


def example_mapping():
    with open(os.path.join(CHECK_DIR, "mappings", "example.json"), encoding="utf-8") as f:
        return json.load(f)
