import pytest

from database import Base, SessionLocal, engine
from models.ai_model_config import AIModelConfig
from models.api_key_pool import ApiKeyPool
from models.queue import QueueTask
from models.user import User
from services.ai_service import assign_key_for_job


@pytest.fixture()
def db():
    tables = [t.__table__ for t in (User, AIModelConfig, ApiKeyPool, QueueTask)]
    Base.metadata.drop_all(engine, tables=tables)
    Base.metadata.create_all(engine, tables=tables)
    session = SessionLocal()
    yield session
    session.close()


def seed(db, key_count=3, tasks=5):
    user = User(username="bidder1", hashed_password="x", role="bidder", status="approved")
    config = AIModelConfig(provider="anthropic", display_name="m", model_id="m", api_key="k")
    db.add_all([user, config])
    db.flush()
    keys = [ApiKeyPool(model_config_id=config.id, api_key=f"k{i}", label=f"key{i}") for i in range(key_count)]
    db.add_all(keys)
    queued = [QueueTask(user_id=user.id, status="processing", order=i) for i in range(tasks)]
    db.add_all(queued)
    db.commit()
    return config, keys, queued


def test_parallel_tasks_get_different_keys_until_the_pool_runs_out(db):
    config, keys, tasks = seed(db, key_count=3, tasks=5)

    used = [assign_key_for_job(config.id, t.id)[0] for t in tasks[:3]]
    assert sorted(used) == sorted(k.id for k in keys)  # three tasks, three distinct keys

    # a fourth in-flight task has to share, and the choice is recorded on the task
    shared = assign_key_for_job(config.id, tasks[3].id)[0]
    assert shared in used
    db.refresh(tasks[3])
    assert tasks[3].used_api_key_pool_id == shared


def test_a_finished_tasks_key_is_free_again(db):
    config, keys, tasks = seed(db, key_count=2, tasks=3)
    first = assign_key_for_job(config.id, tasks[0].id)[0]
    second = assign_key_for_job(config.id, tasks[1].id)[0]
    assert first != second

    tasks[0].status = "completed"
    db.commit()
    assert assign_key_for_job(config.id, tasks[2].id)[0] == first


def test_without_a_task_id_it_still_rotates(db):
    config, keys, _ = seed(db, key_count=2, tasks=0)
    picks = [assign_key_for_job(config.id)[0] for _ in range(4)]
    assert picks[0] != picks[1] and picks[:2] == picks[2:]
