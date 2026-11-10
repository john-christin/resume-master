from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from database import Base, SessionLocal, engine
from models.application import Application
from models.profile import Profile
from models.profile_share import profile_shares
from models.queue import QueueTask
from models.user import User
from routers.queue import delete_task, list_tasks, queue_status


@pytest.fixture()
def db():
    tables = [t.__table__ for t in (User, Profile, Application, QueueTask)] + [profile_shares]
    Base.metadata.drop_all(engine, tables=tables)
    Base.metadata.create_all(engine, tables=tables)
    session = SessionLocal()
    yield session
    session.close()


def make_user(db, name):
    user = User(username=name, hashed_password="x", role="bidder", status="approved")
    db.add(user)
    db.flush()
    return user


def listing(db, user, **kw):
    args = dict(status=None, profile_id=None, created_from=None, created_to=None, page=1, page_size=50)
    page = list_tasks(**{**args, **kw}, current_user=user, db=db)
    return [i["job_title"] for i in page["items"]]


def seed(db):
    manager, recruiter, stranger = (make_user(db, n) for n in ("manager", "recruiter", "stranger"))
    shared = Profile(owner_id=manager.id, name="Shared")
    private = Profile(owner_id=manager.id, name="Private")
    db.add_all([shared, private])
    db.flush()
    db.execute(profile_shares.insert().values(profile_id=shared.id, user_id=recruiter.id))
    now = datetime.utcnow()
    for title, user, profile, age in [
        ("recruiter on shared", recruiter, shared, 3),
        ("manager on shared", manager, shared, 2),
        ("recruiter on private", recruiter, private, 1),  # recruiter had access once; manager still owns it
        ("stranger on own", stranger, None, 0),
    ]:
        db.add(QueueTask(user_id=user.id, profile_id=profile.id if profile else None,
                         job_title=title, status="failed", created_at=now - timedelta(hours=age)))
    db.commit()
    return manager, recruiter, stranger


def test_owner_and_sharers_see_tasks_on_the_profile_newest_first(db):
    manager, recruiter, stranger = seed(db)

    assert listing(db, manager) == ["recruiter on private", "manager on shared", "recruiter on shared"]
    # the recruiter sees the shared profile's tasks and their own, but not the owner's private profile
    assert listing(db, recruiter) == ["recruiter on private", "manager on shared", "recruiter on shared"]
    assert listing(db, stranger) == ["stranger on own"]


def test_profile_filter_and_date_range(db):
    manager, recruiter, _ = seed(db)
    shared, private = (db.query(Profile).filter_by(name=n).one().id for n in ("Shared", "Private"))

    assert listing(db, manager, profile_id=[shared]) == ["manager on shared", "recruiter on shared"]
    assert listing(db, manager, profile_id=[private]) == ["recruiter on private"]
    assert listing(db, manager, profile_id=[shared, private]) == [
        "recruiter on private", "manager on shared", "recruiter on shared"]
    # a profile filter never widens what the user may see
    assert listing(db, recruiter, profile_id=[private]) == ["recruiter on private"]
    assert listing(db, make_user(db, "outsider"), profile_id=[shared]) == []


def test_date_range(db):
    manager, _, _ = seed(db)

    now = datetime.now(timezone.utc)
    assert listing(db, manager, created_from=now - timedelta(minutes=150)) == [
        "recruiter on private", "manager on shared"]
    assert listing(db, manager, created_to=now - timedelta(minutes=150)) == ["recruiter on shared"]


def test_list_counts_follow_the_list_but_counts_stay_mine(db):
    manager, _, _ = seed(db)

    status = queue_status(profile_id=None, created_from=None, created_to=None, current_user=manager, db=db)
    assert status["list_counts"] == {"failed": 3}
    assert status["counts"] == {"failed": 1}

    shared = db.query(Profile).filter_by(name="Shared").one().id
    status = queue_status(profile_id=[shared], created_from=None, created_to=None, current_user=manager, db=db)
    assert status["list_counts"] == {"failed": 2}


def test_other_peoples_tasks_are_view_only(db):
    manager, recruiter, _ = seed(db)
    theirs = db.query(QueueTask).filter_by(user_id=recruiter.id).first()

    with pytest.raises(HTTPException) as exc:
        delete_task(theirs.id, current_user=manager, db=db)
    assert exc.value.status_code == 404
