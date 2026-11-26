#!/usr/bin/env python3
"""Read-only XLSX inventory for catalogue mapping. No conversion or publication."""
import argparse
import json
import re
import sys
from pathlib import Path, PurePosixPath
from zipfile import ZipFile, BadZipFile

MAX_FILE = 4 * 1024 * 1024
MAX_EXPANDED = 32 * 1024 * 1024
MAX_PARTS = 512
MAX_SHEETS = 32
MAX_ROWS = 2500
MAX_COLS = 128
MAX_HEADER = 250


class InspectionError(ValueError):
    pass


def inspect_workbook(path):
    from openpyxl import load_workbook
    p = Path(path)
    if p.suffix.lower() != ".xlsx" or not p.is_file() or p.stat().st_size > MAX_FILE:
        raise InspectionError("Fichier XLSX de 4 Mio maximum requis.")
    with ZipFile(p) as archive:
        parts = archive.infolist()
        names = set()
        if len(parts) > MAX_PARTS or sum(x.file_size for x in parts) > MAX_EXPANDED:
            raise InspectionError("Archive Excel hors limites.")
        for part in parts:
            name = part.filename
            if (name in names or PurePosixPath(name).is_absolute()
                    or ".." in PurePosixPath(name).parts or "\\" in name
                    or part.flag_bits & 1):
                raise InspectionError("Archive Excel non conforme.")
            names.add(name)
            lower = name.lower()
            if any(s in lower for s in ("vbaproject", "externallinks/", "embeddings/", "activex/")):
                raise InspectionError("Macros, liaisons externes et objets incorporés refusés.")
            if lower.endswith((".xml", ".rels")):
                xml = archive.read(part)
                if re.search(br"<!\s*(?:DOCTYPE|ENTITY)", xml.replace(b"\x00", b""), re.I):
                    raise InspectionError("Déclaration XML interdite.")
    # Read-only mode; never evaluate formulas, never follow external links.
    book = load_workbook(p, read_only=True, data_only=False, keep_links=False)
    try:
        if len(book.worksheets) > MAX_SHEETS:
            raise InspectionError("Trop d'onglets.")
        result = []
        for sheet in book.worksheets:
            if sheet.max_row is None or sheet.max_column is None:
                raise InspectionError("Dimensions de feuille non déclarées.")
            if sheet.max_row > MAX_ROWS or sheet.max_column > MAX_COLS:
                raise InspectionError("Dimensions de feuille hors limites.")
            # Do not trust declared dimensions to detect all populated rows.
            sheet.reset_dimensions()
            candidates = []
            populated = formulas = 0
            for row_number, row in enumerate(sheet.iter_rows(), start=1):
                if row_number > MAX_ROWS or len(row) > MAX_COLS:
                    raise InspectionError("Dimensions de feuille hors limites.")
                cells = [cell for cell in row if cell.value is not None]
                if not cells:
                    continue
                populated += 1
                formulas += sum(cell.data_type == "f" for cell in cells)
                # Only list candidate header lines, not exercise rows or formula values.
                if row_number <= 12 and len(cells) >= 3 and all(
                    isinstance(c.value, str) and c.data_type != "f"
                    and len(c.value) <= MAX_HEADER for c in cells
                ) and len(candidates) < 3:
                    headers = [c.value if c.value is not None else None for c in row]
                    seen = set()
                    duplicates = []
                    for label in headers:
                        if label is None:
                            continue
                        normalized = label.strip().casefold()
                        if normalized in seen:
                            duplicates.append(label)
                        seen.add(normalized)
                    candidates.append({"row": row_number, "headers": headers, "duplicateHeaders": duplicates})
            result.append({"sheet": sheet.title, "visibility": sheet.sheet_state,
                           "populatedRows": populated, "formulaCells": formulas,
                           "headerCandidates": candidates})
        return {"mode": "inspection-only", "mappingConfirmed": False,
                "importAllowed": False, "sheets": result}
    finally:
        book.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("xlsx")
    args = parser.parse_args()
    try:
        print(json.dumps(inspect_workbook(args.xlsx), ensure_ascii=False, indent=2))
    except (InspectionError, BadZipFile, OSError, ImportError, ValueError):
        print("Inspection refusée : fichier invalide, hors limites ou dépendance indisponible.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
