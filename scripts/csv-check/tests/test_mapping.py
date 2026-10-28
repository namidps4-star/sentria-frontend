"""Mappings: what refuses, and what each stated option changes."""
import copy
import json
import os
import tempfile
import unittest

from support import check, example_mapping, run, write_rows

HEADER = ["Item", "On hand", "Reorder level", "Unit price", "Best before", "Remarks"]
ROWS = [["Sample A", "42 pcs", "10", "2.5", "Mar-27", "note"], ["Sample B", "3 pcs", "8", "4.1", "Nov-26", ""]]


class MappingTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = self.tmp.name
        self.csv = write_rows(os.path.join(self.dir, "in.csv"), HEADER, ROWS)

    def tearDown(self):
        self.tmp.cleanup()

    def mapping(self, change=None, name="m.json"):
        data = copy.deepcopy(example_mapping())
        if change:
            change(data)
        path = os.path.join(self.dir, name)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f)
        return path

    def written(self, change=None):
        target = os.path.join(self.dir, "out.csv")
        code, report = run(self.csv, "health", "pharmacie", map_path=self.mapping(change), write_path=target)
        with open(target, encoding="utf-8") as f:
            return f.read().splitlines()

    def test_the_example_is_accepted_and_marked_as_an_example(self):
        self.assertTrue(example_mapping()["example"])
        code, report = run(self.csv, "health", "pharmacie", map_path=self.mapping())
        self.assertEqual(code, 0, report)

    def test_wrong_sector_is_refused(self):
        code, report = run(self.csv, "health", "pharmacie", map_path=self.mapping(lambda d: d.update(sector="retail")))
        self.assertEqual(code, 1)
        self.assertIn("mapping_wrong_sector", report)

    def test_wrong_business_type_is_refused(self):
        code, report = run(self.csv, "health", "pharmacie", map_path=self.mapping(lambda d: d.update(business_type="laboratoire")))
        self.assertEqual(code, 1)
        self.assertIn("mapping_wrong_business_type", report)

    def test_headers_that_differ_from_the_file_are_refused(self):
        code, report = run(self.csv, "health", "pharmacie", map_path=self.mapping(lambda d: d["source_headers"].remove("Remarks")))
        self.assertEqual(code, 1)
        self.assertIn("mapping_headers_differ", report)

    def test_two_headers_to_one_name_are_refused(self):
        code, report = run(self.csv, "health", "pharmacie",
                           map_path=self.mapping(lambda d: d["columns"].update({"Remarks": "medicine_name"})))
        self.assertEqual(code, 1)
        self.assertIn("mapping_duplicate_target", report)

    def test_an_unknown_option_is_refused(self):
        code, report = run(self.csv, "health", "pharmacie",
                           map_path=self.mapping(lambda d: d["columns"].update({"Item": {"to": "medicine_name", "round": True}})))
        self.assertEqual(code, 1)
        self.assertIn("mapping_option_invalid", report)

    def test_a_mapped_column_the_spec_does_not_list_is_ignored_not_refused(self):
        code, report = run(self.csv, "health", "pharmacie",
                           map_path=self.mapping(lambda d: d["columns"].update({"Remarks": "vat"})))
        self.assertEqual(code, 0, report)
        self.assertIn("ignored", report)

    def test_strip_unit_changes_the_output_as_stated(self):
        self.assertEqual(self.written()[1].split(",")[1], "42")

    def test_without_strip_unit_the_unit_stays_and_the_write_is_refused(self):
        def no_strip(d):
            d["columns"]["On hand"] = "stock_qty"
        target = os.path.join(self.dir, "out.csv")
        with self.assertRaises(check.InputError):
            run(self.csv, "health", "pharmacie", map_path=self.mapping(no_strip), write_path=target)
        self.assertFalse(os.path.exists(target))

    def test_date_in_and_month_end_change_the_output_as_stated(self):
        self.assertEqual(self.written()[1].split(",")[4], "2027-03-31")
        def first_of_month(d):
            d["columns"]["Best before"] = {"to": "expiry_date", "date_in": "%b-%y"}
        self.assertEqual(self.written(first_of_month)[1].split(",")[4], "2027-03-01")

    def test_month_end_alone_reads_a_month_and_year(self):
        csv = write_rows(os.path.join(self.dir, "m.csv"), ["Item", "On hand", "Expiry"], [["A", "1", "03/2027"], ["B", "1", "2026-11"]])
        data = {"sector": "health", "business_type": "pharmacie", "source_headers": ["Item", "On hand", "Expiry"],
                "columns": {"Item": "medicine_name", "On hand": "stock_qty", "Expiry": {"to": "expiry_date", "month_end": True}}}
        path = os.path.join(self.dir, "me.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f)
        target = os.path.join(self.dir, "o.csv")
        run(csv, "health", "pharmacie", map_path=path, write_path=target)
        with open(target, encoding="utf-8") as f:
            self.assertEqual([l.split(",")[2] for l in f.read().splitlines()[1:]], ["2027-03-31", "2026-11-30"])

    def test_map_dir_picks_the_mapping_for_the_file(self):
        self.mapping(name="a.json")
        code, report = run(self.csv, "health", "pharmacie", map_dir=self.dir)
        self.assertEqual(code, 0, report)
        self.assertIn("mapping: EXAMPLE", report)

    def test_map_dir_without_a_match_keeps_names_and_is_refused_for_missing_columns(self):
        code, report = run(self.csv, "health", "pharmacie", map_dir=self.dir)
        self.assertEqual(code, 1)
        self.assertIn("no mapping in --map-dir", report)

    def test_refused_file_writes_nothing(self):
        target = os.path.join(self.dir, "out.csv")
        code, _ = run(self.csv, "health", "pharmacie", write_path=target)
        self.assertEqual(code, 1)
        self.assertFalse(os.path.exists(target))


if __name__ == "__main__":
    unittest.main()
