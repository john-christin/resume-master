"""Reads and writes a profile's Google Sheet of job applications.

The sheet layout is not fixed: columns are found by header name (case, spacing and
punctuation ignored), and the header row is the first row that has both "Company" and
"Position". Rows are located by their job links rather than by row number, so manual
sorting or inserting rows in the sheet does not break later updates.

Only RAW values are written, so text scraped from job pages is never evaluated as a
formula. "Date" and "No." are left to the sheet itself (it pre-fills them on blank rows).
"""

import json
import logging
import re
from datetime import datetime
from typing import Any, Protocol
from urllib.parse import quote, urlparse
from zoneinfo import ZoneInfo

from config import settings

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
API_ROOT = "https://sheets.googleapis.com/v4/spreadsheets"

# logical field -> normalized header text
FIELD_HEADERS: dict[str, str] = {
    "date": "date",
    "number": "no",
    "job_board": "jobboard",
    "company": "company",
    "position": "position",
    "posted": "whenposted",
    "source_link": "sourcelink",
    "actual_link": "actuallink",
    "tech_stack": "maintechstack",
    "approved": "approved",
    "applied": "applied",
    "comment": "comment",
}
REQUIRED_FIELDS = ("company", "position")
HEADER_SEARCH_ROWS = 10
MAX_CELL_CHARS = 2000

# host fragment -> label as written in the sheets already in use
JOB_BOARDS: list[tuple[str, str]] = [
    ("linkedin.", "Linkedin"),
    ("ziprecruiter.", "Ziprecruiter"),
    ("jobright.", "Jobright"),
    ("adzuna.", "Adzuna"),
    ("monster.", "Monster"),
    ("hiring.cafe", "HiringCafe"),
    ("jobgether.", "Jobgether"),
    ("indeed.", "Indeed"),
    ("glassdoor.", "Glassdoor"),
    ("dice.", "Dice"),
    ("wellfound.", "Wellfound"),
    ("builtin.", "Builtin"),
]


class SheetError(Exception):
    """Anything that stops a sheet write; the message is shown to the profile owner."""


class SheetsClient(Protocol):
    def tab_title(self, spreadsheet_id: str, gid: int | None) -> str: ...

    def read(self, spreadsheet_id: str, tab: str) -> list[list[str]]: ...

    def write_cells(
        self, spreadsheet_id: str, updates: list[tuple[str, Any]]
    ) -> None: ...

    def append_row(self, spreadsheet_id: str, tab: str, row: list[Any]) -> None: ...


# ── URL / value helpers ──────────────────────────────────────────────────────


def parse_sheet_url(url: str) -> tuple[str, int | None]:
    """Return (spreadsheet_id, gid or None) from a Google Sheets link."""
    m = re.search(r"/spreadsheets/d/([A-Za-z0-9_-]+)", url or "")
    if not m:
        raise SheetError("That doesn't look like a Google Sheets link.")
    gid = re.search(r"[#&?]gid=(\d+)", url)
    return m.group(1), int(gid.group(1)) if gid else None


def clean(value: Any) -> str:
    """Single-line, trimmed text (job pages often carry stray newlines and spaces)."""
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()[:MAX_CELL_CHARS]


def job_board_from_url(url: str | None) -> str:
    host = (urlparse(url or "").hostname or "").lower()
    if not host:
        return ""
    for fragment, label in JOB_BOARDS:
        if fragment in host:
            return label
    parts = host.removeprefix("www.").split(".")
    label = parts[-2] if len(parts) >= 2 else parts[0]
    return label.capitalize()


def _norm_header(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (text or "").lower())


def _norm_link(url: str) -> str:
    return clean(url).rstrip("/")


def _col_letter(idx: int) -> str:
    n, out = idx + 1, ""
    while n:
        n, rem = divmod(n - 1, 26)
        out = chr(65 + rem) + out
    return out


def a1(tab: str, col: int, row: int) -> str:
    """A1 reference for 0-based column and 1-based row, with the tab quoted."""
    return f"'{tab.replace(chr(39), chr(39) * 2)}'!{_col_letter(col)}{row}"


def _today_in_sheet_tz() -> tuple[int, int, int]:
    now = datetime.now(ZoneInfo(settings.sheet_timezone))
    return now.month, now.day, now.year


# ── Layout of a particular sheet ─────────────────────────────────────────────


class Layout:
    def __init__(self, header_idx: int, cols: dict[str, int]):
        self.header_idx = header_idx  # 0-based index into the rows list
        self.cols = cols

    @classmethod
    def detect(cls, rows: list[list[str]]) -> "Layout":
        wanted = {v: k for k, v in FIELD_HEADERS.items()}
        for idx, row in enumerate(rows[:HEADER_SEARCH_ROWS]):
            cols: dict[str, int] = {}
            for c, text in enumerate(row):
                field = wanted.get(_norm_header(text))
                if field and field not in cols:
                    cols[field] = c
            if all(f in cols for f in REQUIRED_FIELDS):
                return cls(idx, cols)
        raise SheetError(
            "Couldn't find the header row. The sheet needs 'Company' and 'Position' "
            "columns near the top."
        )

    def cell(self, row: list[str], field: str) -> str:
        c = self.cols.get(field)
        if c is None or c >= len(row):
            return ""
        return clean(row[c])

    def first_empty_row(self, rows: list[list[str]]) -> int | None:
        """0-based index of the first row below the header with no Company, if any."""
        for idx in range(self.header_idx + 1, len(rows)):
            if not self.cell(rows[idx], "company"):
                return idx
        return None

    def filled_rows(self, rows: list[list[str]]) -> int:
        return sum(
            1
            for r in rows[self.header_idx + 1 :]
            if self.cell(r, "company")
        )

    def find_row(self, rows: list[list[str]], match: dict[str, str]) -> int | None:
        """Newest row with the same company and links (falls back to position)."""
        company = clean(match.get("company")).lower()
        source = _norm_link(match.get("source_link", ""))
        actual = _norm_link(match.get("actual_link", ""))
        position = clean(match.get("position")).lower()
        has_links = "source_link" in self.cols and "actual_link" in self.cols
        for idx in range(len(rows) - 1, self.header_idx, -1):
            row = rows[idx]
            if self.cell(row, "company").lower() != company or not company:
                continue
            if has_links and (source or actual):
                # a link the caller doesn't know is a wildcard (e.g. web-form applications
                # only know the actual link)
                if (not source or _norm_link(self.cell(row, "source_link")) == source) and (
                    not actual or _norm_link(self.cell(row, "actual_link")) == actual
                ):
                    return idx
            elif self.cell(row, "position").lower() == position:
                return idx
        return None


# ── Operations ───────────────────────────────────────────────────────────────

_JOB_FIELDS = (
    "job_board",
    "company",
    "position",
    "posted",
    "source_link",
    "actual_link",
    "tech_stack",
    "comment",
)


def _load(client: SheetsClient, sheet_url: str):
    spreadsheet_id, gid = parse_sheet_url(sheet_url)
    tab = client.tab_title(spreadsheet_id, gid)
    rows = client.read(spreadsheet_id, tab)
    return spreadsheet_id, tab, rows, Layout.detect(rows)


def check_sheet(client: SheetsClient, sheet_url: str) -> dict:
    """Validate access and layout; used by the 'Test connection' button."""
    _, tab, rows, layout = _load(client, sheet_url)
    nxt = layout.first_empty_row(rows)
    return {
        "tab": tab,
        "header_row": layout.header_idx + 1,
        "filled_rows": layout.filled_rows(rows),
        "next_row": (nxt + 1) if nxt is not None else len(rows) + 1,
        "missing_columns": [
            f for f in _JOB_FIELDS + ("applied",) if f not in layout.cols
        ],
    }


def add_job(client: SheetsClient, sheet_url: str, job: dict) -> str:
    """Write a job into the first empty row (or append). Safe to retry: an existing
    row with the same company and links is left alone."""
    spreadsheet_id, tab, rows, layout = _load(client, sheet_url)

    if layout.find_row(rows, job) is not None:
        return "exists"

    values = {f: clean(job.get(f)) for f in _JOB_FIELDS if f in layout.cols}
    target = layout.first_empty_row(rows)

    if target is not None:
        updates = [(a1(tab, layout.cols[f], target + 1), v) for f, v in values.items()]
        client.write_cells(spreadsheet_id, updates)
        return f"row {target + 1}"

    # No pre-made blank row: append, filling Date / No. / checkboxes ourselves.
    width = max(layout.cols.values()) + 1
    row: list[Any] = [""] * width
    for f, v in values.items():
        row[layout.cols[f]] = v
    month, day, year = _today_in_sheet_tz()
    today = f"{month}/{day}/{year}"
    if "date" in layout.cols:
        row[layout.cols["date"]] = today
        if "number" in layout.cols:
            same_day = sum(
                1
                for r in rows[layout.header_idx + 1 :]
                if layout.cell(r, "date") == today and layout.cell(r, "company")
            )
            row[layout.cols["number"]] = str(same_day + 1)
    for flag in ("approved", "applied"):
        if flag in layout.cols:
            row[layout.cols[flag]] = False
    client.append_row(spreadsheet_id, tab, row)
    return "appended"


def update_job(
    client: SheetsClient, sheet_url: str, match: dict, fields: dict
) -> str:
    """Patch fields on the row for `match`.

    comment    -> added after any existing note (never overwrites a person's text)
    tech_stack -> only filled when the cell is empty
    applied    -> checkbox, always set
    anything else overwrites
    """
    spreadsheet_id, tab, rows, layout = _load(client, sheet_url)
    idx = layout.find_row(rows, match)
    if idx is None:
        raise SheetError("Row not found in the sheet (was it deleted or edited?).")

    updates: list[tuple[str, Any]] = []
    for field, value in fields.items():
        col = layout.cols.get(field)
        if col is None:
            continue
        existing = layout.cell(rows[idx], field)
        if field == "applied":
            new: Any = bool(value)
        else:
            new = clean(value)
            if field == "comment":
                if not new or new.lower() in existing.lower():
                    continue
                new = f"{existing} | {new}" if existing else new
            elif field == "tech_stack" and existing:
                continue
            elif not new:
                continue
        updates.append((a1(tab, col, idx + 1), new))

    if updates:
        client.write_cells(spreadsheet_id, updates)
    return f"row {idx + 1}"


# ── Google implementation ────────────────────────────────────────────────────


class GoogleSheetsClient:
    def __init__(self, info: dict):
        from google.auth.transport.requests import AuthorizedSession
        from google.oauth2 import service_account

        creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
        self.email: str = info.get("client_email", "")
        self._session = AuthorizedSession(creds)

    def _request(self, method: str, url: str, **kwargs) -> dict:
        resp = self._session.request(method, url, timeout=30, **kwargs)
        if resp.status_code >= 400:
            try:
                detail = resp.json().get("error", {}).get("message", "")
            except ValueError:
                detail = resp.text[:200]
            if resp.status_code == 403:
                raise SheetError(
                    f"Permission denied. Share the sheet with {self.email} as Editor."
                )
            if resp.status_code == 404:
                raise SheetError("Sheet not found. Check the link.")
            raise SheetError(f"Google Sheets error {resp.status_code}: {detail}")
        return resp.json() if resp.content else {}

    def tab_title(self, spreadsheet_id: str, gid: int | None) -> str:
        data = self._request(
            "GET",
            f"{API_ROOT}/{spreadsheet_id}",
            params={"fields": "sheets.properties(sheetId,title)"},
        )
        sheets = [s["properties"] for s in data.get("sheets", [])]
        if not sheets:
            raise SheetError("The spreadsheet has no tabs.")
        if gid is None:
            return sheets[0]["title"]
        for props in sheets:
            if props.get("sheetId") == gid:
                return props["title"]
        raise SheetError("The tab in that link no longer exists.")

    def read(self, spreadsheet_id: str, tab: str) -> list[list[str]]:
        quoted = quote("'" + tab.replace("'", "''") + "'", safe="")
        data = self._request(
            "GET",
            f"{API_ROOT}/{spreadsheet_id}/values/{quoted}",
            params={"majorDimension": "ROWS", "valueRenderOption": "FORMATTED_VALUE"},
        )
        return [[str(c) for c in row] for row in data.get("values", [])]

    def write_cells(self, spreadsheet_id: str, updates: list[tuple[str, Any]]) -> None:
        body = {
            "valueInputOption": "RAW",
            "data": [{"range": rng, "values": [[val]]} for rng, val in updates],
        }
        self._request(
            "POST", f"{API_ROOT}/{spreadsheet_id}/values:batchUpdate", json=body
        )

    def append_row(self, spreadsheet_id: str, tab: str, row: list[Any]) -> None:
        quoted = quote("'" + tab.replace("'", "''") + "'", safe="")
        self._request(
            "POST",
            f"{API_ROOT}/{spreadsheet_id}/values/{quoted}:append",
            params={"valueInputOption": "RAW", "insertDataOption": "INSERT_ROWS"},
            json={"values": [row]},
        )


_client: GoogleSheetsClient | None = None


def _load_service_account_info() -> dict | None:
    if settings.google_service_account_json.strip():
        return json.loads(settings.google_service_account_json)
    if settings.google_service_account_file.strip():
        with open(settings.google_service_account_file, encoding="utf-8") as fh:
            return json.load(fh)
    return None


def get_client() -> GoogleSheetsClient | None:
    """The shared Google client, or None when no service account is configured."""
    global _client
    if _client is None:
        try:
            info = _load_service_account_info()
        except (OSError, ValueError):
            logger.exception("Could not load the Google service account credentials")
            return None
        if info is None:
            return None
        _client = GoogleSheetsClient(info)
    return _client
