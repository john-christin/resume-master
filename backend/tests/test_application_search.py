import pytest

from database import Base, SessionLocal, engine
from models.application import Application
from models.call import Call
from models.profile import Profile
from models.profile_share import profile_shares
from models.user import User
from routers.applications import list_applications


@pytest.fixture()
def db():
    tables = [t.__table__ for t in (User, Profile, Application, Call)] + [profile_shares]
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


def test_bidder_sees_applications_on_shared_and_owned_profiles(db):
    from services.access import can_access_application

    admin = User(username="admin1", hashed_password="x", role="admin", status="approved")
    bidder = User(username="bidder1", hashed_password="x", role="bidder", status="approved")
    other = User(username="bidder2", hashed_password="x", role="bidder", status="approved")
    db.add_all([admin, bidder, other])
    db.flush()
    shared = Profile(owner_id=admin.id, name="Shared")
    private = Profile(owner_id=admin.id, name="Private")
    mine = Profile(owner_id=bidder.id, name="Mine")
    db.add_all([shared, private, mine])
    db.flush()
    db.execute(profile_shares.insert().values(profile_id=shared.id, user_id=bidder.id))
    rows = {
        "by admin on shared": (admin, shared),
        "by admin on private": (admin, private),
        "by other on mine": (other, mine),
        "by other on private": (other, private),
    }
    apps = {}
    for title, (who, profile) in rows.items():
        apps[title] = Application(user_id=who.id, profile_id=profile.id, job_title=title,
                                  company="Acme", job_description="x")
        db.add(apps[title])
    db.commit()

    # the generator's own copy, the shared profile, and the profile the bidder owns
    assert search(db, bidder, "") == ["by admin on shared", "by other on mine"]
    assert can_access_application(bidder, apps["by admin on shared"], db)
    assert can_access_application(bidder, apps["by other on mine"], db)
    assert not can_access_application(bidder, apps["by admin on private"], db)
    assert not can_access_application(bidder, apps["by other on private"], db)
    # sharing is per profile: another bidder with no access sees nothing of it
    assert search(db, other, "") == ["by other on mine", "by other on private"]
