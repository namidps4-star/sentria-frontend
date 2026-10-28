# CSV mapping notes

`scripts/csv-check/` pre-checks a CSV the way the SentrIA backend will. It maps a client's headers to the backend's names, runs the backend's upload checks in the backend's order, warns about cells the backend would read as empty, and can write a clean copy. The backend has the final word. Nothing in the repo depends on one customer's file.

## Files

- `export_specs.py`: reads the backend and writes `specs/upload_specs.json`. Never edit that file by hand.
- `column_types.py`: the column types. The backend declares none, so this one table is hand-written.
- `check.py`: the checker.
- `mappings/example.json`: one invented mapping, marked `"example": true`. Real client mappings live outside the repo.
- `tests/`: unit tests, and `cross_check.py`, which compares the checker with the backend.
- `docs/csv-backend-cross-check.md`: the saved comparison table.

## Running it

```
python3 scripts/csv-check/check.py FILE.csv --sector health --business-type pharmacie
python3 scripts/csv-check/check.py FILE.csv --sector health --business-type pharmacie \
    --map MAPPING.json --write clean.csv
python3 scripts/csv-check/check.py FILE.csv --sector health --business-type pharmacie \
    --map-dir FOLDER_OUTSIDE_THE_REPO
python3 scripts/csv-check/check.py FILE.csv --sector logistics --ops-type transport
```

Tests (the backend tests need `SENTRIA_BACKEND` set to a checkout; without it they skip with a message):

```
SENTRIA_BACKEND=/path/to/Sentria python3 -m unittest discover -s scripts/csv-check/tests
```

Regenerate or check the specs, and rebuild the comparison table:

```
python3 scripts/csv-check/export_specs.py --backend /path/to/Sentria
python3 scripts/csv-check/export_specs.py --backend /path/to/Sentria --check
SENTRIA_BACKEND=/path/to/Sentria python3 scripts/csv-check/tests/cross_check.py \
    --write docs/csv-backend-cross-check.md
```

Exit codes: `0` accepted, `1` refused, `2` bad inputs (unreadable file, a mapping that is not JSON, or a `--write` that would lose filled cells).

## Order of checks

The file is read as `read_upload` reads it. The mapping is applied, then `check_upload`'s order runs: no data rows (`upload_empty`), supplier order file (accepted), no spec for the sector (accepted), missing required group (`upload_columns_missing`), several stores in a one-shop activity (`upload_wrong_department`), no usable row (`upload_no_usable_rows`). The refusal message, the missing groups, the expected list and `looks_like` come from the exported `MESSAGES` and `SPECS` and match the backend (see the cross-check table).

Warnings never refuse a file: a date outside the backend's formats, a number `float()` cannot read, a yes/no the reader does not know, and a boolean column that holds text. Duplicate rows are reported and kept.

`--write` writes the mapped rows with ISO dates and plain numbers. It writes nothing when the file is refused, and nothing when a filled cell would come out empty, because the clean file could then fail the backend's own check.

## Mapping file

```json
{
  "example": true,
  "export": "name of the export",
  "client": "label",
  "sector": "health",
  "business_type": "pharmacie",
  "source_headers": ["Item", "On hand", "Best before"],
  "columns": {
    "Item": "medicine_name",
    "On hand": {"to": "stock_qty", "strip_unit": true},
    "Best before": {"to": "expiry_date", "date_in": "%b-%y", "month_end": true}
  },
  "assumptions": ["what the mapping takes for granted, one line each"]
}
```

- `source_headers` must equal the file's headers. A difference refuses the file.
- A column with no entry keeps its name. A column mapped to a name the spec does not list is reported as ignored.
- `strip_unit`: removes a trailing unit (`42 pcs` becomes `42`). Number columns only.
- `date_in`: the `strptime` format the client writes. Date columns only.
- `month_end`: moves the date to the last day of its month; alone, it reads `2026-03` or `03/2026`. Date columns only.
- No option is ever assumed. Each one is written in the file.

Mapping refusal codes: `mapping_wrong_sector`, `mapping_wrong_business_type`, `mapping_headers_differ`, `mapping_duplicate_target`, `mapping_option_invalid`.

## Backend findings

1. The backend declares no column types, so `column_types.py` holds them. Each entry says whether the type was read from a backend reader (`read`, 35 columns) or taken from the column name (`name`, 62 columns).
2. The yes words differ between readers. The yes/no reader in `pipeline/alerts.py` accepts `1`, `o`, `oui`, `true`, `y`, `yes`. `_flag` in `pipeline/port_flow.py` also accepts `1.0` and `x`. The checker keeps the lists apart.
3. Pandas reads a column of `1` values with one blank cell as `1.0`. The yes/no reader does not list `1.0`, so those cells are read as not set.
4. The hygiene alert fires on `row.get("hygiene_control_passed") is False` (`pipeline/alerts.py`, near line 964). One text value in the column turns the whole column into strings and the alert never fires.
5. A usable row means each required group has a filled cell, not a readable one. `3 u` in a stock column makes the row usable while the number reader returns nothing.
6. The sample list does not show every required name (for example `sku` and `store_id` in the retail samples).
7. `check_upload` accepts any file for a sector with no spec. The checker does the same.

## Backend changes needed

None of these blocks the checker. Each would remove a place where the checker has to read the backend's source or keep its own table.

1. Declare a type for each column in `SPECS` (or beside it), so `column_types.py` is not needed.
2. Name the date formats as a constant. `export_specs.py` now reads them from the source of `_parse_date`.
3. Name the yes-word lists as constants, and use one list in both readers. `export_specs.py` now finds the literal tuples in `alerts.py` and `port_flow.py`.
4. Read yes/no words in the hygiene check, or normalise text to booleans, so one text value does not switch the alert off for the whole column.
5. Make the yes/no reader accept `1.0`, or read the column as text.
6. Count a row as usable only when the required numeric cell is readable.

## Not verified

- No real client file was run. The inputs were the invented example and rows built from the exported samples.
- No upload was made through the live `/upload` endpoint. That needs a running server and a sign-in. The cross-check calls `check_upload` directly.
- The yes/no reader in `alerts.py` is an inline tuple, so there is no backend helper to import. Its word list was taken from the source, and the comparison for flag columns uses `_flag` only.
- The 62 `name` entries in `column_types.py` are typed from the column name. Their readers were not checked one by one.
- Files in an encoding other than UTF-8, and decimal commas (`1,5`), were not tested. The checker warns on `1,5` and does not convert it.
- The specs were exported from the backend checkout at commit `45e8b06`. The task named `e95ed25` or later; that commit is not in this checkout's history, but `upload_check.py`, `alerts.py`, `port_flow.py`, `column_guide.py` and `tests/check_upload_check.py` are identical at both commits.
- The frontend's `CSV_COLUMNS` list in `onboarding-modal.tsx` was not compared with the exported samples.
- The checker is not wired into CI.
- Pandas was tested at the version installed here only.
