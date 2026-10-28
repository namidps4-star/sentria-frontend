"""Exit codes, reading, and rules the backend applies before any column check."""
import contextlib
import io
import os
import tempfile
import unittest

from support import check, write_rows


class CliTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = self.tmp.name

    def tearDown(self):
        self.tmp.cleanup()

    def main(self, *argv):
        err = io.StringIO()
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(err):
            return check.main(list(argv)), err.getvalue()

    def csv(self, header, rows, sep=","):
        return write_rows(os.path.join(self.dir, "f.csv"), header, rows, sep)

    def test_exit_codes(self):
        ok = self.csv(["medicine_name", "stock_qty"], [["A", "3"]])
        self.assertEqual(self.main(ok, "--sector", "health", "--business-type", "pharmacie")[0], 0)
        bad = self.csv(["sku"], [["x"]])
        self.assertEqual(self.main(bad, "--sector", "health", "--business-type", "pharmacie")[0], 1)
        self.assertEqual(self.main(os.path.join(self.dir, "none.csv"), "--sector", "health")[0], 2)

    def test_semicolon_and_bom_and_padded_headers_read_like_the_backend(self):
        path = os.path.join(self.dir, "s.csv")
        with open(path, "w", encoding="utf-8-sig") as f:
            f.write(" medicine_name ; stock_qty \nA;3\n")
        self.assertEqual(self.main(path, "--sector", "health", "--business-type", "pharmacie")[0], 0)

    def test_header_only_file_is_empty(self):
        out = io.StringIO()
        code = check.check(self.csv(["medicine_name", "stock_qty"], []), "health", "pharmacie", out=out)
        self.assertEqual(code, 1)
        self.assertIn("upload_empty", out.getvalue())

    def test_supplier_order_file_is_accepted(self):
        path = self.csv(["order_date", "delivery"], [["2026-01-01", "x"]])
        self.assertEqual(self.main(path, "--sector", "health", "--business-type", "pharmacie")[0], 1)
        path = self.csv(["order_date", "received_date"], [["2026-01-01", "2026-01-03"]])
        self.assertEqual(self.main(path, "--sector", "health", "--business-type", "pharmacie")[0], 0)

    def test_unknown_sector_is_accepted_as_in_the_backend(self):
        path = self.csv(["a"], [["1"]])
        self.assertEqual(self.main(path, "--sector", "nowhere")[0], 0)

    def test_ops_type_transport_uses_the_vehicle_spec(self):
        path = self.csv(["truck_id", "mileage_km"], [["T1", "1000"]])
        self.assertEqual(self.main(path, "--sector", "logistics", "--ops-type", "transport")[0], 0)
        self.assertEqual(self.main(path, "--sector", "logistics")[0], 1)

    def test_two_stores_in_a_one_shop_activity_is_refused(self):
        path = self.csv(["product_name", "store_id", "stock_qty"], [["x", "S1", "3"], ["x", "S2", "3"]])
        self.assertEqual(self.main(path, "--sector", "retail", "--business-type", "supermarche-hypermarche")[0], 1)
        self.assertEqual(self.main(path, "--sector", "retail", "--business-type", "chaine-magasins")[0], 0)

    def test_no_usable_row_is_refused(self):
        path = self.csv(["medicine_name", "stock_qty"], [["A", ""]])
        self.assertEqual(self.main(path, "--sector", "health", "--business-type", "pharmacie")[0], 1)

    def test_duplicate_rows_are_reported_and_kept(self):
        path = self.csv(["medicine_name", "stock_qty"], [["A", "3"], ["A", "3"]])
        out = io.StringIO()
        target = os.path.join(self.dir, "o.csv")
        code = check.check(path, "health", "pharmacie", write_path=target, out=out)
        self.assertEqual(code, 0)
        self.assertIn("duplicate rows (kept)", out.getvalue())
        with open(target, encoding="utf-8") as f:
            self.assertEqual(len(f.read().splitlines()), 3)

    def test_today_counts_expired_dates(self):
        path = self.csv(["medicine_name", "stock_qty", "expiry_date"], [["A", "3", "2026-01-05"], ["B", "3", "2027-01-05"]])
        out = io.StringIO()
        check.check(path, "health", "pharmacie", today="2026-06-01", out=out)
        self.assertIn("expiry dates before 2026-06-01: 1", out.getvalue())


if __name__ == "__main__":
    unittest.main()
