#!/usr/bin/env python3
"""Check a client's CSV export against the SentrIA upload rules for one sector
and activity, and say what the backend would do with it.

    python3 scripts/csv-check/check.py FILE.csv --sector health --activity pharmacie \
        [--map MAPPING.json] [--write OUT.csv]

Steps:
  a. read the file as pipeline/alerts.py read_upload does
  b. load schemas/<sector>__<activity>.json, or the sector default
  c. apply the mapping, when one is given; refuse on a mapping problem
  d. the refusal order of pipeline/upload_check.py check_upload
  e. cells the backend reads as empty or as not set (warnings, never a refusal)
  f. duplicate rows (reported, kept)
  g. --write OUT.csv, only when the file is accepted and no filled cell would be lost

Exit codes: 0 accepted, 1 refused, 2 the inputs cannot be used.
The backend is the source of truth. The schemas come from export_schemas.py.
"""
import argparse
import calendar
import json
import os
import re
import sys
from datetime import datetime

import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
SCHEMA_DIR = os.path.join(HERE, "schemas")
MAP_OPTIONS = {"name", "strip_unit", "date_in", "month_end"}
BOOL_SPELLINGS = ("True", "TRUE", "true", "False", "FALSE", "false")
MONTH_YEAR = (
    (re.compile(r"^(\d{4})[-/](\d{1,2})$"), lambda m: (int(m.group(1)), int(m.group(2)))),
    (re.compile(r"^(\d{1,2})[-/](\d{4})$"), lambda m: (int(m.group(2)), int(m.group(1)))),
)
UNIT = re.compile(r"\s*[A-Za-zµ%°/²³]+\.?$")
SHOWN = 20


class InputError(Exception):
    pass


# ---------------------------------------------------------------- readers (as the backend)

def clean_header(name):
    return str(name).replace("﻿", "").strip()


def read_upload(path):
    """pipeline/alerts.py read_upload: ';' or ',' by the first line."""
    with open(path, "r", encoding="utf-8-sig") as f:
        first_line = f.readline()
    sep = ";" if ";" in first_line else ","
    df = pd.read_csv(path, sep=sep)
    df.columns = [clean_header(c) for c in df.columns]
    return df


def has_value(value):
    """pipeline/upload_check.py _has_value."""
    if value is None:
        return False
    try:
        if value != value:  # NaN
            return False
    except Exception:
        pass
    return str(value).strip() != ""


def parse_date(value, formats):
    """pipeline/alerts.py _parse_date: the first format that reads the text."""
    if not has_value(value):
        return None
    text = str(value).strip()
    for fmt in formats:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def parse_number(value):
    """pipeline/alerts.py _number and _num: a float, None for a blank or a non-number."""
    if not has_value(value):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return None if number != number else number


def yes_reading(value, yes_words, no_words):
    """'yes' or 'no' for a cell the reader knows, None for one it does not."""
    text = str(value).strip().lower()
    if text in yes_words:
        return "yes"
    if text in no_words:
        return "no"
    return None


# ---------------------------------------------------------------- the backend's checks

def missing_groups(columns, required):
    """pipeline/upload_check.py _missing_groups."""
    return [list(group) for group in required if not any(name in columns for name in group)]


def is_supplier_orders(columns):
    """pipeline/upload_check.py is_supplier_orders."""
    lowered = {c.lower() for c in columns}
    return "order_date" in lowered and bool({"received_date", "actual_delivery_date"} & lowered)


def usable_rows(df, required):
    """pipeline/upload_check.py _usable_rows: rows where every group has a filled cell."""
    count = 0
    for _, row in df.iterrows():
        if all(any(name in row.index and has_value(row[name]) for name in group) for group in required):
            count += 1
    return count


def single_store(schemas, sector, activity):
    """SINGLE_STORE in upload_check.py is read on the activity as given, not on the fallback."""
    own = schemas.get((sector, activity))
    return bool(own and own["single_store"])


# ---------------------------------------------------------------- schemas

def load_schemas():
    if not os.path.isdir(SCHEMA_DIR):
        raise InputError(f"no schemas in {SCHEMA_DIR}; run export_schemas.py first")
    schemas = {}
    for name in sorted(os.listdir(SCHEMA_DIR)):
        if name.endswith(".json"):
            with open(os.path.join(SCHEMA_DIR, name), encoding="utf-8") as f:
                schema = json.load(f)
            schemas[(schema["sector"], schema["activity"])] = schema
    return schemas


def select_schema(schemas, sector, activity):
    """pipeline/upload_check.py spec_for: the activity's own schema, else the sector default."""
    schema = schemas.get((sector, activity)) or schemas.get((sector, None))
    if schema is None:
        raise InputError(f"no schema for sector {sector!r}")
    return schema


def looks_like(schemas, columns, sector, activity):
    """pipeline/upload_check.py looks_like, over the generated schemas."""
    matches = []
    for (other_sector, other_type), schema in schemas.items():
        if (other_sector, other_type) in (("logistics", "transport"), (sector, activity)):
            continue
        if not missing_groups(columns, schema["required"]):
            matches.append({"sector": other_sector, "business_type": other_type})
    specific = {m["sector"] for m in matches if m["business_type"]}
    return [m for m in matches if m["business_type"] or m["sector"] not in specific]


# ---------------------------------------------------------------- mapping

def load_mapping(path):
    try:
        with open(path, encoding="utf-8") as f:
            mapping = json.load(f)
    except (OSError, ValueError) as error:
        raise InputError(f"mapping unreadable: {error}")
    if not isinstance(mapping, dict):
        raise InputError("mapping must be a JSON object")
    return mapping


def check_mapping(mapping, schema, file_columns):
    """Returns (problems, plan). Each problem is (code, message). plan maps a
    file column to (target, options)."""
    problems = []
    if mapping.get("sector") != schema["sector"]:
        problems.append(("mapping_wrong_sector", f"mapping is for {mapping.get('sector')!r}, the schema is for {schema['sector']!r}"))
    if mapping.get("activity") != schema["activity"]:
        problems.append(("mapping_wrong_activity", f"mapping is for {mapping.get('activity')!r}, the schema is for {schema['activity']!r}"))

    headers = mapping.get("source_headers")
    if not isinstance(headers, list):
        raise InputError("mapping 'source_headers' must be a list")
    declared = {clean_header(h) for h in headers}
    if declared != set(file_columns):
        only_mapping = sorted(declared - set(file_columns))
        only_file = sorted(set(file_columns) - declared)
        problems.append(("mapping_headers_differ", f"headers only in the mapping: {only_mapping}; only in the file: {only_file}"))

    columns = mapping.get("columns", {})
    if not isinstance(columns, dict):
        raise InputError("mapping 'columns' must be an object")

    plan = {}
    for source, entry in columns.items():
        source = clean_header(source)
        if isinstance(entry, str):
            entry = {"name": entry}
        if not isinstance(entry, dict) or not isinstance(entry.get("name"), str):
            problems.append(("mapping_option_invalid", f"{source!r} needs a target name"))
            continue
        unknown = sorted(set(entry) - MAP_OPTIONS)
        if unknown:
            problems.append(("mapping_option_invalid", f"{source!r} has unknown option(s) {unknown}"))
            continue
        target = entry["name"]
        ftype = schema["types"].get(target)
        if ftype is None:
            problems.append(("mapping_unknown_target", f"{source!r} maps to {target!r}, which is not a column of this schema"))
            continue
        if entry.get("strip_unit") and ftype != "number":
            problems.append(("mapping_option_invalid", f"{source!r}: strip_unit is for number columns, {target!r} is {ftype}"))
        if (entry.get("date_in") or entry.get("month_end")) and ftype != "date":
            problems.append(("mapping_option_invalid", f"{source!r}: date_in and month_end are for date columns, {target!r} is {ftype}"))
        plan[source] = (target, entry)

    seen = {}
    for column in file_columns:
        target = plan[column][0] if column in plan else column
        if target in seen:
            problems.append(("mapping_duplicate_target", f"{seen[target]!r} and {column!r} both become {target!r}"))
        else:
            seen[target] = column
    return problems, plan


def transform(value, entry, ftype, formats):
    """The text one cell carries after the mapping's options."""
    if not has_value(value):
        return None
    text = str(value).strip()
    if ftype == "number" and entry.get("strip_unit"):
        text = UNIT.sub("", text).strip()
    if ftype == "date":
        if entry.get("date_in"):
            try:
                return datetime.strptime(text, entry["date_in"]).date().isoformat()
            except ValueError:
                pass
        if entry.get("month_end"):
            for pattern, read in MONTH_YEAR:
                match = pattern.match(text)
                if match:
                    year, month = read(match)
                    if 1 <= month <= 12:
                        last = calendar.monthrange(year, month)[1]
                        return f"{year:04d}-{month:02d}-{last:02d}"
        found = parse_date(text, formats)
        return found.isoformat() if found else text
    return text


def apply_mapping(df, plan, schema):
    """Renames the mapped columns and transforms the typed ones. Every file
    column is kept, because the backend checks all of them. Returns the frame
    and the columns the schema does not use."""
    out = pd.DataFrame(index=df.index)
    unused = []
    for column in df.columns:
        target, entry = plan.get(column, (column, {}))
        ftype = schema["types"].get(target)
        if ftype is None:
            unused.append(column)
            out[target] = df[column]
        else:
            out[target] = [transform(v, entry, ftype, schema["date_formats"]) for v in df[column]]
    return out, unused


# ---------------------------------------------------------------- cell readers

def cell_problems(df, schema):
    """Cells the backend reads as empty or as not set: (line, column, value, reason)."""
    found = []
    yes = {"alerts": set(schema["yes_words"]["alerts"]), "port_flow": set(schema["yes_words"]["port_flow"])}
    no = set(schema["no_words"])
    for column, ftype in schema["types"].items():
        if column not in df.columns:
            continue
        cells = [(i, v) for i, v in df[column].items() if has_value(v)]
        if ftype == "boolean":
            # The backend tests `is False`, which only a column pandas read as
            # booleans can satisfy. One text value turns the whole column to strings.
            plain = all(str(v).strip() in BOOL_SPELLINGS for _, v in cells)
            for i, v in cells:
                if not plain:
                    found.append((i + 2, column, v, "read as not set: the column also holds text, so nothing in it is a boolean"))
            continue
        for i, v in cells:
            reason = None
            if ftype == "number" and parse_number(v) is None:
                reason = "read as empty: not a number"
            elif ftype == "date" and parse_date(v, schema["date_formats"]) is None:
                reason = "read as empty: date format not accepted"
            elif ftype == "yesno" and yes_reading(v, yes["alerts"], no) is None:
                reason = "read as not set: no yes word"
            elif ftype == "flag" and yes_reading(v, yes["port_flow"], no) is None:
                reason = "read as not set: no yes word"
            if reason:
                found.append((i + 2, column, v, reason))
    return found


def written_value(value, ftype, schema):
    """What --write puts in the cell: the value the backend reads, or empty."""
    if not has_value(value):
        return ""
    if ftype == "number":
        number = parse_number(value)
        if number is None:
            return ""
        return str(int(number)) if number.is_integer() else repr(number)
    if ftype == "date":
        found = parse_date(value, schema["date_formats"])
        return found.isoformat() if found else ""
    if ftype in ("yesno", "flag"):
        words = schema["yes_words"]["alerts" if ftype == "yesno" else "port_flow"]
        return yes_reading(value, set(words), set(schema["no_words"])) or ""
    if ftype == "boolean":
        text = str(value).strip().lower()
        return {"true": "True", "false": "False"}.get(text, "")
    return str(value).strip()


def clean_frame(df, schema):
    """The frame --write saves, and the filled cells that would come out empty.
    Those are refused: a clean copy must not drop data the backend would have read."""
    lost = []
    frame = pd.DataFrame(index=df.index)
    for column in df.columns:
        ftype = schema["types"].get(column)
        values = []
        for i, value in df[column].items():
            if ftype is None:
                values.append(str(value).strip() if has_value(value) else "")
                continue
            written = written_value(value, ftype, schema)
            if has_value(value) and written == "":
                lost.append((i + 2, column, value))
            values.append(written)
        frame[column] = values
    return frame, lost


# ---------------------------------------------------------------- the check

def _name(item):
    if isinstance(item, str):
        return item
    return f"{item['sector']}/{item['business_type'] or 'default'}"


def _refuse(out, code, message, missing=(), looks=()):
    print(f"outcome: refused, {code}", file=out)
    print(f"  {message}", file=out)
    if missing:
        print("  missing column groups: " + ", ".join(" or ".join(g) for g in missing), file=out)
    if looks:
        print("  looks like: " + ", ".join(_name(item) for item in looks), file=out)
    return 1


def check(csv_path, sector, activity=None, mapping_path=None, write_path=None, out=None):
    """Runs the checks. Returns 0 accepted, 1 refused. Raises InputError for bad inputs
    and for a --write that would lose filled cells."""
    out = out or sys.stdout
    schemas = load_schemas()
    raw = read_upload(csv_path)
    schema = select_schema(schemas, sector, activity)
    print(f"schema: {schema['key']}", file=out)

    plan = {}
    if mapping_path:
        mapping = load_mapping(mapping_path)
        print(f"mapping: {mapping.get('client', '(no label)')}", file=out)
        problems, plan = check_mapping(mapping, schema, list(raw.columns))
        if problems:
            for code, message in problems:
                print(f"  mapping problem [{code}]: {message}", file=out)
            return _refuse(out, problems[0][0], "The mapping does not fit this file and schema.")

    df, unused = apply_mapping(raw, plan, schema)
    if unused:
        print(f"columns the schema does not use (kept, not checked): {unused}", file=out)

    if len(df.dropna(how="all")) == 0:
        return _refuse(out, "upload_empty", "The file has no data rows.")

    if is_supplier_orders(list(df.columns)):
        print("supplier order file: accepted without the column check, as the backend does", file=out)
        warnings = []
    else:
        missing = missing_groups(list(df.columns), schema["required"])
        if missing:
            looks = looks_like(schemas, list(df.columns), sector, activity)
            return _refuse(out, "upload_columns_missing", "This file doesn't match the chosen activity.", missing, looks)

        if single_store(schemas, sector, activity) and "store_id" in df.columns:
            stores = df["store_id"].dropna().astype(str).str.strip()
            n = stores[stores != ""].nunique()
            if n > 1:
                return _refuse(out, "upload_wrong_department", f"This file holds {n} stores (store_id column).", looks=["chaine-magasins"])

        rows = usable_rows(df, schema["required"])
        if rows == 0:
            return _refuse(out, "upload_no_usable_rows", "The columns are there, but no row is filled in enough to analyse.")
        print(f"rows: {len(df)}, usable by the backend: {rows}", file=out)
        warnings = cell_problems(df, schema)

    _report(out, warnings, df)
    frame = None
    if write_path:
        frame, lost = clean_frame(df, schema)
        if lost:
            raise InputError(f"not written: {len(lost)} filled cells would be lost (the cells are listed above); fix the mapping first")
        if any(";" in str(c) for c in frame.columns):
            raise InputError("not written: a column name holds ';', so the backend would split the header wrongly")
    print("outcome: accepted", file=out)

    if write_path:
        frame.to_csv(write_path, index=False, encoding="utf-8")
        print(f"written: {write_path} ({len(frame)} rows)", file=out)
    return 0


def _report(out, warnings, df):
    if warnings:
        print(f"cells the backend would not read: {len(warnings)}", file=out)
        for line, column, value, reason in warnings[:SHOWN]:
            print(f"  line {line}, {column}: {value!r} {reason}", file=out)
        if len(warnings) > SHOWN:
            print(f"  ... {len(warnings) - SHOWN} more", file=out)
    else:
        print("cells the backend would not read: none", file=out)

    dupes = df[df.duplicated(keep=False)]
    if len(dupes):
        first = int(dupes.index[0]) + 2
        print(f"duplicate rows (kept, not removed): {len(dupes)}, first at line {first}", file=out)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("csv")
    parser.add_argument("--sector", required=True)
    parser.add_argument("--activity", default=None)
    parser.add_argument("--map", dest="mapping", default=None)
    parser.add_argument("--write", dest="write", default=None)
    args = parser.parse_args(argv)
    try:
        return check(args.csv, args.sector, args.activity, args.mapping, args.write)
    except InputError as error:
        print(f"input error: {error}", file=sys.stderr)
        return 2
    except (OSError, ValueError) as error:
        print(f"input error: file unreadable: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
