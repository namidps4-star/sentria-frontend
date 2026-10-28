"""The mapping layer: options change the written output, and a mapping that
does not fit the file or the schema is refused before anything is written."""
import copy
import io
import os
import tempfile
import unittest

import check
from support import EXAMPLES, load_example_mapping, run, write_mapping

EXAMPLE_CSV = os.path.join(EXAMPLES, "health-pharmacie.example.csv")


class MappingTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = self.tmp.name

    def tearDown(self):
        self.tmp.cleanup()

    def mapping(self, change=None):
        data = copy.deepcopy(load_example_mapping())
        if change:
            change(data)
        return write_mapping(os.path.join(self.dir, "m.json"), data)

    def test_the_example_is_accepted(self):
        code, report = run(EXAMPLE_CSV, "health", "pharmacie", self.mapping())
        self.assertEqual(code, 0, report)
        self.assertIn("outcome: accepted", report)

    def test_the_example_writes_the_values_the_backend_reads(self):
        target = os.path.join(self.dir, "out.csv")
        code, _ = run(EXAMPLE_CSV, "health", "pharmacie", self.mapping(), target)
        self.assertEqual(code, 0)
        with open(target, encoding="utf-8") as f:
            lines = f.read().splitlines()
        self.assertEqual(lines[1], "Doliprane 1g,42,10,35,2.5,2027-03-05,rayon 2")

    def test_strip_unit_off_is_reported_and_the_clean_copy_is_refused(self):
        def drop_strip(data):
            data["columns"]["Qte stock"] = {"name": "stock_qty"}
        target = os.path.join(self.dir, "out.csv")
        report = io.StringIO()
        with self.assertRaises(check.InputError):
            check.check(EXAMPLE_CSV, "health", "pharmacie", self.mapping(drop_strip), target, out=report)
        self.assertIn("read as empty: not a number", report.getvalue())
        self.assertFalse(os.path.exists(target))

    def test_the_report_alone_still_accepts_without_strip_unit(self):
        def drop_strip(data):
            data["columns"]["Qte stock"] = {"name": "stock_qty"}
        code, report = run(EXAMPLE_CSV, "health", "pharmacie", self.mapping(drop_strip))
        self.assertEqual(code, 0, report)
        self.assertIn("line 2, stock_qty", report)

    def test_date_in_off_is_reported_and_the_clean_copy_is_refused(self):
        def drop_date(data):
            data["columns"]["Peremption"] = {"name": "expiry_date"}
        target = os.path.join(self.dir, "out.csv")
        report = io.StringIO()
        with self.assertRaises(check.InputError):
            check.check(EXAMPLE_CSV, "health", "pharmacie", self.mapping(drop_date), target, out=report)
        self.assertIn("expiry_date", report.getvalue())
        self.assertFalse(os.path.exists(target))

    def test_wrong_sector_is_refused_and_nothing_is_written(self):
        target = os.path.join(self.dir, "out.csv")
        code, report = run(EXAMPLE_CSV, "health", "pharmacie", self.mapping(lambda d: d.update(sector="retail")), target)
        self.assertEqual(code, 1)
        self.assertIn("mapping_wrong_sector", report)
        self.assertFalse(os.path.exists(target))

    def test_headers_that_differ_are_refused(self):
        code, report = run(EXAMPLE_CSV, "health", "pharmacie",
                           self.mapping(lambda d: d["source_headers"].remove("Notes")))
        self.assertEqual(code, 1)
        self.assertIn("mapping_headers_differ", report)

    def test_two_columns_on_one_target_are_refused(self):
        code, report = run(EXAMPLE_CSV, "health", "pharmacie",
                           self.mapping(lambda d: d["columns"].update({"Notes": {"name": "medicine_name"}})))
        self.assertEqual(code, 1)
        self.assertIn("mapping_duplicate_target", report)

    def test_a_target_outside_the_schema_is_refused(self):
        code, report = run(EXAMPLE_CSV, "health", "pharmacie",
                           self.mapping(lambda d: d["columns"].update({"Notes": {"name": "remarks"}})))
        self.assertEqual(code, 1)
        self.assertIn("mapping_unknown_target", report)

    def test_strip_unit_on_a_text_column_is_refused(self):
        code, report = run(EXAMPLE_CSV, "health", "pharmacie",
                           self.mapping(lambda d: d["columns"].update({"Article": {"name": "medicine_name", "strip_unit": True}})))
        self.assertEqual(code, 1)
        self.assertIn("mapping_option_invalid", report)


if __name__ == "__main__":
    unittest.main()
