#!/usr/bin/env python3
"""Checks a prospect's stock CSV before it is uploaded to a demo site.

    python scripts/prospect_csv_check.py FILE.csv
    python scripts/prospect_csv_check.py FILE.csv --map map.json --today 2026-10-28

It reads the file on this machine only and prints a report. It sends nothing.

What it checks:
- the columns the pharmacy upload needs (the same list as CSV_COLUMNS["pharmacie"]
  in lib/csv-columns.ts), after the optional column map is applied
- rows that will not parse: quantity, cost, expiry date
- expiry buckets from --today: expired, within 6 months, 6 to 12 months, later
- exact duplicate lines and drug IDs that carry more than one expiry date

The default map fits the wholesaler export "RptBranchtransfer": Item Description
becomes medicine_name, Quantity becomes stock_qty (a trailing unit letter such as
"W" is dropped), Cost becomes unit_cost, Expiry date becomes expiry_date.
Pass --map with a JSON object of {"their column": "our column"} for another layout.

Standard library only. Exit 0 when the required columns are present, 1 when not.
"""
import argparse
import csv
import datetime
import json
import re
import sys
from collections import Counter, defaultdict

# Mirrors CSV_COLUMNS["pharmacie"] in lib/csv-columns.ts. Keep the two in step.
REQUIRED = ["medicine_name", "stock_qty", "min_stock", "sales_last_30_days", "unit_cost", "expiry_date"]

DEFAULT_MAP = {
    "Drug ID": "drug_id",
    "Item Description": "medicine_name",
    "Quantity": "stock_qty",
    "Cost": "unit_cost",
    "Total": "total",
    "Expiry date": "expiry_date",
}


def money(text):
    """'1,175.00' -> 1175.0. Empty or junk returns None."""
    cleaned = (text or "").replace(",", "").strip()
    try:
        return float(cleaned)
    except ValueError:
        return None


def quantity(text):
    """'1W' -> 1, '3W' -> 3, '10' -> 10. Returns None when no whole number is there."""
    match = re.fullmatch(r"\s*(\d+)\s*[A-Za-z]{0,2}\s*", text or "")
    return int(match.group(1)) if match else None


def expiry(text):
    """'Feb-27' -> date(2027, 2, 1). Accepts 'Feb-2027' and 'Feb 27' too."""
    for fmt in ("%b-%y", "%b-%Y", "%b %y", "%b %Y"):
        try:
            return datetime.datetime.strptime(text.strip(), fmt).date()
        except ValueError:
            continue
    return None


def months_between(today, when):
    return (when.year - today.year) * 12 + (when.month - today.month)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("csv_file")
    parser.add_argument("--map", help="JSON file: {\"their column\": \"our column\"}")
    parser.add_argument("--today", help="YYYY-MM-DD, defaults to the real date")
    args = parser.parse_args()

    column_map = DEFAULT_MAP
    if args.map:
        with open(args.map, encoding="utf-8") as fh:
            column_map = json.load(fh)
    today = datetime.date.fromisoformat(args.today) if args.today else datetime.date.today()

    with open(args.csv_file, encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        source_columns = reader.fieldnames or []
        rows = list(reader)

    mapped_columns = {column_map.get(c, c) for c in source_columns}
    missing = [c for c in REQUIRED if c not in mapped_columns]
    unmapped = [c for c in source_columns if c not in column_map]

    print(f"File: {args.csv_file}")
    print(f"Rows: {len(rows)}  |  Columns in file: {len(source_columns)}  |  Today: {today.isoformat()}")
    print(f"Unmapped source columns (kept as-is): {', '.join(unmapped) or 'none'}")
    print(f"Required by the pharmacy upload but missing: {', '.join(missing) or 'none'}")
    print()

    bad = Counter()
    buckets = defaultdict(lambda: [0, 0.0])
    ids = defaultdict(set)
    lines = Counter()

    for row in rows:
        r = {column_map.get(k, k): v for k, v in row.items()}
        lines[tuple(sorted(row.items()))] += 1
        if quantity(r.get("stock_qty")) is None:
            bad["quantity not a whole number"] += 1
        total = money(r.get("unit_cost")) if r.get("unit_cost") is not None else None
        if total is None and r.get("unit_cost") is not None:
            bad["cost not a number"] += 1
        when = expiry(r.get("expiry_date", ""))
        if when is None:
            bad["expiry date not readable"] += 1
            continue
        if r.get("drug_id"):
            ids[r["drug_id"]].add(when)
        months = months_between(today, when)
        if months < 0:
            key = "expired"
        elif months <= 6:
            key = "within 6 months"
        elif months <= 12:
            key = "6 to 12 months"
        else:
            key = "later than 12 months"
        value = money(r.get("total")) if r.get("total") is not None else total
        buckets[key][0] += 1
        buckets[key][1] += value or 0.0

    print("Expiry buckets (count, value in the file's currency):")
    for key in ["expired", "within 6 months", "6 to 12 months", "later than 12 months"]:
        count, value = buckets[key]
        print(f"  {key:<22} {count:>4}   {value:>14,.2f}")
    print()

    dupes = [dict(k) for k, v in lines.items() if v > 1]
    print(f"Exact duplicate lines: {len(dupes)}")
    for d in dupes:
        print(f"  {d.get('Drug ID', '?')}  {d.get('Item Description', '?')}  {d.get('Expiry date', '?')}")
    multi = {k: sorted(v) for k, v in ids.items() if len(v) > 1}
    print(f"Drug IDs with more than one expiry date: {len(multi)}")
    for k, v in multi.items():
        print(f"  {k}: {', '.join(d.strftime('%b-%y') for d in v)}")
    print()

    print("Rows that would not parse:")
    for k, v in bad.items():
        print(f"  {k}: {v}")
    if not bad:
        print("  none")

    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
