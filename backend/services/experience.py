"""Total years of professional experience, worked out in code.

The model is only given date ranges, and it is unreliable at adding them up (and
does not know today's date for a job that runs to "Present"), so we calculate the
figure and hand it over. It counts time actually worked, not the span of a career.
"""
from datetime import date

from services.docx_helpers import parse_month_year

_STILL_WORKING = {"present", "current", "now", "today", "ongoing", ""}


def _to_month_index(raw: str, *, end: bool, today: date) -> int | None:
    """Months since year 0 for '2021-03' / 'Mar 2021' / '2021'; None if unreadable."""
    if end and raw.strip().lower() in _STILL_WORKING:
        return today.year * 12 + today.month - 1
    parsed = parse_month_year(raw)
    if not parsed:
        return None
    month, year = parsed
    if month is None:  # year only: January for a start, December for an end
        month = 12 if end else 1
    return min(year * 12 + month - 1, today.year * 12 + today.month - 1)


def total_experience_years(experiences: list[dict], today: date | None = None) -> int | None:
    """Whole years actually worked (Present = today), rounded down.

    Overlapping jobs are counted once and gaps between jobs are not counted.
    Both the first and the last month of a job count. Returns None when no start
    date can be read.
    """
    today = today or date.today()
    spans = []
    for exp in experiences:
        start = _to_month_index(exp.get("start_date") or "", end=False, today=today)
        if start is None:
            continue
        end = _to_month_index(exp.get("end_date") or "", end=True, today=today)
        spans.append((start, max(start, end) if end is not None else start))
    if not spans:
        return None

    months = 0
    cur_start, cur_end = None, None
    for start, end in sorted(spans):
        if cur_end is not None and start <= cur_end + 1:  # overlaps or directly follows
            cur_end = max(cur_end, end)
            continue
        if cur_end is not None:
            months += cur_end - cur_start + 1
        cur_start, cur_end = start, end
    months += cur_end - cur_start + 1
    return months // 12


def experience_prompt_line(experiences: list[dict], today: date | None = None) -> str:
    """The line placed in the candidate info of a prompt ("" when there is nothing to say)."""
    today = today or date.today()
    years = total_experience_years(experiences, today)
    if not years:
        return ""
    return (
        f"Total professional experience: {years}+ years "
        f"(total time worked, calculated from the work history as of {today.isoformat()})\n"
    )
