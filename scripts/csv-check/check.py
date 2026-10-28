#!/usr/bin/env python3
"""Pre-checks a CSV the way the SentrIA backend will. The backend has the final word.

    python3 scripts/csv-check/check.py FILE.csv --sector health --business-type pharmacie
    python3 scripts/csv-check/check.py FILE.csv --sector logistics --ops-type transport
    python3 scripts/csv-check/check.py FILE.csv --sector health --business-type pharmacie \
        --map MAP.json --write OUT.csv
    python3 scripts/csv-check/check.py FILE.csv --sector health --map-dir DIR_OUTSIDE_THE_REPO

The rules come from specs/upload_specs.json, which export_specs.py generates from
the backend. The order of checks is the order of check_upload in
pipeline/upload_check.py:
  a. no data rows                  refused, upload_empty
  b. supplier order file           accepted
  c. no spec for the sector        accepted
  d. a required group is missing   refused, upload_columns_missing
  d2. several stores in a one-shop activity   refused, upload_wrong_department
  e. no usable row                 refused, upload_no_usable_rows
Mapping problems refuse the file before these run.

Warnings never refuse a file: cells the backend would read as empty or as not set
(date format, number, yes/no), and duplicate rows (kept).

--map      a mapping file. --map-dir picks the file in a folder whose sector,
           business type and source headers match. Keep mapping files outside the repo.
--write    writes the mapped rows with ISO dates and plain numbers. Nothing is written
           when the file is refused, or when a filled cell would come out empty.
--today    a date (YYYY-MM-DD) used to count expiry dates already past. Default: today.
--lang     fr or en for the refusal message. Default fr, as in the backend.

Exit codes: 0 accepted, 1 refused, 2 bad inputs (or a --write that would lose data).
"""
import argparse
import calendar
import datetime
import json
import os
import re
import sys

import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
SPECS_PATH = os.path.join(HERE, "specs", "upload_specs.json")
OPTIONS = {"to", "strip_unit", "date_in", "month_end"}
BOOL_SPELLINGS = ("True", "TRUE", "true", "False", "FALSE", "false")
UNIT = re.compile(r"\s*[A-Za-zµ%°/²³]+\.?$")
MONTH_YEAR = (
    (re.compile(r"^(\d{4})[-/](\d{1,2})$"), lambda m: (int(m.group(1)), int(m.group(2)))),
    (re.compile(r"^(\d{1,2})[-/](\d{4})$"), lambda m: (int(m.group(2)), int(m.group(1)))),
)
SHOWN = 20


class InputError(Exception):
    pass


# ---------------------------------------------------------------- reading, as the backend

def clean_header(name):
    """pipeline/upload_check.py clean_header."""
    return str(name).replace("﻿", "").strip()


def read_upload(path):
    """pipeline/alerts.py read_upload: ';' or ',' by the first line, headers cleaned."""
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
        if value != value:
            return False
    except Exception:
        pass
    return str(value).strip() != ""


def parse_date(value, formats):
    """pipeline/alerts.py _parse_date, with the formats exported from it."""
    if not has_value(value):
        return None
    text = str(value).strip()
    for fmt in formats:
        try:
            return datetime.datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def parse_number(value):
    """pipeline/alerts.py _num: float() of a filled cell, else None."""
    if not has_value(value):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return None if number != number else number


def yes_reading(value, yes, no):
    text = str(value).strip().lower()
    if text in yes:
        return "yes"
    return "no" if text in no else None


# ---------------------------------------------------------------- the backend's checks

def load_specs():
    try:
        with open(SPECS_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError) as error:
        raise InputError(f"cannot read {SPECS_PATH}: {error}. Run export_specs.py.")


def spec_table(data):
    return {(e["key"]["sector"], e["key"]["business_type"]): e for e in data["specs"]}


def spec_for(table, sector, business_type=None, ops_type=None):
    """pipeline/upload_check.py spec_for."""
    if sector == "logistics" and ops_type == "transport":
        return table.get(("logistics", "transport"))
    return table.get((sector, business_type)) or table.get((sector, None))


def missing_groups(columns, required):
    return [list(g) for g in required if not any(name in columns for name in g)]


def is_supplier_orders(columns):
    cols = {c.lower() for c in columns}
    return "order_date" in cols and bool({"received_date", "actual_delivery_date"} & cols)


def usable_rows(df, required):
    count = 0
    for _, row in df.iterrows():
        if all(any(n in row.index and has_value(row[n]) for n in g) for g in required):
            count += 1
    return count


def format_groups(groups, lang):
    word = " ou " if lang == "fr" else " or "
    return ", ".join(word.join(g) for g in groups)


def looks_like(table, columns, sector, business_type):
    """pipeline/upload_check.py looks_like, over the exported specs."""
    matches = []
    for (other_sector, other_type), entry in table.items():
        if (other_sector, other_type) == ("logistics", "transport"):
            continue
        if other_sector == sector and other_type == business_type:
            continue
        if not missing_groups(columns, entry["required"]):
            matches.append({"sector": other_sector, "business_type": other_type})
    specific = {m["sector"] for m in matches if m["business_type"]}
    return [m for m in matches if m["business_type"] or m["sector"] not in specific]


def evaluate(df, data, sector, business_type=None, ops_type=None, lang="fr"):
    """check_upload over a DataFrame: None when usable, else the error dict
    (error_code, message, missing, expected, looks_like), as the backend builds it."""
    lang = "en" if lang == "en" else "fr"
    messages = data["messages"]
    table = spec_table(data)
    columns = {clean_header(c) for c in df.columns}

    if len(df.dropna(how="all")) == 0:
        return {"error_code": "upload_empty", "message": messages["empty"][lang],
                "missing": [], "expected": [], "looks_like": []}
    if is_supplier_orders(columns):
        return None
    entry = spec_for(table, sector, business_type, ops_type)
    if entry is None:
        return None

    missing = missing_groups(columns, entry["required"])
    if missing:
        return {
            "error_code": "upload_columns_missing",
            "message": messages["missing"][lang].format(
                missing=format_groups(missing, lang), sample=", ".join(entry["sample"])),
            "missing": missing,
            "expected": entry["sample"],
            "looks_like": looks_like(table, columns, sector, business_type),
        }

    renamed = df.rename(columns=clean_header)
    if [sector, business_type] in data["single_store"] and "store_id" in renamed.columns:
        stores = renamed["store_id"].dropna().astype(str).str.strip()
        n = stores[stores != ""].nunique()
        if n > 1:
            return {"error_code": "upload_wrong_department",
                    "message": messages["chain_file"][lang].format(n=n),
                    "missing": [], "expected": entry["sample"], "looks_like": ["chaine-magasins"]}

    if usable_rows(renamed, entry["required"]) == 0:
        return {
            "error_code": "upload_no_usable_rows",
            "message": messages["no_usable_rows"][lang].format(
                required=format_groups([list(g) for g in entry["required"]], lang)),
            "missing": [], "expected": entry["sample"], "looks_like": [],
        }
    return None


# ---------------------------------------------------------------- mapping

def load_json(path, what):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError) as error:
        raise InputError(f"{what} unreadable: {error}")


def find_mapping(map_dir, sector, business_type, headers):
    """The one mapping in a folder for this sector, business type and header set."""
    if not os.path.isdir(map_dir):
        raise InputError(f"--map-dir is not a folder: {map_dir}")
    found = []
    for name in sorted(os.listdir(map_dir)):
        if not name.endswith(".json"):
            continue
        path = os.path.join(map_dir, name)
        data = load_json(path, f"mapping {name}")
        if (isinstance(data, dict) and data.get("sector") == sector
                and data.get("business_type") == business_type
                and {clean_header(h) for h in data.get("source_headers", [])} == set(headers)):
            found.append((path, data))
    if len(found) > 1:
        raise InputError("more than one mapping matches this file: " + ", ".join(p for p, _ in found))
    return found[0] if found else (None, None)


def check_mapping(mapping, entry, sector, business_type, headers):
    """Returns (problems, plan). problems are (code, message); plan: header -> (target, options)."""
    problems = []
    if mapping.get("sector") != sector:
        problems.append(("mapping_wrong_sector", f"mapping is for {mapping.get('sector')!r}, the check is for {sector!r}"))
    if mapping.get("business_type") != business_type:
        problems.append(("mapping_wrong_business_type", f"mapping is for {mapping.get('business_type')!r}, the check is for {business_type!r}"))
    declared = mapping.get("source_headers")
    columns = mapping.get("columns", {})
    if not isinstance(declared, list) or not isinstance(columns, dict):
        raise InputError("mapping needs 'source_headers' (a list) and 'columns' (an object)")
    declared = {clean_header(h) for h in declared}
    if declared != set(headers):
        problems.append(("mapping_headers_differ",
                         f"only in the mapping: {sorted(declared - set(headers))}; only in the file: {sorted(set(headers) - declared)}"))

    types = entry["types"] if entry else {}
    plan = {}
    for source, rule in columns.items():
        source = clean_header(source)
        rule = {"to": rule} if isinstance(rule, str) else rule
        if not isinstance(rule, dict) or not isinstance(rule.get("to"), str):
            problems.append(("mapping_option_invalid", f"{source!r} needs a target name"))
            continue
        unknown = sorted(set(rule) - OPTIONS)
        if unknown:
            problems.append(("mapping_option_invalid", f"{source!r} has unknown option(s) {unknown}"))
            continue
        kind = types.get(rule["to"], {}).get("type")
        if kind and rule.get("strip_unit") and kind != "number":
            problems.append(("mapping_option_invalid", f"{source!r}: strip_unit is for number columns, {rule['to']!r} is {kind}"))
        if kind and (rule.get("date_in") or rule.get("month_end")) and kind != "date":
            problems.append(("mapping_option_invalid", f"{source!r}: date_in and month_end are for date columns, {rule['to']!r} is {kind}"))
        plan[source] = rule
    seen = {}
    for header in headers:
        target = plan[header]["to"] if header in plan else header
        if target in seen:
            problems.append(("mapping_duplicate_target", f"{seen[target]!r} and {header!r} both become {target!r}"))
        seen[target] = header
    return problems, plan


def transform(value, rule, kind, formats):
    """One cell after the mapping's stated options."""
    if not has_value(value):
        return None
    text = str(value).strip()
    if kind == "number" and rule.get("strip_unit"):
        text = UNIT.sub("", text).strip()
    if kind == "date":
        day = None
        if rule.get("date_in"):
            try:
                day = datetime.datetime.strptime(text, rule["date_in"]).date()
            except ValueError:
                pass
        if day is None and rule.get("month_end"):
            for pattern, read in MONTH_YEAR:
                match = pattern.match(text)
                if match:
                    year, month = read(match)
                    if 1 <= month <= 12:
                        day = datetime.date(year, month, 1)
        if day is None:
            day = parse_date(text, formats)
        if day is None:
            return text
        if rule.get("month_end"):
            day = day.replace(day=calendar.monthrange(day.year, day.month)[1])
        return day.isoformat()
    return text


def apply_mapping(df, plan, entry, formats):
    """Renames and transforms. Every column is kept, as the backend sees them all.
    Returns the frame, the mapped columns the schema does not list, and the unmapped ones it does not list."""
    types = entry["types"] if entry else {}
    out = pd.DataFrame(index=df.index)
    ignored, unused = [], []
    for column in df.columns:
        rule = plan.get(column, {"to": column})
        target = rule["to"]
        kind = types.get(target, {}).get("type")
        if kind is None:
            (ignored if column in plan else unused).append(column)
            out[target] = df[column]
        else:
            out[target] = [transform(v, rule, kind, formats) for v in df[column]]
    return out, ignored, unused


# ---------------------------------------------------------------- warnings and output

def cell_warnings(df, entry, data):
    found = []
    yes = {k: set(v) for k, v in data["yes_words"].items()}
    no = set(data["no_words"])
    for column, info in entry["types"].items():
        if column not in df.columns:
            continue
        kind = info["type"]
        cells = [(i, v) for i, v in df[column].items() if has_value(v)]
        if kind == "boolean":
            # The backend tests `is False`; one text value makes pandas read the column as strings.
            if not all(str(v).strip() in BOOL_SPELLINGS for _, v in cells):
                found += [(i + 2, column, v, "read as not set: the column holds text, so nothing in it is a boolean") for i, v in cells]
            continue
        for i, v in cells:
            reason = None
            if kind == "number" and parse_number(v) is None:
                reason = "read as empty: not a number"
            elif kind == "date" and parse_date(v, data["date_formats"]) is None:
                reason = "read as empty: date format not accepted"
            elif kind == "yesno" and yes_reading(v, yes["alerts"], no) is None:
                reason = "read as not set: no yes word"
            elif kind == "flag" and yes_reading(v, yes["port_flow"], no) is None:
                reason = "read as not set: no yes word"
            if reason:
                found.append((i + 2, column, v, reason))
    return found


def written_value(value, kind, data):
    if not has_value(value):
        return ""
    if kind == "number":
        n = parse_number(value)
        return "" if n is None else (str(int(n)) if n.is_integer() else repr(n))
    if kind == "date":
        d = parse_date(value, data["date_formats"])
        return d.isoformat() if d else ""
    if kind in ("yesno", "flag"):
        words = set(data["yes_words"]["alerts" if kind == "yesno" else "port_flow"])
        return yes_reading(value, words, set(data["no_words"])) or ""
    if kind == "boolean":
        return {"true": "True", "false": "False"}.get(str(value).strip().lower(), "")
    return str(value).strip()


def clean_frame(df, entry, data):
    lost, frame = [], pd.DataFrame(index=df.index)
    for column in df.columns:
        kind = entry["types"].get(column, {}).get("type")
        values = []
        for i, value in df[column].items():
            if kind is None:
                values.append(str(value).strip() if has_value(value) else "")
                continue
            written = written_value(value, kind, data)
            if has_value(value) and written == "":
                lost.append((i + 2, column, value))
            values.append(written)
        frame[column] = values
    return frame, lost


def name_of(item):
    return item if isinstance(item, str) else f"{item['sector']}/{item['business_type'] or 'default'}"


def refuse(out, error):
    print(f"outcome: refused, {error['error_code']}", file=out)
    print(f"  {error['message']}", file=out)
    if error.get("missing"):
        print("  missing groups: " + ", ".join(" or ".join(g) for g in error["missing"]), file=out)
    if error.get("looks_like"):
        print("  looks like: " + ", ".join(name_of(i) for i in error["looks_like"]), file=out)
    return 1


def check(csv_path, sector, business_type=None, ops_type=None, map_path=None, map_dir=None,
          write_path=None, today=None, lang="fr", out=None):
    """Returns 0 accepted, 1 refused. Raises InputError for bad inputs."""
    out = out or sys.stdout
    data = load_specs()
    today = datetime.date.fromisoformat(today) if today else datetime.date.today()
    raw = read_upload(csv_path)
    table = spec_table(data)
    entry = spec_for(table, sector, business_type, ops_type)
    print(f"spec: {entry['key']['sector']}/{entry['key']['business_type'] or 'default'}" if entry
          else f"spec: none for {sector}", file=out)

    plan, mapping = {}, None
    if map_path:
        mapping_file, mapping = map_path, load_json(map_path, "mapping")
    elif map_dir:
        mapping_file, mapping = find_mapping(map_dir, sector, business_type, list(raw.columns))
        if mapping is None:
            print("no mapping in --map-dir matches this file; columns keep their own names", file=out)
    if mapping is not None:
        if not isinstance(mapping, dict):
            raise InputError("mapping must be a JSON object")
        print(f"mapping: {mapping.get('export', '?')} / {mapping.get('client', '?')} ({os.path.basename(mapping_file)})", file=out)
        problems, plan = check_mapping(mapping, entry, sector, business_type, list(raw.columns))
        for code, message in problems:
            print(f"  mapping problem [{code}]: {message}", file=out)
        for note in mapping.get("assumptions", []):
            print(f"  assumption: {note}", file=out)
        if problems:
            return refuse(out, {"error_code": problems[0][0], "message": "The mapping does not fit this file."})

    df, ignored, unused = apply_mapping(raw, plan, entry, data["date_formats"])
    if ignored:
        print(f"ignored (mapped to a name the spec does not list): {ignored}", file=out)
    if unused:
        print(f"not in the spec, kept and not checked: {unused}", file=out)

    error = evaluate(df, data, sector, business_type, ops_type, lang)
    if error:
        return refuse(out, error)

    warnings = cell_warnings(df, entry, data) if entry and not is_supplier_orders(list(df.columns)) else []
    if warnings:
        print(f"cells the backend would read as empty or not set: {len(warnings)}", file=out)
        for line, column, value, reason in warnings[:SHOWN]:
            print(f"  line {line}, {column}: {value!r} {reason}", file=out)
        if len(warnings) > SHOWN:
            print(f"  ... {len(warnings) - SHOWN} more", file=out)
    else:
        print("cells the backend would read as empty or not set: none", file=out)

    if "expiry_date" in df.columns:
        past = sum(1 for v in df["expiry_date"] if (d := parse_date(v, data["date_formats"])) and d < today)
        print(f"expiry dates before {today.isoformat()}: {past}", file=out)
    dupes = df[df.duplicated(keep=False)]
    if len(dupes):
        print(f"duplicate rows (kept): {len(dupes)}, first at line {int(dupes.index[0]) + 2}", file=out)

    frame = None
    if write_path:
        frame, lost = clean_frame(df, entry or {"types": {}}, data)
        if lost:
            raise InputError(f"not written: {len(lost)} filled cells would be lost (listed above); fix the mapping first")
        if any(";" in str(c) for c in frame.columns):
            raise InputError("not written: a column name holds ';', so the backend would split the header wrongly")
    print("outcome: accepted", file=out)
    if frame is not None:
        frame.to_csv(write_path, index=False, encoding="utf-8")
        print(f"written: {write_path} ({len(frame)} rows)", file=out)
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("csv")
    parser.add_argument("--sector", required=True)
    parser.add_argument("--business-type", default=None)
    parser.add_argument("--ops-type", default=None)
    parser.add_argument("--map", dest="map_path")
    parser.add_argument("--map-dir")
    parser.add_argument("--write")
    parser.add_argument("--today")
    parser.add_argument("--lang", default="fr", choices=["fr", "en"])
    a = parser.parse_args(argv)
    try:
        return check(a.csv, a.sector, a.business_type, a.ops_type, a.map_path, a.map_dir,
                     a.write, a.today, a.lang)
    except (InputError, OSError, ValueError) as error:
        print(f"input error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
