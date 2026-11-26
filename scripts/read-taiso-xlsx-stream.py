#!/usr/bin/env python3
"""Read bounded XLSX rows for both JSB contracts; no formula evaluation."""
import importlib.util
import json
import sys
from io import BytesIO
from zipfile import BadZipFile
from pathlib import Path

HERE = Path(__file__).resolve().parent
MAX_FILE = 4 * 1024 * 1024
MAX_OUTPUT = 8 * 1024 * 1024

def read_workbook_rows(payload):
    from openpyxl import load_workbook
    spec = importlib.util.spec_from_file_location("inspection", HERE / "inspect-catalogue-xlsx.py")
    inspection = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(inspection)
    source = inspection.check_archive(BytesIO(payload))
    book = load_workbook(source, read_only=True, data_only=False, keep_links=False)
    try:
        if book.sheetnames != ["Exercices"]:
            raise ValueError("Onglet unique Exercices requis.")
        sheet = book["Exercices"]
        if sheet.sheet_state != "visible" or sheet.max_row is None or sheet.max_column is None or sheet.max_row > 2001 or sheet.max_column > 40:
            raise ValueError("Dimensions ou onglet non conformes.")
        sheet.reset_dimensions()
        rows = []
        columns = None
        empty_seen = False
        for number, row in enumerate(sheet.iter_rows(), 1):
            if number > 2001 or len(row) > 40:
                raise ValueError("Dimensions hors limites.")
            if any(cell.data_type == "f" for cell in row):
                raise ValueError("Formule interdite.")
            values = [cell.value for cell in row]
            if number == 1:
                if not values or len(values) not in (22, 27, 35) or any(not isinstance(v, str) or not v for v in values):
                    raise ValueError("En-têtes non conformes.")
                columns = len(values)
                rows.append(values)
                continue
            if len(values) > columns:
                raise ValueError("Colonnes supplémentaires.")
            if all(v is None for v in values):
                empty_seen = True
                continue
            if empty_seen:
                raise ValueError("Ligne vide entre deux fiches.")
            if any(v is not None and not (isinstance(v, str) or type(v) is int) for v in values):
                raise ValueError("Type de cellule non conforme.")
            rows.append(values + [None] * (columns - len(values)))
        return rows
    finally:
        book.close()

def main():
    # Bound CPU and address space on the Linux preproduction worker.
    try:
        import resource
        resource.setrlimit(resource.RLIMIT_CPU, (10, 12))
        resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
        payload = sys.stdin.buffer.read(MAX_FILE + 1)
        if not payload or len(payload) > MAX_FILE:
            return 2
        rows = read_workbook_rows(payload)
        output = json.dumps(rows, ensure_ascii=False).encode("utf-8")
        if len(output) > MAX_OUTPUT:
            return 2
        sys.stdout.buffer.write(output)
        return 0
    except (ValueError, BadZipFile, KeyError, OSError):
        return 2
    except Exception:
        return 3

if __name__ == "__main__":
    sys.exit(main())
