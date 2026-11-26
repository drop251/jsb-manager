import importlib.util
from pathlib import Path
import tempfile
import json
import subprocess
import sys
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



CONVERTER_SPEC = importlib.util.spec_from_file_location(
    "convert_recipe", Path(__file__).resolve().parents[1] / "scripts/convert-taiso-xlsx-recipe.py")
CONVERTER = importlib.util.module_from_spec(CONVERTER_SPEC)
CONVERTER_SPEC.loader.exec_module(CONVERTER)
HEADERS = ["Nom (exercice)", "Exécution", "Discipline", "Type de fiche",
           "Point de sécurité", "Dosage de base", "Critère de réussite",
           "Famille principale", "Sous-famille", "Niveau", "Sous-groupe",
           "Matériel", "Muscles cibles", "Moment de la séance", "Variante plus facile",
           "Variante plus difficile", "Accessibilité", "Inspiration", "Format",
           "Catégorie", "Tags", "Objectif"]


class WorkbookConversionTests(unittest.TestCase):
    def make_workbook(self, path, count=228, mutate=None):
        book = Workbook()
        sheet = book.active
        sheet.title = "Exercices"
        sheet.append(HEADERS)
        for i in range(count):
            row = ["Fixture %d / %d" % (i, j) for j in range(22)]
            row[2:4] = ["Taïso", "Exercice"]
            row[7] = "Fixture famille"
            row[20] = "tag A, tag B, tag A"
            sheet.append(row)
        if mutate:
            mutate(book, sheet)
        book.save(path)
        book.close()

    def test_xlsx_to_recipe(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "fixture.xlsx"
            self.make_workbook(path)
            before = path.read_bytes()
            recipe = CONVERTER.convert(path)
            self.assertFalse(recipe["publishable"])
            self.assertEqual(recipe["purpose"], "recipe-only")
            self.assertEqual(recipe["report"]["count"], 228)
            self.assertEqual(recipe["sourceHeaders"], HEADERS)
            self.assertEqual(recipe["items"][0]["exercise"]["reference"], "RECETTE-L0002")
            self.assertEqual(recipe["items"][-1]["sourceRow"], 229)
            self.assertEqual(recipe["items"][0]["exercise"]["details"]["tagsText"], "tag A, tag B, tag A")
            self.assertEqual(path.read_bytes(), before)

    def test_stream_reader_accepts_workbook_and_refuses_invalid_zip(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "fixture.xlsx"
            self.make_workbook(path)
            script = Path(__file__).resolve().parents[1] / "scripts/read-taiso-xlsx-stream.py"
            command = [sys.executable, "-I", "-B", str(script)]
            result = subprocess.run(command, input=path.read_bytes(), capture_output=True, timeout=20)
            self.assertEqual(result.returncode, 0)
            rows = json.loads(result.stdout)
            self.assertEqual(len(rows), 229)
            self.assertEqual(rows[0], HEADERS)
            self.assertEqual(rows[1][20], "tag A, tag B, tag A")
            invalid = subprocess.run(command, input=b"not an XLSX", capture_output=True, timeout=20)
            self.assertEqual(invalid.returncode, 2)
            self.assertEqual(invalid.stdout, b"")

    def test_refuse_wrong_sheet_formula_extra_column_missing_value(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "fixture.xlsx"
            cases = [
                lambda b, s: b.create_sheet("Audit"),
                lambda b, s: setattr(s["A2"], "value", "=1+1"),
                lambda b, s: setattr(s["W2"], "value", "extra"),
                lambda b, s: setattr(s["B2"], "value", None),
                lambda b, s: setattr(s["A1"], "value", "Nom inconnu"),
            ]
            for mutate in cases:
                self.make_workbook(path, 1, mutate)
                with self.assertRaises(ValueError):
                    CONVERTER.convert(path)


if __name__ == "__main__":
    unittest.main()
