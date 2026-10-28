"""The checker gives the backend's answer on every case, and the saved table is current."""
import os
import tempfile
import unittest

import cross_check
from support import REPO, SKIP_MESSAGE, backend

uc = backend("pipeline.upload_check")
alerts = backend("pipeline.alerts")
DOC = os.path.join(REPO, "docs", "csv-backend-cross-check.md")


@unittest.skipIf(uc is None or alerts is None, SKIP_MESSAGE)
class CrossCheckTests(unittest.TestCase):
    def setUp(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.rows = cross_check.compare(uc, alerts, tmp)

    def test_no_case_differs(self):
        differing = [r[0] for r in self.rows if not r[3]]
        self.assertEqual(differing, [])

    def test_every_refusal_kind_is_covered(self):
        kinds = {r[1] for r in self.rows}
        for code in ("accepted", "upload_empty", "upload_columns_missing", "upload_no_usable_rows", "upload_wrong_department"):
            self.assertIn(code, kinds)

    def test_the_saved_table_is_current(self):
        with open(DOC, encoding="utf-8") as f:
            self.assertEqual(f.read(), cross_check.to_markdown(self.rows))


if __name__ == "__main__":
    unittest.main()
