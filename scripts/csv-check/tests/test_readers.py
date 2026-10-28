"""The checker warns exactly where the backend's own readers return nothing."""
import os
import tempfile
import unittest

from support import DATA, SKIP_MESSAGE, TABLE, backend, check, write_rows

alerts = backend("pipeline.alerts")
port_flow = backend("pipeline.port_flow")

# The string "nan" is left out: pandas reads it as a blank cell, which never warns.
DATE_VALUES = ["2026-01-05", "05/01/2026", "01/05/2026", "2026/01/05", "05-01-2026",
               "05.01.2026", "2026-13-01", "5 Jan 2026", "Jan-26", " 2026-01-05 ", "20260105"]
NUMBER_VALUES = ["12", "12.5", "-4", " 7 ", "1e3", "1,5", "12 kg", "12kg", "1 234", "inf", "abc", "$5"]
FLAG_VALUES = ["1", "1.0", "x", "X", "OUI", "yes", "Y", "true", "no", "0", "maybe", "si"]


def warned_cells(entry, column, values, other=None):
    """Writes one file with the column's values and returns {value: warned}."""
    with tempfile.TemporaryDirectory() as tmp:
        header = ["medicine_name", "stock_qty", column] if column not in ("medicine_name", "stock_qty") else [column]
        rows = [["A", "1", v] if len(header) == 3 else [v] for v in values]
        path = write_rows(os.path.join(tmp, "r.csv"), header, rows)
        df = check.read_upload(path)
        found = {w[0] for w in check.cell_warnings(df, entry, DATA) if w[1] == column}
        return df, {i: (i + 2) in found for i in range(len(values))}


class DateTests(unittest.TestCase):
    @unittest.skipIf(alerts is None, SKIP_MESSAGE)
    def test_warns_exactly_when_parse_date_returns_nothing(self):
        entry = TABLE[("health", "pharmacie")]
        df, warned = warned_cells(entry, "expiry_date", DATE_VALUES)
        for i, value in enumerate(DATE_VALUES):
            cell = df["expiry_date"].iloc[i]
            with self.subTest(value=value):
                self.assertEqual(warned[i], alerts._parse_date(cell) is None)

    def test_date_formats_are_the_backends_five(self):
        self.assertEqual(DATA["date_formats"], ["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d", "%d-%m-%Y"])


class NumberTests(unittest.TestCase):
    @unittest.skipIf(alerts is None, SKIP_MESSAGE)
    def test_warns_exactly_when_num_returns_nothing(self):
        entry = TABLE[("health", "pharmacie")]
        df, warned = warned_cells(entry, "min_stock", NUMBER_VALUES)
        for i, value in enumerate(NUMBER_VALUES):
            cell = df["min_stock"].iloc[i]
            with self.subTest(value=value):
                self.assertEqual(warned[i], alerts._num(cell) is None)

    def test_commas_and_units_warn(self):
        entry = TABLE[("health", "pharmacie")]
        _, warned = warned_cells(entry, "min_stock", ["1,5", "12 kg", "12"])
        self.assertEqual([warned[0], warned[1], warned[2]], [True, True, False])


class YesNoTests(unittest.TestCase):
    @unittest.skipIf(port_flow is None, SKIP_MESSAGE)
    def test_flag_warning_follows_the_backend_flag_reader(self):
        entry = TABLE[("logistics", "port-conteneurs")]
        no = set(DATA["no_words"])
        df, warned = warned_cells(entry, "inspection_flag", FLAG_VALUES)
        for i, value in enumerate(FLAG_VALUES):
            cell = df["inspection_flag"].iloc[i]
            with self.subTest(value=value):
                if port_flow._flag(cell):
                    self.assertFalse(warned[i])
                elif str(cell).strip().lower() in no:
                    self.assertFalse(warned[i])
                else:
                    self.assertTrue(warned[i])

    def test_alerts_yes_words_do_not_include_x_or_one_point_zero(self):
        words = DATA["yes_words"]["alerts"]
        self.assertNotIn("x", words)
        self.assertNotIn("1.0", words)
        self.assertIn("x", DATA["yes_words"]["port_flow"])

    def test_a_text_value_makes_a_boolean_column_unread(self):
        entry = TABLE[("industry", "usine-agroalimentaire")]
        with tempfile.TemporaryDirectory() as tmp:
            path = write_rows(os.path.join(tmp, "b.csv"), ["Product ID", "hygiene_control_passed"],
                              [["P1", "True"], ["P2", "no"]])
            warned = check.cell_warnings(check.read_upload(path), entry, DATA)
        self.assertEqual(len(warned), 2)


class BlankTests(unittest.TestCase):
    def test_blank_cells_never_warn(self):
        entry = TABLE[("health", "pharmacie")]
        with tempfile.TemporaryDirectory() as tmp:
            path = write_rows(os.path.join(tmp, "b.csv"), ["medicine_name", "stock_qty", "expiry_date"], [["A", "", ""]])
            self.assertEqual(check.cell_warnings(check.read_upload(path), entry, DATA), [])


if __name__ == "__main__":
    unittest.main()
