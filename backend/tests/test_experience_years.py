from datetime import date
from types import SimpleNamespace

from services import ai_service
from services.experience import experience_prompt_line, total_experience_years

TODAY = date(2026, 11, 9)


def job(start, end=None):
    return {"company": "Acme", "title": "Dev", "start_date": start, "end_date": end, "description": None}


def test_present_resolves_to_today():
    # Mar 2014 .. Nov 2026 is 12 years 9 months
    assert total_experience_years([job("2014-03", None)], TODAY) == 12
    assert total_experience_years([job("2014-03", "Present")], TODAY) == 12


def test_overlaps_count_once_and_gaps_are_not_counted():
    jobs = [job("2015-01", "2018-12"), job("2017-06", "2019-06")]
    assert total_experience_years(jobs, TODAY) == 4  # Jan 2015 .. Jun 2019, no double counting
    # three years, a seven-year gap, three more years
    assert total_experience_years([job("2010-01", "2012-12"), job("2020-01", "2022-12")], TODAY) == 6


def test_jobs_that_directly_follow_each_other_join_up():
    jobs = [job("2019-08", "2022-04"), job("2022-05", "2026-08"), job("2016-11", "2019-07")]
    assert total_experience_years(jobs, TODAY) == 9  # Nov 2016 .. Aug 2026 is 118 months


def test_time_after_the_last_job_ended_is_not_counted():
    assert total_experience_years([job("2012-01", "2020-12")], TODAY) == 9


def test_internship_and_gap_before_the_career_start():
    # Jeremy Steven: a 3 month internship, a 28 month gap, then Dec 2014 .. Aug 2026 without a break
    jobs = [
        job("2012-06", "2012-08"),
        job("2014-12", "2016-11"),
        job("2016-11", "2019-07"),
        job("2019-08", "2022-04"),
        job("2022-05", "2026-08"),
    ]
    assert total_experience_years(jobs, TODAY) == 12  # 3 + 141 months


def test_other_date_formats_and_unreadable_ones():
    assert total_experience_years([job("Mar 2014", "03/2024")], TODAY) == 10
    assert total_experience_years([job("2014", "2024")], TODAY) == 11  # January 2014 .. December 2024
    assert total_experience_years([job("sometime"), job("2020-01", "2021-12")], TODAY) == 2
    assert total_experience_years([job("sometime")], TODAY) is None
    assert total_experience_years([], TODAY) is None


def test_prompt_line_is_a_floor_and_empty_when_under_a_year():
    line = experience_prompt_line([job("2014-03", None)], TODAY)
    assert line == (
        "Total professional experience: 12+ years "
        "(total time worked, calculated from the work history as of 2026-11-09)\n"
    )
    assert experience_prompt_line([job("2026-06", None)], TODAY) == ""
    assert experience_prompt_line([], TODAY) == ""


def test_the_figure_reaches_the_cover_letter_and_summary_prompts(monkeypatch):
    seen = []

    def fake_call(messages, **kwargs):
        seen.append(messages)
        return SimpleNamespace(
            content='{"summary": "s", "skills": []}', prompt_tokens=1, completion_tokens=1, cost=0.0,
            provider="p", model_id="m", model_config_id=None, input_price_per_1k=0.0,
            output_price_per_1k=0.0, used_pool_key_id=None,
        )

    monkeypatch.setattr(ai_service, "_call_llm", fake_call)
    exps = [job("2010-01", None)]
    ai_service.generate_cover_letter("Jo", None, None, exps, "jd", "Dev")
    ai_service.generate_resume_content("Jo", None, None, exps, "jd", "Dev")

    years = total_experience_years(exps)
    assert len(seen) == 2
    for messages in seen:
        assert f"Total professional experience: {years}+ years" in messages[1]["content"]
        assert "Total professional experience" in messages[0]["content"]  # the rule that tells it to use it
