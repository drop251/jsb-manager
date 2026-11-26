#!/usr/bin/env python3
"""Convert the observed provisional Taïso workbook to a non-publishable recipe.
Local file only, no database, network, formula evaluation or overwrite.
"""
import argparse
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("catalogue_inspection", HERE / "inspect-catalogue-xlsx.py")
INSPECT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(INSPECT)
MAX_JSON = 16 * 1024 * 1024


def read_rows(path):
    from openpyxl import load_workbook
    source = INSPECT.check_archive(path)
    book = load_workbook(source, read_only=True, data_only=False, keep_links=False)
    try:
        if book.sheetnames != ["Exercices"]:
            raise ValueError("Un seul onglet Exercices est requis pour ce format provisoire.")
        sheet = book["Exercices"]
        if sheet.sheet_state != "visible" or sheet.max_row is None or sheet.max_column is None:
            raise ValueError("Onglet ou dimensions non conformes.")
        if sheet.max_row > 2001 or sheet.max_column > 22:
            raise ValueError("Dimensions hors limites.")
        sheet.reset_dimensions()
        rows = []
        for number, row in enumerate(sheet.iter_rows(), 1):
            if number > 2001 or len(row) != 22:
                raise ValueError("Ligne %d : exactement 22 colonnes requises." % number)
            if any(cell.data_type == "f" or not isinstance(cell.value, str) or not cell.value.strip() for cell in row):
                raise ValueError("Ligne %d : formule, cellule vide ou type non textuel." % number)
            rows.append([cell.value for cell in row])
        if len(rows) < 2:
            raise ValueError("Aucune fiche.")
        return rows
    finally:
        book.close()


def convert(path):
    rows = read_rows(path)
    payload = json.dumps(rows, ensure_ascii=False).encode("utf-8")
    if len(payload) > MAX_JSON:
        raise ValueError("Données hors limites.")
    code = """
const fs=require('node:fs');
const {mapTaisoRecipe,restoreSourceRow}=require(process.argv[1]);
const rows=JSON.parse(fs.readFileSync(0,'utf8'));
const recipe=mapTaisoRecipe(rows);
if(JSON.stringify(recipe.items.map(restoreSourceRow))!==JSON.stringify(rows.slice(1)))throw Error('Restitution non conforme');
process.stdout.write(JSON.stringify(recipe));
"""
    result = subprocess.run(
        ["node", "-e", code, str(HERE.parent / "core" / "taiso-xlsx-recipe.cjs")],
        input=payload, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        timeout=30, check=False,
    )
    if result.returncode or len(result.stdout) > MAX_JSON:
        raise ValueError("Conversion ou restitution refusée par le validateur JSB.")
    recipe = json.loads(result.stdout)
    if recipe.get("purpose") != "recipe-only" or recipe.get("publishable") is not False:
        raise ValueError("Enveloppe de recette non conforme.")
    return recipe


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("xlsx")
    parser.add_argument("output")
    args = parser.parse_args()
    try:
        destination = Path(args.output)
        if destination.suffix.lower() != ".json":
            raise ValueError("Destination JSON requise.")
        recipe = convert(args.xlsx)
        with destination.open("x", encoding="utf-8") as handle:
            json.dump(recipe, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        print("Recette : %d fiches, publication interdite." % recipe["report"]["count"])
    except (ValueError, OSError, ImportError, subprocess.SubprocessError) as error:
        print("Conversion refusée : " + str(error), file=sys.stderr)
        return 1
    except Exception:
        print("Conversion refusée : classeur non conforme.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
