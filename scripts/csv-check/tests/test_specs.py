"""The exported specs cover the backend, and every sample and missing group behaves."""
import os
import subprocess
import sys
import tempfile
import unittest

from support import BACKEND, CHECK_DIR, DATA, SKIP_MESSAGE, TABLE, backend, run, sample_header_row, write_rows

uc = backend("pipeline.upload_check")


class SpecTests(unittest.TestCase):
    def test_all_25_keys_are_present_in_backend_order(self):
        self.assertEqual(len(DATA["specs"]), 25)
        self.assertEqual(len(TABLE), 25)

    def test_every_sample_is_accepted(self):
        with tempfile.TemporaryDirectory() as tmp:
            for (sector, bt), entry in TABLE.items():
                with self.subTest(key=(sector, bt)):
                    header, row = sample_header_row(entry)
                    code, report = run(write_rows(os.path.join(tmp, "s.csv"), header, [row]), sector, bt)
                    self.assertEqual(code, 0, report)

    def test_a_file_missing_one_group_is_refused_and_names_it(self):
        with tempfile.TemporaryDirectory() as tmp:
            for (sector, bt), entry in TABLE.items():
                for group in entry["required"]:
                    present = [n for n in group if n in entry["sample"]]
                    with self.subTest(key=(sector, bt), group=group):
                        header, row = sample_header_row(entry, drop=present)
                        code, report = run(write_rows(os.path.join(tmp, "m.csv"), header, [row]), sector, bt)
                        self.assertEqual(code, 1, report)
                        self.assertIn("upload_columns_missing", report)
                        self.assertIn(" or ".join(group), report)

    def test_every_spec_column_has_a_type(self):
        for entry in DATA["specs"]:
            for group in entry["required"]:
                for name in group:
                    self.assertIn(name, entry["types"])
            for name in entry["sample"]:
                self.assertIn(name, entry["types"])

    def test_pharmacy_requires_two_columns(self):
        self.assertEqual(TABLE[("health", "pharmacie")]["required"], [["medicine_name"], ["stock_qty"]])

    @unittest.skipIf(uc is None, SKIP_MESSAGE)
    def test_required_groups_equal_the_backend(self):
        for (sector, bt), spec in uc.SPECS.items():
            with self.subTest(key=(sector, bt)):
                self.assertEqual(TABLE[(sector, bt)]["required"], [list(g) for g in spec["required"]])
                self.assertEqual(TABLE[(sector, bt)]["sample"], list(spec["sample"]))
        self.assertEqual(list(TABLE), list(uc.SPECS))

    @unittest.skipIf(uc is None, SKIP_MESSAGE)
    def test_export_check_passes(self):
        result = subprocess.run(
            [sys.executable, os.path.join(CHECK_DIR, "export_specs.py"), "--backend", BACKEND, "--check"],
            capture_output=True, text=True, env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"})
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
