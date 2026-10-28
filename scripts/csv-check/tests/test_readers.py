"""The value readers match the backend's readers, and the warnings name the cells they would drop."""
import os
import tempfile
import unittest

from support import backend, check, schema, write, write_rows

alerts = backend("pipeline.alerts")
port_flow = backend("pipeline.port_flow")
DATE_TEXTS = ["2026-01-05", "05/01/2026", "01/05/2026", "2026/01/05", "05-01-2026",
              "05.01.2026", "", "2026-13-01", "  2026-01-05  ", "nan"]
NUMBER_TEXTS = ["12", "12.5", " 3 ", "12 kg", "1,5", "nan", "", "-4"]
FLAG_TEXTS = ["1", "1.0", "x", "X", "OUI", "yes", "no", "0", "", "maybe"]


class DateReaderTests(unittest.TestCase):
    def test_accepts_the_backend_formats_only(self):
        formats = schema("health", "pharmacie")["date_formats"]
        self.assertIsNotNone(check.parse_date("2026-01-05", formats))
        self.assertIsNotNone(check.parse_date("05/01/2026", formats))
        self.assertIsNone(check.parse_date("05.01.2026", formats))
        self.assertIsNone(check.parse_date("", formats))

    @unittest.skipIf(alerts is None, "backend pipeline.alerts not available")
    def test_matches_backend_parse_date(self):
        formats = schema("health", "pharmacie")["date_formats"]
        for text in DATE_TEXTS:
            with self.subTest(text=text):
                expected = alerts._parse_date(text)
                got = check.parse_date(text, formats)
                self.assertEqual(expected, got)


class NumberReaderTests(unittest.TestCase):
    def test_refuses_units_and_commas(self):
        self.assertIsNone(check.parse_number("12 kg"))
        self.assertIsNone(check.parse_number("1,5"))
        self.assertEqual(check.parse_number("12.5"), 12.5)

    @unittest.skipIf(alerts is None, "backend pipeline.alerts not available")
    def test_matches_backend_num(self):
        for text in NUMBER_TEXTS:
            with self.subTest(text=text):
                self.assertEqual(alerts._num(text), check.parse_number(text))


class YesWordTests(unittest.TestCase):
    @unittest.skipIf(port_flow is None, "backend pipeline.port_flow not available")
    def test_flag_reader_matches_backend_flag(self):
        words = set(schema("logistics", "port-conteneurs")["yes_words"]["port_flow"])
        no = set(schema("logistics", "port-conteneurs")["no_words"])
        for text in FLAG_TEXTS:
            with self.subTest(text=text):
                backend_says = port_flow._flag(text)
                ours = check.yes_reading(text, words, no) == "yes"
                self.assertEqual(backend_says, ours)

    def test_pandas_float_one_is_not_a_yes_word_for_alerts(self):
        # A yes/no column with a blank cell reads "1" as 1.0. The alerts reader
        # does not list "1.0", so the cell is read as not set.
        one = schema("health", "veterinaire")
        alerts_words = set(one["yes_words"]["alerts"])
        self.assertIsNone(check.yes_reading("1.0", alerts_words, set(one["no_words"])))
        self.assertIsNotNone(check.yes_reading("1", alerts_words, set(one["no_words"])))

    def test_yesno_cell_warning_names_the_cell(self):
        one = schema("health", "veterinaire")
        with tempfile.TemporaryDirectory() as tmp:
            columns = ["medicine_name", "stock_qty", "bought_on_credit"]
            path = write_rows(os.path.join(tmp, "y.csv"), columns, [["Aspirine", "3", "maybe"], ["Doliprane", "4", "oui"]])
            df = check.read_upload(path)
            warnings = check.cell_problems(df, one)
            self.assertEqual([(w[0], w[1]) for w in warnings], [(2, "bought_on_credit")])


class BooleanReaderTests(unittest.TestCase):
    def _warnings(self, values):
        one = schema("industry", "usine-agroalimentaire")
        with tempfile.TemporaryDirectory() as tmp:
            columns = ["Product ID", "hygiene_control_passed"]
            path = write_rows(os.path.join(tmp, "h.csv"), columns, [["P1", v] for v in values])
            return check.cell_problems(check.read_upload(path), one)

    def test_a_pure_true_false_column_is_read(self):
        self.assertEqual(self._warnings(["True", "False", "True"]), [])

    def test_one_text_value_stops_every_boolean_in_the_column(self):
        found = self._warnings(["True", "no", "False"])
        self.assertEqual([w[0] for w in found], [2, 3, 4])


class BlankAndNanTests(unittest.TestCase):
    def test_blank_cells_are_never_warned(self):
        one = schema("health", "pharmacie")
        with tempfile.TemporaryDirectory() as tmp:
            path = write(os.path.join(tmp, "b.csv"), "medicine_name,stock_qty,expiry_date\nA,,\nB,3,2026-01-05\n")
            self.assertEqual(check.cell_problems(check.read_upload(path), one), [])


if __name__ == "__main__":
    unittest.main()
