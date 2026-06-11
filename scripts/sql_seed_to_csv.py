#!/usr/bin/env python3
"""Convert commissioning_2026.sql seed rows into a clean 12-column CSV."""

from __future__ import annotations

import csv
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SQL_PATH = ROOT / "supabase" / "seeds" / "commissioning_2026.sql"
OUT_PATH = ROOT / "supabase" / "seeds" / "commissioning_2026_clean.csv"

CSV_HEADERS = [
    "title",
    "status",
    "Priority",
    "Responsible",
    "CE Comments",
    "Response or Action taken by SB",
    "SB Note",
    "Date Due",
    "Date Completed",
    "SB Status",
    "Risk",
    "SB Owner",
]

# SQL column index -> CSV header name (None = skip)
SQL_TO_CSV = {
    1: "title",
    3: "status",
    4: "Priority",
    5: "Responsible",
    2: "CE Comments",
    14: "Response or Action taken by SB",
    13: "SB Note",
    9: "Date Due",
    10: "Date Completed",
    11: "SB Status",
    7: "Risk",
    12: "SB Owner",
}


def parse_sql_string(s: str, start: int) -> tuple[str, int]:
    """Parse a single-quoted SQL string starting at `start` (on opening quote)."""
    assert s[start] == "'"
    parts: list[str] = []
    i = start + 1
    while i < len(s):
        ch = s[i]
        if ch == "'":
            if i + 1 < len(s) and s[i + 1] == "'":
                parts.append("'")
                i += 2
                continue
            return "".join(parts), i + 1
        parts.append(ch)
        i += 1
    raise ValueError("Unterminated SQL string")


def skip_type_cast(s: str, i: int) -> int:
    if s.startswith("::", i):
        j = i + 2
        while j < len(s) and (s[j].isalnum() or s[j] in "_"):
            j += 1
        return j
    return i


def parse_sql_value(s: str, start: int) -> tuple[str | None, int]:
    i = start
    while i < len(s) and s[i].isspace():
        i += 1
    if i >= len(s):
        raise ValueError("Unexpected end while parsing value")

    if s.startswith("null", i) and (i + 4 >= len(s) or not s[i + 4].isalnum()):
        return None, skip_type_cast(s, i + 4)

    if s[i] == "'":
        value, end = parse_sql_string(s, i)
        return value, skip_type_cast(s, end)

    # bare token (shouldn't happen for our seed)
    m = re.match(r"[^,\)]+", s[i:])
    if not m:
        raise ValueError(f"Cannot parse value at {i}")
    end = i + m.end()
    return m.group(0).strip(), skip_type_cast(s, end)


def parse_row(s: str, start: int) -> tuple[list[str | None], int]:
    i = start
    while i < len(s) and s[i].isspace():
        i += 1
    if s[i] != "(":
        raise ValueError(f"Expected '(' at {i}")
    i += 1

    values: list[str | None] = []
    while True:
        while i < len(s) and s[i].isspace():
            i += 1
        if i < len(s) and s[i] == ")":
            return values, i + 1
        value, i = parse_sql_value(s, i)
        values.append(value)
        while i < len(s) and s[i].isspace():
            i += 1
        if i < len(s) and s[i] == ",":
            i += 1
            continue
        if i < len(s) and s[i] == ")":
            return values, i + 1
        raise ValueError(f"Expected ',' or ')' at {i}")


def normalize_field(value: str | None) -> str:
    if value is None:
        return ""
    text = value.replace("\r\n", "\n").replace("\r", "\n")
    text = " ".join(part for part in text.split("\n") if part is not None)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def extract_rows(sql_text: str) -> list[list[str | None]]:
    marker = ") values"
    idx = sql_text.lower().find(marker)
    if idx == -1:
        raise ValueError("Could not find VALUES clause")
    body = sql_text[idx + len(marker) :]
    for stop in ("\n);", "\nselect setval"):
        stop_idx = body.lower().find(stop.lower())
        if stop_idx != -1:
            body = body[:stop_idx]
            break

    rows: list[list[str | None]] = []
    i = 0
    while i < len(body):
        while i < len(body) and body[i] not in "(":
            i += 1
        if i >= len(body):
            break
        row, i = parse_row(body, i)
        if len(row) == 15:
            rows.append(row)
    return rows


def row_to_csv_record(sql_values: list[str | None]) -> list[str]:
    record = {header: "" for header in CSV_HEADERS}
    for sql_idx, header in SQL_TO_CSV.items():
        if sql_idx >= len(sql_values):
            continue
        record[header] = normalize_field(sql_values[sql_idx])
    return [record[h] for h in CSV_HEADERS]


def main() -> None:
    sql_text = SQL_PATH.read_text(encoding="utf-8")
    rows = extract_rows(sql_text)
    records = [row_to_csv_record(row) for row in rows]

    for idx, record in enumerate(records, start=1):
        if len(record) != 12:
            raise ValueError(f"Row {idx} has {len(record)} columns, expected 12")

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, quoting=csv.QUOTE_ALL, lineterminator="\n")
        writer.writerow(CSV_HEADERS)
        writer.writerows(records)

    print(f"Wrote {len(records)} rows to {OUT_PATH}")


if __name__ == "__main__":
    main()
