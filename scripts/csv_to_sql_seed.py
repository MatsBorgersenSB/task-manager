#!/usr/bin/env python3
"""Generate commissioning_2026.sql from commissioning CSV."""

from __future__ import annotations

import csv
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "supabase" / "seeds" / "commissioning_2026.csv"
SQL_PATH = ROOT / "supabase" / "seeds" / "commissioning_2026.sql"
CLEAN_CSV_PATH = ROOT / "supabase" / "seeds" / "commissioning_2026_clean.csv"

REGISTRATION_DATE = "2026-06-11"

# CSV header -> tasks column
FIELD_MAP = [
    ("Issue", "title"),
    ("status", "status"),
    ("Priority", "priority"),
    ("Responsible", "responsible"),
    ("CE Comments", "description"),
    ("Response or Action taken by SB", "response_sb"),
    ("SB Note", "sb_note"),
    ("Date Due", "date_due"),
    ("Date Completed", "date_completed"),
    ("SB Status", "sb_status"),
    ("Risk", "risk"),
    ("SB Owner", "sb_owner"),
]


def normalize(value: str | None) -> str:
    if value is None:
        return ""
    text = value.replace("\r\n", "\n").replace("\r", "\n")
    text = " ".join(part for part in text.split("\n") if part is not None)
    return re.sub(r"\s+", " ", text).strip()


def sql_literal(value: str) -> str:
    if not value:
        return "null"
    return "'" + value.replace("'", "''") + "'"


def sql_date(value: str) -> str:
    if not value:
        return "null"
    return f"'{value}'::date"


def read_rows() -> list[dict[str, str]]:
    with CSV_PATH.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        rows: list[dict[str, str]] = []
        for raw in reader:
            row = {key: normalize(raw.get(key, "")) for key in raw.keys()}
            if not row.get("Issue", "").strip():
                continue
            rows.append(row)
        return rows


def write_clean_csv(rows: list[dict[str, str]]) -> None:
    headers = [name for name, _ in FIELD_MAP]
    with CLEAN_CSV_PATH.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, quoting=csv.QUOTE_ALL, lineterminator="\n")
        writer.writerow(headers)
        for row in rows:
            writer.writerow([row.get(h, "") for h in headers])


def row_to_sql(task_number: int, row: dict[str, str]) -> str:
    title = row.get("Issue", "")
    description = row.get("CE Comments", "")
    status = row.get("status", "")
    priority = row.get("Priority", "")
    responsible = row.get("Responsible", "")
    risk = row.get("Risk", "")
    date_due = row.get("Date Due", "")
    date_completed = row.get("Date Completed", "")
    sb_status = row.get("SB Status", "")
    sb_owner = row.get("SB Owner", "")
    sb_note = row.get("SB Note", "")
    response_sb = row.get("Response or Action taken by SB", "")

    return (
        f"  ({task_number}, {sql_literal(title)}, {sql_literal(description)}, "
        f"{sql_literal(status)}, {sql_literal(priority)}, {sql_literal(responsible)}, "
        f"'{REGISTRATION_DATE}'::date, {sql_literal(risk)}, null, "
        f"{sql_date(date_due)}, {sql_date(date_completed)}, "
        f"{sql_literal(sb_status)}, {sql_literal(sb_owner)}, "
        f"{sql_literal(sb_note)}, {sql_literal(response_sb)})"
    )


def main() -> None:
    rows = read_rows()
    write_clean_csv(rows)

    lines = [
        f"-- Import from {CSV_PATH.name}",
        f"-- {len(rows)} task(s)",
        "",
        "truncate public.tasks restart identity cascade;",
        "",
        "insert into public.tasks (",
        "  task_number, title, description, status, priority, responsible, registration_date, risk, risk_comment, date_due, date_completed, sb_status, sb_owner, sb_note, response_sb",
        ") values",
    ]

    value_lines = [row_to_sql(i, row) for i, row in enumerate(rows, start=1)]
    lines.append(",\n".join(value_lines) + ";")
    lines.extend(
        [
            "",
            "select setval(",
            "  pg_get_serial_sequence('public.tasks', 'task_number'),",
            "  (select coalesce(max(task_number), 1) from public.tasks)",
            ");",
            "",
            f"-- Done: {len(rows)} task(s) imported.",
        ]
    )

    SQL_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {len(rows)} tasks to {SQL_PATH}")
    print(f"Wrote clean CSV to {CLEAN_CSV_PATH}")


if __name__ == "__main__":
    main()
