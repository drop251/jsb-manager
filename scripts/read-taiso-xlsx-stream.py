#!/usr/bin/env python3
"""Read a bounded XLSX stream for the isolated preproduction recipe."""
import importlib.util
import json
import sys
from io import BytesIO
from zipfile import BadZipFile
from pathlib import Path

HERE = Path(__file__).resolve().parent
MAX_FILE = 4 * 1024 * 1024
MAX_OUTPUT = 8 * 1024 * 1024

def main():
    # Bound CPU and address space on the Linux preproduction worker.
    try:
        import resource
        resource.setrlimit(resource.RLIMIT_CPU, (10, 12))
        resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
        spec = importlib.util.spec_from_file_location("converter", HERE / "convert-taiso-xlsx-recipe.py")
        converter = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(converter)
        payload = sys.stdin.buffer.read(MAX_FILE + 1)
        if not payload or len(payload) > MAX_FILE:
            return 2
        rows = converter.read_rows(BytesIO(payload))
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
