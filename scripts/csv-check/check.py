#!/usr/bin/env python3
"""Pre-checks a stock CSV before it is uploaded. The backend's check is the final word.

    python scripts/csv-check/check.py FILE.csv --schema pharmacie
    python scripts/csv-check/check.py FILE.csv --schema pharmacie --map MAP.json
    python scripts/csv-check/check.py FILE.csv --schema pharmacie --map MAP.json --write OUT.csv
    python scripts/csv-check/check.py FILE.csv --schema pharmacie --today 2026-10-28

--schema  a file in scripts/csv-check/schemas/ (no .json), one per department.
--map     a mapping file in scripts/csv-check/mappings/. Without --map the checker
          looks for the one whose headers match the file and whose department
          matches --schema. A mapping names its export, department and headers,
          and lists its columns and its assumptions. Column rules:
              "Their column": "our column"
              "Their column": {"to": "our column", "strip_unit": true,
                               "date_in": "%b-%y", "month_end": true}
--write   writes the mapped rows as a clean CSV: ISO dates, plain numbers.

Column types: text, int, number, money (commas allowed), date, bool.
Named checks (listed in the schema's "checks"):
  expiry_buckets   counts and values by months to expiry, from --today
  duplicate_lines  exact duplicate rows

Standard library only. Exit 0 when no required column is missing, 1 when one is.
"""
import argparse
import calendar
import csv
import datetime
import json
import os
import re
import sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
SHOW = 5  # examples printed per problem
TRUE_WORDS = {"yes", "y", "true", "1"}
FALSE_WORDS = {"no", "n", "false", "0"}


def load_schema(name):
    path = os.path.join(HERE, "schemas", f"{name}.json")
    if not os.path.exists(path):
        sys.exit(f"No schema called {name}. Looked in {path}")
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def load_mappings():
    """Every mapping file in mappings/, as (path, data)."""
    folder = os.path.join(HERE, "mappings")
    found = []
    for name in sorted(os.listdir(folder)):
        if name.endswith(".json"):
            path = os.path.join(folder, name)
            with open(path, encoding="utf-8") as fh:
                found.append((path, json.load(fh)))
    return found


def find_mapping(headers, schema_name):
    """The one mapping whose headers match the file and whose department matches the schema."""
    matches = [
        (path, data) for path, data in load_mappings()
        if data.get("department") == schema_name and set(data.get("headers", [])) == set(headers)
    ]
    return matches[0] if len(matches) == 1 else (None, None)


def check_mapping(data, schema, headers, schema_name):
    """A target the schema does not list is fine: the column is ignored."""
    """Returns a list of problems with a mapping file. Empty when it is sound."""
    problems = []
    if data.get("department") != schema_name:
        problems.append(f"department is {data.get('department')!r}, schema is {schema_name!r}")
    listed = set(data.get("headers", []))
    if listed != set(headers):
        problems.append(f"headers differ from the file: only in file {sorted(set(headers) - listed)}, "
                        f"only in mapping {sorted(listed - set(headers))}")
    for source in data.get("columns", {}):
        if source not in listed:
            problems.append(f"{source!r} is mapped but is not one of the mapping's headers")
    return problems


def mapping_rules(data):
    """Long form for every source column: {"to": ..., options}."""
    return {
        source: (rule if isinstance(rule, dict) else {"to": rule})
        for source, rule in data.get("columns", {}).items()
    }


def parse_value(kind, text, options, schema):
    """Returns (value, error). value is the clean form written to --write."""
    text = (text or "").strip()
    if text == "":
        return "", None
    if kind == "text":
        return text, None
    if kind == "int":
        if options.get("strip_unit"):
            text = re.sub(r"[A-Za-z]{1,3}$", "", text).strip()
        if re.fullmatch(r"\d+", text):
            return str(int(text)), None
        return text, "not a whole number"
    if kind == "number":
        try:
            return str(float(text)), None
        except ValueError:
            return text, "not a number"
    if kind == "money":
        cleaned = text.replace(",", "")
        try:
            return f"{float(cleaned):.2f}", None
        except ValueError:
            return text, "not an amount"
    if kind == "bool":
        word = text.lower()
        if word in TRUE_WORDS:
            return "true", None
        if word in FALSE_WORDS:
            return "false", None
        return text, "not yes or no"
    if kind == "date":
        formats = [options["date_in"]] if options.get("date_in") else schema["date_formats"]
        for fmt in formats:
            try:
                day = datetime.datetime.strptime(text, fmt).date()
            except ValueError:
                continue
            if options.get("month_end"):
                day = datetime.date(day.year, day.month, calendar.monthrange(day.year, day.month)[1])
            return day.isoformat(), None
        return text, "date not readable"
    return text, f"unknown type {kind}"


def months_between(today, when):
    return (when.year - today.year) * 12 + (when.month - today.month)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("csv_file")
    parser.add_argument("--schema", required=True)
    parser.add_argument("--map", dest="map_file")
    parser.add_argument("--write")
    parser.add_argument("--today")
    args = parser.parse_args()

    schema = load_schema(args.schema)
    columns = schema["columns"]
    today = datetime.date.fromisoformat(args.today) if args.today else datetime.date.today()

    with open(args.csv_file, encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        source_columns = reader.fieldnames or []
        source_rows = list(reader)

    if args.map_file:
        with open(args.map_file, encoding="utf-8") as fh:
            mapping_path, mapping = args.map_file, json.load(fh)
    else:
        mapping_path, mapping = find_mapping(source_columns, args.schema)
    if mapping is None:
        print("No mapping matches this file's headers. Columns keep their own names.")
        mapping = {"columns": {}}
    else:
        print(f"Mapping: {mapping.get('export')} ({os.path.basename(mapping_path)})")
        problems = check_mapping(mapping, schema, source_columns, args.schema)
        if problems:
            print("Mapping problems:")
            for problem in problems:
                print(f"  {problem}")
            return 1
    mapping_assumptions = mapping.get("assumptions", [])

        # Which of our columns each source column becomes.
    rules = mapping_rules(mapping)
    target_of = {col: rules.get(col, {"to": col}) for col in source_columns}
    targets = {rule["to"] for rule in target_of.values()}
    missing = [name for name, spec in columns.items() if spec["required"] and name not in targets]
    ignored = [c for c in source_columns if target_of[c]["to"] not in columns]

    print(f"File: {args.csv_file}")
    print(f"Schema: {schema['label']} ({args.schema})  |  Rows: {len(source_rows)}  |  Today: {today.isoformat()}")
    print(f"Required but missing: {', '.join(missing) or 'none'}")
    print(f"Columns not in the schema (ignored): {', '.join(ignored) or 'none'}")
    for note in mapping_assumptions:
        print(f"Assumption: {note}")
    print()

    problems = defaultdict(list)
    clean_rows = []
    lines = Counter()
    parsed = []  # (row dict in our names) for the named checks

    for number, row in enumerate(source_rows, start=2):
        lines[tuple(row.items())] += 1
        ours = {}
        for col, value in row.items():
            if col is None:
                continue
            rule = target_of.get(col, {"to": col})
            name = rule["to"]
            if name not in columns:
                continue
            spec = columns[name]
            clean, error = parse_value(spec["type"], value, rule, schema)
            if error:
                problems[f"{name}: {error}"].append(f"line {number}: {value!r}")
            elif spec["required"] and clean == "":
                problems[f"{name}: empty"].append(f"line {number}")
            ours[name] = clean
        for name in columns:
            ours.setdefault(name, "")
        clean_rows.append(ours)
        parsed.append(ours)

    if "expiry_buckets" in schema.get("checks", []):
        column = schema["expiry_column"]
        buckets = defaultdict(lambda: [0, 0.0])
        for ours in parsed:
            if not ours.get(column):
                continue
            when = datetime.date.fromisoformat(ours[column])
            months = months_between(today, when)
            if months < 0:
                key = "expired"
            elif months <= 6:
                key = "within 6 months"
            elif months <= 12:
                key = "6 to 12 months"
            else:
                key = "later than 12 months"
            buckets[key][0] += 1
            if ours.get("stock_qty") and ours.get("unit_cost"):
                buckets[key][1] += float(ours["stock_qty"]) * float(ours["unit_cost"])
        print("Expiry (count, and value = stock_qty x unit_cost):")
        for key in ["expired", "within 6 months", "6 to 12 months", "later than 12 months"]:
            count, total = buckets[key]
            print(f"  {key:<22} {count:>4}   {total:>14,.2f}")
        print()

    if "duplicate_lines" in schema.get("checks", []):
        dupes = [dict(k) for k, v in lines.items() if v > 1]
        print(f"Exact duplicate lines: {len(dupes)}")
        for d in dupes[:SHOW]:
            print("  " + " | ".join(str(v) for v in d.values()))
        print()

    print("Rows that would not parse:")
    if not problems:
        print("  none")
    for key, examples in problems.items():
        print(f"  {key}: {len(examples)}  e.g. {'; '.join(examples[:SHOW])}")

    if args.write:
        with open(args.write, "w", newline="", encoding="utf-8") as fh:
            writer = csv.DictWriter(fh, fieldnames=list(columns))
            writer.writeheader()
            writer.writerows(clean_rows)
        print(f"\nWrote {len(clean_rows)} rows to {args.write}")

    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
