import httpx
import pytest

from services import ai_service
from services.ai_service import RateLimitExceeded, _call_llm, _retry_delay


def http_error(status, retry_after=None):
    headers = {"retry-after": str(retry_after)} if retry_after is not None else {}
    request = httpx.Request("POST", "https://api.example.test/messages")
    response = httpx.Response(status, headers=headers, request=request)
    return httpx.HTTPStatusError(f"{status}", request=request, response=response)


def test_retry_delay_uses_retry_after_and_caps_it(monkeypatch):
    monkeypatch.setattr(ai_service.random, "uniform", lambda a, b: 1.0)
    assert _retry_delay(http_error(429, retry_after=12), 0) == 12
    assert _retry_delay(http_error(429, retry_after=999), 0) == ai_service.settings.llm_rate_limit_max_wait


def test_retry_delay_backs_off_without_retry_after(monkeypatch):
    monkeypatch.setattr(ai_service.random, "uniform", lambda a, b: 1.0)
    assert [_retry_delay(http_error(429), n) for n in range(4)] == [5, 10, 20, 40]
    assert _retry_delay(http_error(529), 0) == 5  # overloaded is retried too


def test_retry_delay_ignores_other_errors():
    assert _retry_delay(http_error(401), 0) is None
    assert _retry_delay(http_error(500), 0) is None
    assert _retry_delay(ValueError("boom"), 0) is None


@pytest.fixture()
def llm(monkeypatch):
    """_call_llm with two pool keys, no real provider and no real sleeping."""
    sleeps = []
    monkeypatch.setattr(ai_service.time, "sleep", sleeps.append)
    monkeypatch.setattr(ai_service.random, "uniform", lambda a, b: 1.0)
    monkeypatch.setattr(ai_service, "_get_active_model_config", lambda role: {
        "id": "cfg", "provider": "anthropic", "model_id": "m", "api_key": "own",
        "endpoint": None, "api_version": None,
        "input_price_per_1k": 0.0, "output_price_per_1k": 0.0,
    })
    monkeypatch.setattr(ai_service, "_load_pool_keys", lambda cid: [("k1", "key1"), ("k2", "key2")])
    monkeypatch.setattr(ai_service.log_service, "log_bg", lambda *a, **k: None)
    return sleeps


def script(monkeypatch, outcomes):
    """Make each provider call return or raise the next outcome; record the keys used."""
    keys = []
    queue = list(outcomes)

    def fake(messages, max_tokens, temperature, config, tools=None):
        keys.append(config["api_key"])
        outcome = queue.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return ai_service.LLMResponse(content=outcome, prompt_tokens=1, completion_tokens=1)

    monkeypatch.setattr(ai_service, "call_provider", fake)
    return keys


def test_waits_and_retries_when_every_key_is_rate_limited(llm, monkeypatch):
    # keys: k1, k2, own are all limited, then the second round works
    keys = script(monkeypatch, [http_error(429, 7)] * 3 + ["ok"])
    result = _call_llm([{"role": "user", "content": "hi"}], fixed_pool_key_id="k1")
    assert result.content == "ok"
    assert llm == [7]  # one wait, as long as the API asked for
    assert len(keys) == 4


def test_gives_up_with_rate_limit_exceeded_after_the_retries(llm, monkeypatch):
    retries = ai_service.settings.llm_rate_limit_retries
    keys = script(monkeypatch, [http_error(429)] * (3 * (retries + 1)))
    with pytest.raises(RateLimitExceeded):
        _call_llm([{"role": "user", "content": "hi"}], fixed_pool_key_id="k1")
    assert len(llm) == retries  # slept between each round, not after the last
    assert llm == sorted(llm)  # waits grow


def test_a_bad_key_still_just_fails_over_without_waiting(llm, monkeypatch):
    script(monkeypatch, [http_error(401), "ok"])
    assert _call_llm([{"role": "user", "content": "hi"}], fixed_pool_key_id="k1").content == "ok"
    assert llm == []


def test_other_errors_are_not_retried(llm, monkeypatch):
    script(monkeypatch, [ValueError("bad request")])
    with pytest.raises(ValueError):
        _call_llm([{"role": "user", "content": "hi"}], fixed_pool_key_id="k1")
    assert llm == []


def test_queue_worker_requeues_a_rate_limited_task_and_pauses(monkeypatch):
    import asyncio

    from database import Base, SessionLocal, engine
    from models.profile import Profile
    from models.queue import QueueTask
    from models.user import User
    from routers import generate
    from services import queue_worker

    tables = [t.__table__ for t in (User, Profile, QueueTask)]
    Base.metadata.drop_all(engine, tables=tables)
    Base.metadata.create_all(engine, tables=tables)
    db = SessionLocal()
    user = User(username="bidder1", hashed_password="x", role="bidder", status="approved")
    db.add(user)
    db.flush()
    profile = Profile(owner_id=user.id, name="Aaron")
    db.add(profile)
    db.flush()
    task = QueueTask(user_id=user.id, profile_id=profile.id, profile_name="Aaron", status="processing",
                     order=1, company="Acme", job_title="Engineer", job_description="x",
                     used_api_key_pool_id="k1")
    db.add(task)
    db.commit()
    task_id = task.id

    async def limited(**kwargs):
        raise RateLimitExceeded("still limited")

    monkeypatch.setattr(queue_worker, "_run_pre_checks", lambda tid: [])
    monkeypatch.setattr(queue_worker, "_get_resume_model_config_id", lambda: None)
    monkeypatch.setattr(generate, "_generate_single", limited)
    monkeypatch.setattr(queue_worker, "_paused_until", 0.0)

    asyncio.run(queue_worker._process_task(task_id))

    db.expire_all()
    task = db.get(QueueTask, task_id)
    assert task.status == "queued"  # not failed
    assert task.error is None and task.started_at is None
    assert queue_worker._paused_until > queue_worker.time.monotonic()
    db.close()
