"""Google Sheet sync: column mapping, row placement, outbox processing.

The sheet grid below mirrors a real job-tracking sheet: a banner row, the header row,
filled rows (some with stray newlines in cells) and pre-made blank rows that already
carry a Date, a No. and unchecked boxes.
"""

import re
from datetime import datetime, timedelta

import pytest

import models  # noqa: F401  (registers every table on Base)
from database import Base, SessionLocal, engine
from models.application import Application
from models.profile import Profile
from models.queue import QueueTask
from models.sheet_sync import SheetSyncJob
from models.user import User
from services import sheet_service, sheet_sync
from services.sheet_service import SheetError

SHEET_URL = "https://docs.google.com/spreadsheets/d/abc123_-XYZ/edit?gid=0#gid=0"
HEADER = [
    "Date", "No.", "Job Board", "Company", "Position", "When Posted",
    "Source Link", "Actual Link", "Main TechStack", "Approved?", "Applied?", "Comment",
]


def make_grid() -> list[list[str]]:
    return [
        ["Don't apply to Microsoft, Boeing, Gov jobs"],
        list(HEADER),
        ["10/26/2026", "1", "Jobright", "Cognizant\n", ".NET Full Stack Lead\n", "24 hours ago",
         "https://jobright.ai/jobs/info/6ada", "https://careers.cognizant.com/job/1",
         ".NET Core, C#", "FALSE", "TRUE"],
        ["10/26/2026", "2", "Jobright", "NetImpact Strategies Inc.\n", "Senior .NET Developer",
         "24 hours ago", "https://jobright.ai/jobs/info/6aa5", "https://icims.com/jobs/3749",
         "C# and .NET 10", "FALSE", "FALSE", "AA"],
        ["10/26/2026", "3", "", "", "", "", "", "", "", "FALSE", "FALSE"],
        ["10/26/2026", "4", "", "", "", "", "", "", "", "FALSE", "FALSE"],
    ]


class FakeSheets:
    """In-memory stand-in for the Google client (same four methods)."""

    def __init__(self, grid=None, tab="Jobs"):
        self.grid = [list(r) for r in (grid if grid is not None else make_grid())]
        self.tab = tab
        self.writes: list[tuple[str, object]] = []
        self.fail_with: Exception | None = None

    def _check(self):
        if self.fail_with:
            raise self.fail_with

    def tab_title(self, spreadsheet_id, gid):
        self._check()
        assert spreadsheet_id == "abc123_-XYZ"
        return self.tab

    def read(self, spreadsheet_id, tab):
        self._check()
        return [list(r) for r in self.grid]

    def write_cells(self, spreadsheet_id, updates):
        self._check()
        for rng, value in updates:
            m = re.fullmatch(r"'(.*)'!([A-Z]+)(\d+)", rng)
            assert m and m.group(1) == self.tab, rng
            col = sum((ord(ch) - 64) * 26**i for i, ch in enumerate(reversed(m.group(2)))) - 1
            row = int(m.group(3)) - 1
            while len(self.grid) <= row:
                self.grid.append([])
            while len(self.grid[row]) <= col:
                self.grid[row].append("")
            self.grid[row][col] = {True: "TRUE", False: "FALSE"}.get(value, value)
            self.writes.append((rng, value))

    def append_row(self, spreadsheet_id, tab, row):
        self._check()
        self.grid.append([{True: "TRUE", False: "FALSE"}.get(v, v) for v in row])

    def row(self, number: int) -> list[str]:
        return self.grid[number - 1]


JOB = {
    "job_board": "Linkedin",
    "company": "Acme Corp",
    "position": "Staff Engineer",
    "posted": "3 days ago",
    "source_link": "https://www.linkedin.com/jobs/view/1/",
    "actual_link": "https://acme.example/careers/9",
}


# ── sheet_service ────────────────────────────────────────────────────────────


def test_parse_sheet_url():
    assert sheet_service.parse_sheet_url(SHEET_URL) == ("abc123_-XYZ", 0)
    assert sheet_service.parse_sheet_url("https://docs.google.com/spreadsheets/d/q1w2/edit") == ("q1w2", None)
    with pytest.raises(SheetError):
        sheet_service.parse_sheet_url("https://example.com/not-a-sheet")


@pytest.mark.parametrize("url,expected", [
    ("https://www.linkedin.com/jobs/view/4473524424/", "Linkedin"),
    ("https://jobright.ai/jobs/info/6ada", "Jobright"),
    ("https://hiring.cafe/viewjob/xyz", "HiringCafe"),
    ("https://www.ziprecruiter.com/c/x", "Ziprecruiter"),
    ("https://boards.greenhouse.io/acme/jobs/1", "Greenhouse"),
    ("", ""),
    (None, ""),
])
def test_job_board_from_url(url, expected):
    assert sheet_service.job_board_from_url(url) == expected


def test_layout_skips_banner_row_and_maps_headers_loosely():
    grid = make_grid()
    grid[1][8] = "Main Tech Stack"  # spacing differs from "Main TechStack"
    layout = sheet_service.Layout.detect(grid)
    assert layout.header_idx == 1
    assert layout.cols["company"] == 3 and layout.cols["tech_stack"] == 8 and layout.cols["applied"] == 10


def test_layout_without_company_and_position_is_rejected():
    with pytest.raises(SheetError):
        sheet_service.Layout.detect([["Name", "Email"], ["a", "b"]])


def test_add_job_uses_first_empty_row_and_leaves_date_number_and_checkboxes():
    sheet = FakeSheets()
    result = sheet_service.add_job(sheet, SHEET_URL, JOB)
    assert result == "row 5"
    row = sheet.row(5)
    assert row[0] == "10/26/2026" and row[1] == "3"          # pre-made Date / No. untouched
    assert row[2:8] == ["Linkedin", "Acme Corp", "Staff Engineer", "3 days ago", JOB["source_link"], JOB["actual_link"]]
    assert row[9:11] == ["FALSE", "FALSE"]                     # checkboxes untouched
    assert {rng[-2:] for rng, _ in sheet.writes}.isdisjoint({"A5", "B5", "J5", "K5"})
    assert sheet.row(6)[2:8] == [""] * 6                       # next blank row still free


def test_add_job_cleans_stray_whitespace_and_newlines():
    sheet = FakeSheets()
    sheet_service.add_job(sheet, SHEET_URL, {**JOB, "company": " Acme\n Corp \n", "position": "Staff\nEngineer"})
    assert sheet.row(5)[3] == "Acme Corp" and sheet.row(5)[4] == "Staff Engineer"


def test_add_job_is_idempotent():
    sheet = FakeSheets()
    sheet_service.add_job(sheet, SHEET_URL, JOB)
    writes = len(sheet.writes)
    assert sheet_service.add_job(sheet, SHEET_URL, JOB) == "exists"
    assert len(sheet.writes) == writes and sheet.row(6)[3] == ""


def test_add_job_never_evaluates_formulas():
    sheet = FakeSheets()
    sheet_service.add_job(sheet, SHEET_URL, {**JOB, "position": '=HYPERLINK("http://evil","x")'})
    # written via RAW values, so Sheets stores it as text; we just must not alter or drop it
    assert sheet.row(5)[4].startswith("=HYPERLINK")


def test_add_job_appends_with_date_number_and_checkboxes_when_no_blank_row(monkeypatch):
    monkeypatch.setattr(sheet_service, "_today_in_sheet_tz", lambda: (10, 27, 2026))
    grid = make_grid()[:4]  # banner, header, two filled rows; no blank rows
    sheet = FakeSheets(grid)
    assert sheet_service.add_job(sheet, SHEET_URL, JOB) == "appended"
    new = sheet.row(5)
    assert new[0] == "10/27/2026" and new[1] == "1"
    assert new[3] == "Acme Corp" and new[9:11] == ["FALSE", "FALSE"]
    sheet_service.add_job(sheet, SHEET_URL, {**JOB, "company": "Other Inc", "actual_link": "https://o.example/1"})
    assert sheet.row(6)[1] == "2"                               # No. counts per day


def test_update_job_fills_tech_stack_only_when_empty():
    sheet = FakeSheets()
    sheet_service.add_job(sheet, SHEET_URL, JOB)
    sheet_service.update_job(sheet, SHEET_URL, JOB, {"tech_stack": "Python, AWS"})
    assert sheet.row(5)[8] == "Python, AWS"
    sheet_service.update_job(sheet, SHEET_URL, JOB, {"tech_stack": "Go"})
    assert sheet.row(5)[8] == "Python, AWS"


def test_update_job_comment_is_appended_not_overwritten():
    sheet = FakeSheets()
    existing = {"company": "NetImpact Strategies Inc.", "source_link": "https://jobright.ai/jobs/info/6aa5",
                "actual_link": "https://icims.com/jobs/3749"}
    sheet_service.update_job(sheet, SHEET_URL, existing, {"comment": "Clearance: TS/SCI required"})
    assert sheet.row(4)[11] == "AA | Clearance: TS/SCI required"
    sheet_service.update_job(sheet, SHEET_URL, existing, {"comment": "Clearance: TS/SCI required"})
    assert sheet.row(4)[11] == "AA | Clearance: TS/SCI required"  # same text isn't added twice


def test_update_job_sets_and_clears_applied_checkbox():
    sheet = FakeSheets()
    sheet_service.add_job(sheet, SHEET_URL, JOB)
    sheet_service.update_job(sheet, SHEET_URL, JOB, {"applied": True})
    assert sheet.row(5)[10] == "TRUE"
    sheet_service.update_job(sheet, SHEET_URL, JOB, {"applied": False})
    assert sheet.row(5)[10] == "FALSE"


def test_rows_are_found_by_links_even_after_the_sheet_is_reordered():
    sheet = FakeSheets()
    sheet_service.add_job(sheet, SHEET_URL, JOB)
    header, filled = sheet.grid[:2], sheet.grid[2:]
    sheet.grid = header + list(reversed(filled))   # someone sorted the sheet
    sheet_service.update_job(sheet, SHEET_URL, JOB, {"applied": True})
    acme = next(r for r in sheet.grid if len(r) > 3 and r[3] == "Acme Corp")
    cognizant = next(r for r in sheet.grid if len(r) > 3 and r[3].startswith("Cognizant"))
    assert acme[10] == "TRUE" and cognizant[10] == "TRUE"   # Cognizant was already TRUE; others untouched
    other = next(r for r in sheet.grid if len(r) > 3 and r[3].startswith("NetImpact"))
    assert other[10] == "FALSE"


def test_update_job_for_a_missing_row_raises():
    with pytest.raises(SheetError):
        sheet_service.update_job(FakeSheets(), SHEET_URL, JOB, {"applied": True})


def test_check_sheet_reports_layout():
    info = sheet_service.check_sheet(FakeSheets(), SHEET_URL)
    assert info["tab"] == "Jobs" and info["header_row"] == 2
    assert info["filled_rows"] == 2 and info["next_row"] == 5 and info["missing_columns"] == []


# ── sheet_sync (outbox) ──────────────────────────────────────────────────────


@pytest.fixture()
def db():
    # Only the tables sync touches: create_all on everything trips over system_logs,
    # which declares one index twice (harmless on Postgres, where Alembic builds the schema).
    tables = [t.__table__ for t in (User, Profile, QueueTask, Application, SheetSyncJob)]
    Base.metadata.drop_all(engine, tables=tables)
    Base.metadata.create_all(engine, tables=tables)
    session = SessionLocal()
    yield session
    session.close()


def seed(db, sheet_url=SHEET_URL):
    user = User(username="bidder1", hashed_password="x", role="bidder", status="approved")
    db.add(user)
    db.flush()
    profile = Profile(owner_id=user.id, name="Michael", job_sheet_url=sheet_url)
    db.add(profile)
    db.flush()
    task = QueueTask(
        user_id=user.id, profile_id=profile.id, profile_name="Michael",
        company=JOB["company"], job_title=JOB["position"], posted_text=JOB["posted"],
        job_source_url=JOB["source_link"], job_url=JOB["actual_link"],
    )
    db.add(task)
    db.flush()
    return user, profile, task


def test_queueing_a_task_writes_the_row_with_board_derived_from_the_source_link(db):
    _, _, task = seed(db)
    sheet_sync.on_task_queued(db, task)
    db.commit()
    sheet = FakeSheets()
    assert sheet_sync.process_pending(db, sheet) == 1
    assert sheet.row(5)[2:8] == ["Linkedin", "Acme Corp", "Staff Engineer", "3 days ago", JOB["source_link"], JOB["actual_link"]]
    assert db.query(SheetSyncJob).one().status == "done"


def test_profiles_without_a_sheet_link_create_no_jobs(db):
    _, _, task = seed(db, sheet_url=None)
    sheet_sync.on_task_queued(db, task)
    sheet_sync.on_task_generated(db, task, ["Python"])
    sheet_sync.on_task_blocked(db, task, "Skipped")
    db.commit()
    assert db.query(SheetSyncJob).count() == 0


def test_full_lifecycle_row_then_tech_stack_then_applied(db):
    _, profile, task = seed(db)
    sheet = FakeSheets()
    sheet_sync.on_task_queued(db, task)
    sheet_sync.on_task_generated(db, task, ["Python", " FastAPI ", "", "AWS", "a", "b", "c", "d"])
    db.commit()
    sheet_sync.process_pending(db, sheet, limit=10)
    assert sheet.row(5)[8] == "Python, FastAPI, AWS, a, b, c"       # first six, trimmed

    app = Application(user_id=task.user_id, profile_id=profile.id, job_title=task.job_title,
                      company=task.company, job_url=task.job_url, job_description="jd")
    db.add(app)
    db.flush()
    task.application_id = app.id
    db.flush()
    app.applied = True
    sheet_sync.on_application_applied(db, app)
    db.commit()
    sheet_sync.process_pending(db, sheet)
    assert sheet.row(5)[10] == "TRUE"
    app.applied = False
    sheet_sync.on_application_applied(db, app)
    db.commit()
    sheet_sync.process_pending(db, sheet)
    assert sheet.row(5)[10] == "FALSE"


def test_blocked_task_reason_goes_to_comment(db):
    _, _, task = seed(db)
    sheet = FakeSheets()
    sheet_sync.on_task_queued(db, task)
    sheet_sync.on_task_blocked(db, task, "Clearance: TS/SCI required; Banned company: Acme")
    db.commit()
    sheet_sync.process_pending(db, sheet, limit=10)
    assert sheet.row(5)[11] == "Clearance: TS/SCI required; Banned company: Acme"


def test_failure_backs_off_blocks_later_jobs_and_never_raises(db):
    _, profile, task = seed(db)
    sheet = FakeSheets()
    sheet.fail_with = SheetError("Permission denied. Share the sheet with bot@x.iam as Editor.")
    sheet_sync.on_task_queued(db, task)
    sheet_sync.on_task_generated(db, task, ["Python"])
    db.commit()
    now = datetime.utcnow()
    assert sheet_sync.process_pending(db, sheet, now=now, limit=10) == 0
    first, second = db.query(SheetSyncJob).order_by(SheetSyncJob.created_at).all()
    assert first.attempts == 1 and "Permission denied" in first.last_error
    assert first.next_attempt_at > now
    assert second.attempts == 0                                   # waited behind the failed insert

    sheet.fail_with = None                                        # owner fixed the permission
    later = now + timedelta(hours=2)
    assert sheet_sync.process_pending(db, sheet, now=later, limit=10) == 2
    assert sheet.row(5)[8] == "Python"


def test_job_fails_for_good_after_max_attempts_and_can_be_retried(db):
    _, profile, task = seed(db)
    sheet = FakeSheets()
    sheet.fail_with = SheetError("nope")
    sheet_sync.on_task_queued(db, task)
    db.commit()
    when = datetime.utcnow()
    for _ in range(sheet_sync.MAX_ATTEMPTS):
        when += timedelta(hours=2)
        sheet_sync.process_pending(db, sheet, now=when)
    job = db.query(SheetSyncJob).one()
    assert job.status == "failed" and job.attempts == sheet_sync.MAX_ATTEMPTS

    sheet.fail_with = None
    assert sheet_sync.retry_failed(db, profile.id) == 1
    assert sheet_sync.process_pending(db, sheet, now=when + timedelta(hours=2)) == 1
    assert db.query(SheetSyncJob).one().status == "done"


def test_sheet_link_removed_after_queueing_fails_the_job_without_calling_google(db):
    _, profile, task = seed(db)
    sheet_sync.on_task_queued(db, task)
    profile.job_sheet_url = None
    db.commit()
    sheet = FakeSheets()
    sheet_sync.process_pending(db, sheet)
    assert db.query(SheetSyncJob).one().status == "failed" and sheet.writes == []


def test_application_without_a_queue_task_is_matched_by_company_and_actual_link(db):
    _, profile, task = seed(db)
    sheet = FakeSheets()
    sheet_sync.on_task_queued(db, task)
    db.commit()
    sheet_sync.process_pending(db, sheet)

    app = Application(user_id=task.user_id, profile_id=profile.id, job_title=task.job_title,
                      company=task.company, job_url=task.job_url, job_description="jd", applied=True)
    db.add(app)
    db.flush()
    sheet_sync.on_application_applied(db, app)       # no QueueTask points at this application
    db.commit()
    sheet_sync.process_pending(db, sheet)
    assert sheet.row(5)[10] == "TRUE"
