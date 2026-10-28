"""Every generated schema accepts its own sample and refuses a missing group by name."""
import os
import tempfile
import unittest

from support import SCHEMAS, check, run, sample_row, schema, write_rows


class SchemaTests(unittest.TestCase):
    def test_every_sample_is_accepted(self):
        with tempfile.TemporaryDirectory() as tmp:
            for (sector, activity), one in SCHEMAS.items():
                with self.subTest(schema=one["key"]):
                    columns, row = sample_row(one)
                    path = write_rows(os.path.join(tmp, "s.csv"), columns, [row])
                    code, report = run(path, sector, activity)
                    self.assertEqual(code, 0, report)

    def test_every_required_group_is_named_when_missing(self):
        with tempfile.TemporaryDirectory() as tmp:
            for (sector, activity), one in SCHEMAS.items():
                for group in one["required"]:
                    present = [n for n in group if n in one["sample"]]
                    if not present:
                        continue
                    with self.subTest(schema=one["key"], group=group):
                        columns, row = sample_row(one, drop=present)
                        path = write_rows(os.path.join(tmp, "m.csv"), columns, [row])
                        code, report = run(path, sector, activity)
                        self.assertEqual(code, 1, report)
                        self.assertIn("upload_columns_missing", report)
                        self.assertIn(" or ".join(group), report)

    def test_schema_types_cover_required_and_sample_columns(self):
        for one in SCHEMAS.values():
            for group in one["required"]:
                for name in group:
                    self.assertIn(name, one["types"], one["key"])
            for name in one["sample"]:
                self.assertIn(name, one["types"], one["key"])

    def test_single_store_chain_is_refused_for_one_shop_activities(self):
        one = schema("retail")
        with tempfile.TemporaryDirectory() as tmp:
            columns, row = sample_row(one)
            columns = columns + ["store_id"]
            rows = [row + ["S1"], row + ["S2"]]
            path = write_rows(os.path.join(tmp, "chain.csv"), columns, rows)
            code, report = run(path, "retail")
            self.assertEqual(code, 1, report)
            self.assertIn("upload_wrong_department", report)

    def test_unknown_activity_falls_back_to_the_sector_default(self):
        with tempfile.TemporaryDirectory() as tmp:
            one = schema("health", "pharmacie")
            columns, row = sample_row(one)
            path = write_rows(os.path.join(tmp, "f.csv"), columns, [row])
            code, _ = run(path, "health", "no-such-activity")
            self.assertEqual(code, 0)
            self.assertEqual(check.select_schema(SCHEMAS, "health", "no-such-activity")["key"], "health/default")


if __name__ == "__main__":
    unittest.main()
