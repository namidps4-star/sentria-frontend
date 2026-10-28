# CSV mapping notes

The checker in `scripts/csv-check/` takes a client's CSV export, maps its headers to the names the SentrIA backend expects, runs the backend's upload checks in the same order, and reports the cells the backend would silently skip. It can write a clean copy of the file. It reads the backend's rules and never changes the backend.

Nothing in the repo depends on one client's file. The only example is invented.

## Files

- `check.py`: the checker.
- `export_schemas.py`: builds `schemas/` from the backend. Read-only on the backend.
- `column_types.py`: the column types, written by hand. The backend declares no types.
- `schemas/`: one JSON file per sector and activity. Each file records the backend commit it came from.
- `examples/`: one invented mapping, its CSV, and nothing else.
- `tests/`: unit tests. The parity tests also run when a backend checkout is found.

## Running it

```
python3 scripts/csv-check/check.py FILE.csv --sector health --activity pharmacie
python3 scripts/csv-check/check.py FILE.csv --sector health --activity pharmacie \
    --map MAPPING.json --write clean.csv
python3 -m unittest discover -s scripts/csv-check/tests
```

Regenerate the schemas after a backend change:

```
python3 scripts/csv-check/export_schemas.py --backend PATH_TO_SENTRIA_BACKEND
```

The tests look for the backend at `../sentria` next to this repo, or at the path in `SENTRIA_BACKEND`. Without it, the five parity tests skip and the rest still run.

Exit codes: `0` accepted, `1` refused, `2` the inputs cannot be used (unreadable file, a mapping that is not JSON, a sector with no schema, or a `--write` that would lose filled cells).

## What the checker does

- a. Reads the file the way `read_upload` does: the separator comes from the first line, and the BOM and spaces are stripped from headers.
- b. Loads the schema for the sector and activity, and falls back to the sector default, as `spec_for` does.
- c. Applies the mapping, if one is given. A mapping problem refuses the file, and nothing is written.
- d. Runs the refusal order of `check_upload`: no data rows, supplier order files accepted, missing column groups, more than one store in a one-shop activity, and no usable row.
- e. Warns on each cell the backend would read as empty or as not set. A warning does not refuse the file.
- f. Reports duplicate rows. They are kept.
- g. Writes the clean copy only when the file is accepted and no filled cell would come out empty.

## Mapping file

```json
{
  "client": "label for the report",
  "sector": "health",
  "activity": "pharmacie",
  "source_headers": ["Article", "Qte stock", "Notes"],
  "columns": {
    "Article": {"name": "medicine_name"},
    "Qte stock": {"name": "stock_qty", "strip_unit": true},
    "Peremption": {"name": "expiry_date", "date_in": "%d.%m.%Y"}
  }
}
```

- `source_headers` lists the file's headers exactly. A header that is in one list and not the other refuses the file.
- `columns` maps a header to a schema column. A header not listed keeps its own name. If its own name is not a schema column, the checker reports it and does not check it.
- `name` is the schema column. It is required.
- `strip_unit` removes a trailing unit (`42 u` becomes `42`). Number columns only.
- `date_in` is the `strptime` format the client writes. Date columns only.
- `month_end` turns `2026-03` or `03/2026` into the last day of that month. Date columns only.

A mapping that fits no schema column, that targets the same column twice, or that uses an option on the wrong type is refused. The refusal codes are `mapping_wrong_sector`, `mapping_wrong_activity`, `mapping_headers_differ`, `mapping_unknown_target`, `mapping_duplicate_target` and `mapping_option_invalid`.

## Backend findings

These are the facts the checker is built around. Each one is a place where the backend does something the code does not make obvious.

1. The backend declares no column types. `column_types.py` gives each schema column a type. Each entry says where its basis comes from. `read` means a backend reader is shown reading that column that way (35 columns). `name` means the type is guessed from the column name (62 columns). Correct a `name` entry when you find the reader code.

2. The yes words differ between readers. The yes/no reader in `pipeline/alerts.py` accepts `1`, `o`, `oui`, `true`, `y` and `yes`. The flag reader in `pipeline/port_flow.py` (`_flag`, line 93) also accepts `1.0` and `x`. The checker keeps the two lists apart, and a column uses the list of its own reader. A `Y` in a yes/no column is read as yes, and an `x` in the same column is read as not set.

3. Pandas changes the type of a column that has a blank cell. A column of `1` values with one blank comes in as `1.0`. The yes/no reader does not list `1.0`, so every `1` in that column is read as not set, with no error. The checker warns on those cells.

4. The hygiene alert fires only on `row.get("hygiene_control_passed") is False` (`pipeline/alerts.py`, around line 964). Pandas gives a boolean only when the whole column reads as true/false. One text value in the column turns every cell into a string, and the alert never fires. The checker treats such a column as unread and warns on every cell in it.

5. "Usable row" means a row where each required group has a filled cell. It does not mean a readable one. A stock cell of `3 u` makes its row usable, but the number reader reads it as empty. The checker warns on the cell and refuses to write a clean copy that would drop it.

6. The sample shown to the user does not list every required name. Some required groups accept names the sample never shows, for example `sku` and `store_id` in the retail samples, and `medicine_name` in the clinical and grossiste samples. The checker uses the required groups for every check. The sample only appears in the refusal message.

7. `check_upload` accepts a file for a sector it does not know, because `spec_for` returns nothing. The checker exits `2` for an unknown sector instead. An unknown sector is an input error, not a file error.

8. Supplier order files (an `order_date` plus a delivery date) skip the column check. The checker skips the cell warnings for them too. Whether the backend runs the cell readers on these files was not checked.

## Not verified

- No real client file was run. The only inputs were the invented example and one generated sample row per schema.
- The French refusal texts were not compared. Only the English texts were checked against the backend.
- A file with a BOM was not tested. The header cleaning is the backend's code, copied, and was checked only by reading it.
- The yes-word lists were taken from the backend source by AST extraction in `export_schemas.py`. They were not re-read by hand for this document.
- The 62 `name` entries in `column_types.py` are guesses from the column name. Their readers were not checked one by one.
- A decimal comma (`1,5`) is refused as not a number. The checker does not convert it, and no client has been checked for this.
- The schemas match backend commit `45e8b06`, which is recorded in each file. Nothing checks them against a later backend automatically.
- The frontend's sample list (`CSV_COLUMNS` in `onboarding-modal.tsx`) was not compared with the schema samples.
- The checker is not run in CI.
- Pandas was tested with the version installed here only.
- Of the backend suite, only `tests/check_upload_check.py` was run, and it passed. The rest of the backend suite was not run.
