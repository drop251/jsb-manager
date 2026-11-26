import importlib.util
from pathlib import Path
import tempfile
import unittest
from zipfile import ZipFile

from openpyxl import Workbook

SPEC = importlib.util.spec_from_file_location(
    "inspect_catalogue", Path(__file__).resolve().parents[1] / "scripts/inspect-catalogue-xlsx.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class WorkbookInspectionTests(unittest.TestCase):
    def test_inventory_without_mutation_or_mapping(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "fixture.xlsx"
            book = Workbook()
            sheet = book.active
            sheet.title = "Catalogue fixture"
            sheet.append(["Référence", "Nom", "Famille", "Nom"])
            sheet.append(["A", "Fixture", "Fixture", "=1+1"])
            book.create_sheet("Contrôles").sheet_state = "hidden"
            book.save(path)
            before = path.read_bytes()
            report = MODULE.inspect_workbook(path)
            self.assertFalse(report["importAllowed"])
            self.assertFalse(report["mappingConfirmed"])
            self.assertEqual(report["sheets"][0]["populatedRows"], 2)
            self.assertEqual(report["sheets"][0]["formulaCells"], 1)
            self.assertEqual(report["sheets"][0]["headerCandidates"][0]["duplicateHeaders"], ["Nom"])
            self.assertEqual(report["sheets"][1]["visibility"], "hidden")
            self.assertEqual(path.read_bytes(), before)

    def test_refuse_embedded_content_and_xml_declarations(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "fixture.xlsx"
            for part, payload in [
                ("xl/embeddings/object.bin", b"fixture"),
                ("xl/workbook.xml", b"<!DOCTYPE fixture><fixture/>"),
                ("../fixture.xml", b"<fixture/>"),
            ]:
                with ZipFile(path, "w") as archive:
                    archive.writestr(part, payload)
                with self.assertRaises(MODULE.InspectionError):
                    MODULE.inspect_workbook(path)


if __name__ == "__main__":
    unittest.main()
