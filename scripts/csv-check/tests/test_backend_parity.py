"""The checker's refusal order matches the backend's check_upload on the same file."""
import os
import tempfile
import unittest

from support import EXAMPLES, backend, run, write_rows

EXAMPLE_CSV = os.path.join(EXAMPLES, "health-pharmacie.example.csv")
EXAMPLE_MAP = os.path.join(EXAMPLES, "health-pharmacie.map.json")

upload_check = backend("pipeline.upload_check")
alerts = backend("pipeline.alerts")

CASES = [
    # (name, sector, activity, header, rows)
    ("header only", "health", "pharmacie", ["medicine_name", "stock_qty"], []),
    ("other department's columns", "health", "pharmacie", ["product_name", "sku"], [["x", "y"]]),
    ("chain file for a one-shop activity", "retail", None,
     ["product_name", "sku", "store_id", "stock_qty"], [["x", "y", "S1", "3"], ["x", "y", "S2", "3"]]),
    ("no usable row", "health", "pharmacie", ["medicine_name", "stock_qty"], [["Aspirine", ""]]),
    ("supplier orders", "retail", "grossiste-distributeur",
     ["order_date", "received_date", "product_name"], [["2026-01-01", "2026-01-03", "x"]]),
    ("unknown activity uses the one-shop rule of the sector default", "retail", "no-such-activity",
     ["product_name", "store_id", "stock_qty"], [["x", "S1", "3"], ["x", "S2", "3"]]),
    ("a usable file", "health", "pharmacie", ["medicine_name", "stock_qty"], [["Aspirine", "3"]]),
]


@unittest.skipIf(upload_check is None, "backend pipeline.upload_check not available")
class BackendParityTests(unittest.TestCase):
    def test_same_outcome_as_check_upload(self):
        with tempfile.TemporaryDirectory() as tmp:
            for name, sector, activity, header, rows in CASES:
                with self.subTest(case=name):
                    path = write_rows(os.path.join(tmp, "c.csv"), header, rows)
                    df = alerts.read_upload(path) if alerts else None
                    if df is None:
                        self.skipTest("backend pipeline.alerts not available")
                    ref = upload_check.check_upload(df, sector, activity)
                    code, report = run(path, sector, activity)
                    self.assertEqual(code == 0, ref is None, report)
                    if ref is not None:
                        self.assertIn(ref["error_code"], report)

    def test_written_example_passes_check_upload(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = os.path.join(tmp, "clean.csv")
            code, report = run(EXAMPLE_CSV, "health", "pharmacie", EXAMPLE_MAP, target)
            self.assertEqual(code, 0, report)
            self.assertIsNone(upload_check.check_upload(alerts.read_upload(target), "health", "pharmacie"))


if __name__ == "__main__":
    unittest.main()
