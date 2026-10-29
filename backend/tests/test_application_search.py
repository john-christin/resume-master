import pytest

from database import Base, SessionLocal, engine
from models.application import Application
from models.call import Call
from models.profile import Profile
from models.user import User
from routers.applications import list_applications


@pytest.fixture()
def db():
    tables = [t.__table__ for t in (User, Profile, Application, Call)]
    Base.metadata.drop_all(engine, tables=tables)
    Base.metadata.create_all(engine, tables=tables)
    session = SessionLocal()
    yield session
    session.close()


def search(db, user, term):
    page = list_applications(search=term, current_user=user, db=db, page=1, page_size=10,
                             sort_by="created_at", sort_dir="desc", call_status=None,
                             profile_name=None, username=None)
    return sorted(i.job_title for i in page.items)


def test_every_word_must_match_company_or_role(db):
    user = User(username="bidder1", hashed_password="x", role="bidder", status="approved")
    db.add(user)
    db.flush()
    for company, title in [("Acme", "Backend Engineer"), ("Acme", "Designer"), ("Globex", "Backend Engineer")]:
        db.add(Application(user_id=user.id, company=company, job_title=title, job_description="x"))
    db.commit()

    assert search(db, user, "acme") == ["Backend Engineer", "Designer"]
    assert search(db, user, "acme engineer") == ["Backend Engineer"]
    assert search(db, user, "engineer acme") == ["Backend Engineer"]
    assert search(db, user, "acme nothing") == []
