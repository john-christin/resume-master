import json

import pytest

from database import Base, SessionLocal, engine
from models.application import Application
from models.education import Education
from models.experience import Experience
from models.profile import Profile
from models.user import User
from prompts import CHAT_INTERVIEW_PREP
from routers.chat import _build_system_prompt


@pytest.fixture()
def db():
    tables = [t.__table__ for t in (User, Profile, Experience, Education, Application)]
    Base.metadata.drop_all(engine, tables=tables)
    Base.metadata.create_all(engine, tables=tables)
    session = SessionLocal()
    yield session
    session.close()


def seed(db, tailored=True):
    user = User(username="bidder1", hashed_password="x", role="bidder", status="approved")
    db.add(user)
    db.flush()
    profile = Profile(owner_id=user.id, name="Jeremy Steven")
    db.add(profile)
    db.flush()
    db.add_all([
        Experience(profile_id=profile.id, company="Acme", title="Developer", start_date="2012-01",
                   end_date="2015-12", description="Built reporting on Oracle and SQL Server."),
        Experience(profile_id=profile.id, company="Globex", title="Senior Engineer", start_date="2016-01",
                   end_date="2020-12", description="Led the React platform team."),
    ])
    bullets = [{"company": "Globex", "title": "Senior Engineer", "start_date": "2016-01", "end_date": "2020-12",
                "bullets": ["Shipped a design system"]}]
    app = Application(user_id=user.id, profile_id=profile.id, company="Mercury", job_title="Engineer",
                      job_description="jd", tailored_bullets=json.dumps(bullets) if tailored else None)
    db.add(app)
    db.commit()
    return app


def test_prompt_has_total_years_highlights_and_the_full_work_history(db):
    prompt = _build_system_prompt(seed(db), db)

    assert "Total professional experience: 9+ years" in prompt  # 48 + 60 months
    assert "Shipped a design system" in prompt  # highlights tailored for this job
    assert "Built reporting on Oracle and SQL Server." in prompt  # only in the master profile
    assert "Led the React platform team." in prompt
    for placeholder in ("{name}", "{total_experience}", "{experiences}", "{work_history}", "{job_description}"):
        assert placeholder not in prompt


def test_works_without_tailored_bullets(db):
    prompt = _build_system_prompt(seed(db, tailored=False), db)
    assert "Built reporting on Oracle and SQL Server." in prompt


def test_prompt_no_longer_tells_the_model_to_use_only_listed_experience():
    assert "use only experience that is listed" not in CHAT_INTERVIEW_PREP
    assert "never say they lack experience" in CHAT_INTERVIEW_PREP
