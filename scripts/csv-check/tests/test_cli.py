"""Exit codes and --write: 0 accepted, 1 refused, 2 inputs that cannot be used."""
import contextlib
import io
import os
import tempfile
import unittest

import check
from support import EXAMPLES, sample_row, schema, write, write_rows


class CliTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = self.tmp.name

    def tearDown(self):
        self.tmp.cleanup()

    def main(self, *argv):
        err = io.StringIO()
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(err):
            code = check.main(list(argv))
        return code, err.getvalue()

    def test_accepted_file_exits_zero(self):
        columns, row = sample_row(schema("health", "pharmacie"))
        path = write_rows(os.path.join(self.dir, "ok.csv"), columns, [row])
        self.assertEqual(self.main(path, "--sector", "health", "--activity", "pharmacie")[0], 0)

    def test_refused_file_exits_one_and_writes_nothing(self):
        path = write_rows(os.path.join(self.dir, "bad.csv"), ["product_name"], [["x"]])
        target = os.path.join(self.dir, "out.csv")
        code, _ = self.main(path, "--sector", "health", "--activity", "pharmacie", "--write", target)
        self.assertEqual(code, 1)
        self.assertFalse(os.path.exists(target))

    def test_missing_file_exits_two(self):
        code, err = self.main(os.path.join(self.dir, "nope.csv"), "--sector", "health")
        self.assertEqual(code, 2)
        self.assertIn("input error", err)

    def test_unknown_sector_exits_two(self):
        columns, row = sample_row(schema("health", "pharmacie"))
        path = write_rows(os.path.join(self.dir, "ok.csv"), columns, [row])
        self.assertEqual(self.main(path, "--sector", "nowhere")[0], 2)

    def test_mapping_that_is_not_json_exits_two(self):
        columns, row = sample_row(schema("health", "pharmacie"))
        path = write_rows(os.path.join(self.dir, "ok.csv"), columns, [row])
        bad = write(os.path.join(self.dir, "bad.json"), "{not json")
        self.assertEqual(self.main(path, "--sector", "health", "--activity", "pharmacie", "--map", bad)[0], 2)

    def test_write_is_refused_when_a_filled_cell_would_be_lost(self):
        path = write_rows(os.path.join(self.dir, "unit.csv"), ["medicine_name", "stock_qty"], [["Aspirine", "3 u"]])
        target = os.path.join(self.dir, "clean.csv")
        code, err = self.main(path, "--sector", "health", "--activity", "pharmacie", "--write", target)
        self.assertEqual(code, 2)
        self.assertIn("not written", err)
        self.assertFalse(os.path.exists(target))

    def test_header_only_file_is_refused_as_empty(self):
        path = write(os.path.join(self.dir, "h.csv"), "medicine_name,stock_qty\n")
        code, _ = self.main(path, "--sector", "health", "--activity", "pharmacie")
        self.assertEqual(code, 1)

    def test_written_file_is_readable_and_still_accepted(self):
        columns, row = sample_row(schema("health", "pharmacie"))
        path = write_rows(os.path.join(self.dir, "ok.csv"), columns, [row])
        target = os.path.join(self.dir, "clean.csv")
        self.assertEqual(self.main(path, "--sector", "health", "--activity", "pharmacie", "--write", target)[0], 0)
        self.assertEqual(self.main(target, "--sector", "health", "--activity", "pharmacie")[0], 0)


if __name__ == "__main__":
    unittest.main()
