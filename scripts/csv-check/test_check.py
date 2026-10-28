"""Tests for check.py and the schema and mapping files. Run: python3 -m unittest scripts/csv-check/test_check.py"""
import importlib.util
import json
import os
import re
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
spec = importlib.util.spec_from_file_location("check", os.path.join(HERE, "check.py"))
check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)


class ParseValue(unittest.TestCase):
    def test_unit_letter_is_removed_when_asked(self):
        self.assertEqual(check.parse_value("int", "3W", {"strip_unit": True}, {}), ("3", None))

    def test_unit_letter_is_an_error_when_not_asked(self):
        self.assertEqual(check.parse_value("int", "3W", {}, {})[1], "not a whole number")

    def test_money_drops_commas(self):
        self.assertEqual(check.parse_value("money", "1,175.00", {}, {}), ("1175.00", None))

    def test_month_end_date(self):
        value, error = check.parse_value("date", "Feb-27", {"date_in": "%b-%y", "month_end": True}, {"date_formats": []})
        self.assertEqual((value, error), ("2027-02-28", None))

    def test_bad_date_is_reported(self):
        self.assertEqual(check.parse_value("date", "31/02/27", {}, {"date_formats": ["%Y-%m-%d"]})[1], "date not readable")

    def test_empty_value_is_empty(self):
        self.assertEqual(check.parse_value("int", "  ", {}, {}), ("", None))


class Mappings(unittest.TestCase):
    def setUp(self):
        self.schema = check.load_schema("pharmacie")
        with open(os.path.join(HERE, "mappings", "axcess-branch-transfer-report.json"), encoding="utf-8") as fh:
            self.mapping = json.load(fh)
        self.headers = self.mapping["headers"]

    def test_every_mapping_file_is_sound(self):
        for path, data in check.load_mappings():
            schema_name = data["department"]
            schema = check.load_schema(schema_name)
            self.assertEqual(check.check_mapping(data, schema, data["headers"], schema_name), [], path)

    def test_a_mapping_is_found_by_its_headers(self):
        path, data = check.find_mapping(self.headers, "pharmacie")
        self.assertEqual(data["export"], self.mapping["export"])

    def test_a_different_file_finds_no_mapping(self):
        self.assertEqual(check.find_mapping(["medicine_name", "stock_qty"], "pharmacie"), (None, None))

    def test_wrong_department_is_refused(self):
        problems = check.check_mapping(self.mapping, self.schema, self.headers, "laboratoire")
        self.assertTrue(any("department" in p for p in problems))

    def test_header_mismatch_is_refused(self):
        problems = check.check_mapping(self.mapping, self.schema, self.headers[:-1], "pharmacie")
        self.assertTrue(any("headers differ" in p for p in problems))


class WriteGuard(unittest.TestCase):
    def test_no_clean_file_when_a_required_column_is_missing(self):
        import subprocess, sys, tempfile
        with tempfile.TemporaryDirectory() as d:
            src = os.path.join(d, "in.csv")
            with open(src, "w", encoding="utf-8") as fh:
                fh.write("medicine_name,stock_qty\nA,1\n")
            out = os.path.join(d, "out.csv")
            result = subprocess.run([sys.executable, os.path.join(HERE, "check.py"), src,
                                     "--schema", "pharmacie", "--write", out], capture_output=True, text=True)
            self.assertEqual(result.returncode, 1)
            self.assertFalse(os.path.exists(out))
            self.assertIn("Not written", result.stdout)


class SchemaDrift(unittest.TestCase):
    """The schema must list the same required columns as the app's list (lib/csv-columns.ts)."""

    def test_pharmacie_matches_the_app_list(self):
        with open(os.path.join(ROOT, "lib", "csv-columns.ts"), encoding="utf-8") as fh:
            source = fh.read()
        block = re.search(r'"pharmacie": \[(.*?)\]', source, re.S).group(1)
        app_columns = re.findall(r'"([a-z_0-9]+)"', block)
        schema_columns = list(check.load_schema("pharmacie")["columns"])
        self.assertEqual(sorted(app_columns), sorted(schema_columns))


if __name__ == "__main__":
    unittest.main()
