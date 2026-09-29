import hashlib
import json
import logging
import random
import re
import time
from sqlalchemy import select

from config import settings
from database import SessionLocal
from services import log_service
from services.providers import LLMResponse, call_provider, test_model_connection  # noqa: F401

logger = logging.getLogger(__name__)


def _jd_hash(text: str) -> str:
    return hashlib.md5(text.strip().lower().encode()).hexdigest()


# In-memory cache for extraction results (saves AI calls in batch mode).
# Keyed only by JD content hash, with no awareness of which model is
# currently assigned to a role — so it must be cleared whenever a role
# assignment changes, or a re-tested JD will silently return a stale
# result from whichever model served it before the reassignment.
_extraction_cache: dict[str, tuple] = {}
_CACHE_MAX_SIZE = 200


def clear_extraction_cache() -> None:
    _extraction_cache.clear()

from prompts import (
    COVER_LETTER as COVER_LETTER_SYSTEM_PROMPT,
    RESUME_COMBINED as COMBINED_CONTENT_SYSTEM_PROMPT,
    RESUME_TAILOR as RESUME_TAILOR_PROMPT,
)


def _get_active_model_config(role: str = "resume"):
    """Load whichever model is assigned to a role, via role_model_assignments.

    Args:
        role: "resume", "cover_letter", "jd_parse", "chat", or "utility".
              Every role except "resume" falls back to "resume" if unconfigured.
    """
    from models.ai_model_config import AIModelConfig
    from models.role_model_assignment import RoleModelAssignment

    def _lookup(db, for_role: str):
        return db.scalars(
            select(AIModelConfig)
            .join(
                RoleModelAssignment,
                RoleModelAssignment.ai_model_config_id == AIModelConfig.id,
            )
            .where(RoleModelAssignment.role == for_role)
        ).first()

    db = SessionLocal()
    try:
        config = _lookup(db, role)

        # Fallback: any non-resume role uses the resume model if unconfigured
        if not config and role != "resume":
            config = _lookup(db, "resume")

        if config:
            return {
                "id": config.id,
                "provider": config.provider,
                "model_id": config.model_id,
                "api_key": config.api_key,
                "endpoint": config.endpoint,
                "api_version": config.api_version,
                "input_price_per_1k": config.input_price_per_1k,
                "output_price_per_1k": config.output_price_per_1k,
            }
    finally:
        db.close()
    return None


def assign_key_for_job(model_config_id: str) -> tuple[str, str | None] | None:
    """Atomically claim the next pool key for a queue job (round-robin).

    Locks the AIModelConfig row, picks the active pool key at
    key_rotation_index % len(keys), increments the index, and commits.

    Returns (pool_key_id, label) or None if no active pool keys exist.
    """
    from models.api_key_pool import ApiKeyPool
    from models.ai_model_config import AIModelConfig

    db = SessionLocal()
    try:
        config = db.execute(
            select(AIModelConfig)
            .where(AIModelConfig.id == model_config_id)
            .with_for_update()
        ).scalar_one_or_none()

        if not config:
            return None

        keys = db.scalars(
            select(ApiKeyPool)
            .where(ApiKeyPool.model_config_id == model_config_id, ApiKeyPool.is_active == True)  # noqa: E712
            .order_by(ApiKeyPool.created_at.asc())
        ).all()

        if not keys:
            return None

        idx = config.key_rotation_index % len(keys)
        chosen = keys[idx]
        config.key_rotation_index += 1
        db.commit()
        return (chosen.id, chosen.label)
    except Exception:
        db.rollback()
        logger.exception("Failed to assign key for job from config %s", model_config_id)
        return None
    finally:
        db.close()



def _load_pool_keys(model_config_id: str) -> list[tuple[str, str]]:
    """Return active pool keys as (pool_key_id, api_key) in creation order."""
    from models.api_key_pool import ApiKeyPool
    db = SessionLocal()
    try:
        rows = db.execute(
            select(ApiKeyPool.id, ApiKeyPool.api_key)
            .where(
                ApiKeyPool.model_config_id == model_config_id,
                ApiKeyPool.is_active == True,  # noqa: E712
            )
            .order_by(ApiKeyPool.created_at.asc())
        ).all()
        return [(r[0], r[1]) for r in rows]
    finally:
        db.close()


def _is_key_error(exc: Exception) -> bool:
    """Return True if exc indicates an invalid/exhausted key (401 or 429)."""
    # Anthropic SDK exceptions
    try:
        import anthropic
        if isinstance(exc, (anthropic.AuthenticationError, anthropic.RateLimitError)):
            return True
    except ImportError:
        pass
    # httpx / requests HTTP status errors
    try:
        import httpx
        if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code in (401, 429):
            return True
    except ImportError:
        pass
    # Generic check on string representation
    msg = str(exc).lower()
    if "401" in msg or "429" in msg or "rate limit" in msg or "authentication" in msg or "invalid x-api-key" in msg:
        return True
    return False


def _call_llm(
    messages: list[dict],
    max_tokens: int = 1024,
    temperature: float = 0.7,
    tier: str = "resume",
    model_config_id: str | None = None,
    fixed_pool_key_id: str | None = None,
) -> LLMResponse:
    """Route to the correct provider based on active model config.

    Args:
        tier: "resume", "cover_letter", "jd_parse", "chat", or "utility".
        model_config_id: If provided, use this specific model config instead of tier lookup.
        fixed_pool_key_id: If provided (queue jobs), try this pool key first. On 401/429
            failover, try remaining pool keys in creation order, then config's own key.
            Without this (direct generate, batch), pool keys are shuffled randomly.

    Cost is computed immediately from the config that served the call.
    """
    if model_config_id:
        from models.ai_model_config import AIModelConfig
        db = SessionLocal()
        try:
            m = db.get(AIModelConfig, model_config_id)
            config = {
                "id": m.id,
                "provider": m.provider,
                "model_id": m.model_id,
                "api_key": m.api_key,
                "endpoint": m.endpoint,
                "api_version": m.api_version,
                "input_price_per_1k": m.input_price_per_1k,
                "output_price_per_1k": m.output_price_per_1k,
            } if m else None
        finally:
            db.close()
    else:
        config = _get_active_model_config(role=tier)

    if not config:
        # Fallback to env-var Azure config for backwards compatibility
        config = {
            "id": None,
            "provider": "azure_openai",
            "model_id": settings.azure_openai_deployment,
            "api_key": settings.azure_openai_api_key,
            "endpoint": settings.azure_openai_endpoint,
            "api_version": settings.azure_openai_api_version,
            "input_price_per_1k": settings.default_input_price_per_1k,
            "output_price_per_1k": settings.default_output_price_per_1k,
        }

    tools = None

    config_db_id = config.get("id")
    own_key = config["api_key"]

    # Build (pool_key_id_or_none, api_key) candidate list
    if fixed_pool_key_id and config_db_id:
        # Queue path: fixed key first, then remaining pool keys in creation order, own key last
        all_pool = _load_pool_keys(config_db_id)  # [(id, key), ...] ordered by created_at
        fixed_pair = next(((kid, k) for kid, k in all_pool if kid == fixed_pool_key_id), None)
        others = [(kid, k) for kid, k in all_pool if kid != fixed_pool_key_id]
        candidates: list[tuple[str | None, str]] = (
            ([fixed_pair] if fixed_pair else []) + others
        )
        if own_key not in (k for _, k in candidates):
            candidates.append((None, own_key))
    else:
        # Direct/batch path: random shuffle (original behaviour)
        pool_pairs = _load_pool_keys(config_db_id) if config_db_id else []
        random.shuffle(pool_pairs)
        candidates = pool_pairs
        if own_key not in (k for _, k in candidates):
            candidates.append((None, own_key))

    last_exc: Exception | None = None
    for attempt, (pool_key_id, api_key) in enumerate(candidates):
        attempt_config = {**config, "api_key": api_key}
        start = time.monotonic()
        try:
            result = call_provider(messages, max_tokens, temperature, attempt_config, tools=tools)
            result.cost = (
                result.prompt_tokens / 1000 * config["input_price_per_1k"]
                + result.completion_tokens / 1000 * config["output_price_per_1k"]
            )
            result.provider = config["provider"]
            result.model_id = config["model_id"]
            result.model_config_id = config_db_id
            result.input_price_per_1k = config["input_price_per_1k"]
            result.output_price_per_1k = config["output_price_per_1k"]
            result.used_pool_key_id = pool_key_id
            duration_ms = int((time.monotonic() - start) * 1000)
            log_service.log_bg(
                log_service.INFO, log_service.AI_CALL,
                f"LLM call succeeded · {config['provider']} / {config['model_id']}",
                details={
                    "provider": config["provider"],
                    "model_id": config["model_id"],
                    "tier": tier,
                    "prompt_tokens": result.prompt_tokens,
                    "completion_tokens": result.completion_tokens,
                    "cost": result.cost,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "key_pool_attempt": attempt + 1,
                    "pool_key_id": pool_key_id,
                },
                duration_ms=duration_ms,
            )
            return result
        except Exception as exc:
            duration_ms = int((time.monotonic() - start) * 1000)
            last_exc = exc
            if _is_key_error(exc) and attempt < len(candidates) - 1:
                logger.warning(
                    "API key attempt %d/%d failed (%s) — retrying with next key",
                    attempt + 1, len(candidates), type(exc).__name__,
                )
                if pool_key_id:
                    log_service.log_bg(
                        log_service.WARNING, log_service.AI_CALL,
                        f"Pool key {pool_key_id} returned 401/429 — failing over",
                        details={
                            "pool_key_id": pool_key_id,
                            "provider": config.get("provider"),
                            "model_id": config.get("model_id"),
                            "tier": tier,
                            "attempt": attempt + 1,
                        },
                        duration_ms=duration_ms,
                        **log_service.exc_to_log_kwargs(exc),
                    )
                continue
            log_service.log_bg(
                log_service.ERROR, log_service.AI_CALL,
                f"LLM call failed · {config.get('provider', '?')} / {config.get('model_id', '?')}",
                details={
                    "provider": config.get("provider"),
                    "model_id": config.get("model_id"),
                    "tier": tier,
                    "max_tokens": max_tokens,
                    "key_pool_attempt": attempt + 1,
                    "key_pool_size": len(candidates),
                    "pool_key_id": pool_key_id,
                },
                duration_ms=duration_ms,
                **log_service.exc_to_log_kwargs(exc),
            )
            raise

    raise last_exc  # type: ignore[misc]


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def _truncate_jd(job_description: str, max_chars: int = 4000) -> str:
    """Truncate job description to save input tokens.

    Keeps the first max_chars characters, which typically covers the
    job title, requirements, and qualifications sections.
    """
    if len(job_description) <= max_chars:
        return job_description
    return job_description[:max_chars] + "\n[...truncated]"


def _normalize_ai_text(text: str) -> str:
    """Replace smart/unicode characters with plain ASCII equivalents.

    AI models generate characters like em dashes and curly quotes that
    look unnatural in a human-written resume.
    """
    replacements = {
        "\u2014": "-",   # em dash — → -
        "\u2013": "-",   # en dash – → -
        "\u2018": "'",   # left single quote ' → '
        "\u2019": "'",   # right single quote ' → '
        "\u201C": '"',   # left double quote " → "
        "\u201D": '"',   # right double quote " → "
        "\u2026": "...", # ellipsis … → ...
        "\u00A0": " ",   # non-breaking space → regular space
        "\u200B": "",    # zero-width space → remove
        "\u2022": "-",   # bullet • → -
    }
    for char, replacement in replacements.items():
        text = text.replace(char, replacement)
    return text


def _format_experiences(experiences: list[dict]) -> str:
    """Format experiences for summary/cover letter context."""
    parts = []
    for exp in experiences:
        end = exp.get("end_date") or "Present"
        line = f"Company: {exp['company']} | Title: {exp['title']} | {exp['start_date']} to {end}"
        if exp.get("description"):
            line += f"\n  {exp['description']}"
        parts.append(line)
    return "\n".join(parts)


def detect_work_mode(job_description: str) -> str | None:
    """Detect if a job description mentions onsite, hybrid, or remote work.

    Simple keyword check only — no AI calls.
    """
    text = job_description.lower()
    if re.search(r"\bhybrid\b", text):
        return "hybrid"
    if re.search(r"\bon[- ]?site\b", text):
        return "onsite"
    # A mentioned location/region implies non-remote
    if re.search(r"\brelocation\b|\bmust be located\b|\brelocate\b", text):
        return "onsite"
    return None


def extract_job_location_with_usage(
    job_description: str,
) -> tuple[str, dict]:
    """Extract work mode from job description using simple keyword matching.

    Returns (work_mode, usage_dict). No AI calls — zero token cost.
    """
    cache_key = f"location:{_jd_hash(job_description)}"
    if cache_key in _extraction_cache:
        return _extraction_cache[cache_key]

    usage = {"prompt_tokens": 0, "completion_tokens": 0}
    text = job_description.lower()

    def _cache_and_return(location: str) -> tuple[str, dict]:
        result = (location, usage)
        _extraction_cache[cache_key] = result
        return result

    # Check hybrid first (most specific)
    if re.search(r"\bhybrid\b", text):
        return _cache_and_return("Hybrid")

    # Check onsite keywords
    if re.search(r"\bon[- ]?site\b", text):
        return _cache_and_return("Onsite")

    # Check remote
    if re.search(r"\bremote\b", text):
        return _cache_and_return("Remote")

    # Location/relocation mentioned implies non-remote
    if re.search(r"\brelocation\b|\bmust be located\b|\brelocate\b", text):
        return _cache_and_return("Onsite")

    return _cache_and_return("Not Mentioned")


def extract_jd_info(job_description: str) -> dict:
    """Extract salary range and required skills from a job description.

    Returns {"salary_range": str|None, "required_skills": list[str], "usage": dict}
    """
    from prompts import JD_EXTRACTION

    cache_key = f"jd_info:{_jd_hash(job_description)}"
    if cache_key in _extraction_cache:
        return _extraction_cache[cache_key]

    empty_usage = {"prompt_tokens": 0, "completion_tokens": 0, "cost": 0.0, "provider": "", "model_id": ""}
    fallback = {"salary_range": None, "required_skills": [], "usage": empty_usage}

    try:
        resp = _call_llm(
            messages=[
                {"role": "system", "content": JD_EXTRACTION},
                {"role": "user", "content": job_description},
            ],
            max_tokens=512,
            temperature=0.0,
            tier="jd_parse",
        )
    except Exception as exc:
        logger.warning("JD info extraction call failed: %s", exc)
        _extraction_cache[cache_key] = fallback
        return fallback

    # The call already succeeded and was billed — keep its usage/cost even
    # if the response turns out not to be parseable JSON below.
    usage = {
        "prompt_tokens": resp.prompt_tokens,
        "completion_tokens": resp.completion_tokens,
        "cost": resp.cost,
        "provider": resp.provider,
        "model_id": resp.model_id,
        "model_config_id": resp.model_config_id,
        "input_price_per_1k": resp.input_price_per_1k,
        "output_price_per_1k": resp.output_price_per_1k,
    }
    try:
        import json as _json
        raw = resp.content.strip()
        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        data = _json.loads(raw)
        result = {
            "salary_range": data.get("salary_range") or None,
            "required_skills": data.get("required_skills") or [],
            "usage": usage,
        }
    except Exception as exc:
        logger.warning("JD info extraction parse failed: %s", exc)
        result = {"salary_range": None, "required_skills": [], "usage": usage}

    _extraction_cache[cache_key] = result
    if len(_extraction_cache) > _CACHE_MAX_SIZE:
        keys = list(_extraction_cache.keys())
        for k in keys[: len(keys) - _CACHE_MAX_SIZE]:
            _extraction_cache.pop(k, None)
    return result


def _effective_temperature(creativity_factor: float) -> float:
    return round(0.4 + max(0.0, min(1.0, creativity_factor)) * 0.6, 3)


def _style_hint(creativity_factor: float) -> str:
    if creativity_factor <= 0.33:
        return "concise, direct, and data-driven"
    elif creativity_factor <= 0.66:
        return "balanced and professional"
    else:
        return "expressive, narrative-driven, and storytelling"


def generate_resume_content(
    user_name: str,
    email: str | None,
    phone: str | None,
    experiences: list[dict],
    job_description: str,
    job_title: str,
    company: str | None = None,
    knowledge_base: str | None = None,
    creativity_factor: float = 0.3,
    profile_id: str | None = None,
    pool_key_id: str | None = None,
) -> tuple[dict, dict]:
    """Generate summary and skills in a single LLM call.

    Returns (content_dict, usage_dict) where content_dict has keys:
    "summary" (str), "skills" (list[dict]).
    """
    formatted_exp = _format_experiences(experiences)
    company_str = company or "the company"

    kb_section = ""
    if knowledge_base:
        kb_section = f"""

## Knowledge Base Guidelines (MUST FOLLOW)
{knowledge_base}
"""

    jd_trimmed = _truncate_jd(job_description)

    style = _style_hint(creativity_factor)
    temperature = _effective_temperature(creativity_factor)

    user_prompt = f"""## Candidate Info
Name: {user_name}
Email: {email or "N/A"}
Phone: {phone or "N/A"}

## Candidate Experience
{formatted_exp}

## Target Position
Title: {job_title} at {company_str}

## Job Description
{jd_trimmed}
{kb_section}
## Writing Style
Use a {style} writing style throughout.

Generate the summary, skills, and cover letter as a single JSON object."""

    total_usage = {
        "prompt_tokens": 0, "completion_tokens": 0, "cost": 0.0,
        "provider": "", "model_id": "", "model_config_id": None,
        "input_price_per_1k": 0.0, "output_price_per_1k": 0.0,
        "used_pool_key_id": None,
    }

    for attempt in range(3):
        resp = _call_llm(
            messages=[
                {"role": "system", "content": COMBINED_CONTENT_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=8192,
            temperature=temperature,
            tier="resume",
            fixed_pool_key_id=pool_key_id,
        )

        total_usage["prompt_tokens"] += resp.prompt_tokens
        total_usage["completion_tokens"] += resp.completion_tokens
        total_usage["cost"] += resp.cost
        total_usage["provider"] = resp.provider
        total_usage["model_id"] = resp.model_id
        total_usage["model_config_id"] = resp.model_config_id
        total_usage["input_price_per_1k"] = resp.input_price_per_1k
        total_usage["output_price_per_1k"] = resp.output_price_per_1k
        if resp.used_pool_key_id is not None:
            total_usage["used_pool_key_id"] = resp.used_pool_key_id

        content = resp.content
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\s*\n?", "", content)
            content = re.sub(r"\n?```\s*$", "", content)
        content = content.strip()
        if not content:
            if attempt < 2:
                logger.warning("Empty LLM response on attempt %d, retrying", attempt + 1)
                continue
            raise RuntimeError("LLM returned empty response after 3 attempts")
        try:
            result = json.loads(content)
            if not isinstance(result, dict):
                raise ValueError("Expected a JSON object")
            if "summary" not in result:
                raise ValueError("Missing required key: summary")
            if "skills" not in result:
                result["skills"] = []
            result["summary"] = _normalize_ai_text(result["summary"])
            for cat in result["skills"]:
                cat["skills"] = [_normalize_ai_text(s) for s in cat.get("skills", [])]
            return result, total_usage
        except (json.JSONDecodeError, ValueError) as e:
            if attempt < 2:
                logger.warning(
                    "Combined content JSON parse failed on attempt %d, retrying: %s", attempt + 1, e
                )
                user_prompt = (
                    f"Your previous response was not valid JSON. "
                    f"Please respond with valid JSON only.\n\n{user_prompt}"
                )
            else:
                logger.error("Combined content JSON parse failed on attempt 3: %s", e)
                raise RuntimeError(
                    f"Failed to parse AI combined response: {e}"
                ) from e


def tailor_resume(
    user_name: str,
    experiences: list[dict],
    job_description: str,
    job_title: str,
    company: str | None = None,
    required_skills: list[str] | None = None,
    knowledge_base: str | None = None,
    creativity_factor: float = 0.3,
    profile_id: str | None = None,
    pool_key_id: str | None = None,
) -> tuple[list[dict], dict]:
    """Generate tailored resume bullets for all experiences in one LLM call."""
    total_usage: dict = {
        "prompt_tokens": 0, "completion_tokens": 0, "cost": 0.0,
        "provider": "", "model_id": "", "model_config_id": None,
        "input_price_per_1k": 0.0, "output_price_per_1k": 0.0,
        "used_pool_key_id": None,
    }

    if not experiences:
        return [], total_usage

    company_str = company or "the target company"
    skills_section = ""
    if required_skills:
        skills_section = "\n\nRequired skills to weave in: " + ", ".join(required_skills)

    kb_section = ""
    if knowledge_base:
        kb_section = f"\n\n## Knowledge Base Guidelines (MUST FOLLOW)\n{knowledge_base}"

    jd_trimmed = _truncate_jd(job_description)
    style = _style_hint(creativity_factor)
    temperature = _effective_temperature(creativity_factor)

    exp_lines = []
    for exp in experiences:
        end = exp.get("end_date") or "Present"
        lines = [f"- Company: {exp['company']} | Title: {exp['title']} | {exp['start_date']} to {end}"]
        if exp.get("description"):
            lines.append(f"  Description: {exp['description']}")
        exp_lines.append("\n".join(lines))
    experiences_str = "\n".join(exp_lines)

    user_prompt = (
        f"## Candidate Experiences\n{experiences_str}\n\n"
        f"## Target Job\n"
        f"Applying for: {job_title} at {company_str}\n\n"
        f"## Job Description\n"
        f"{jd_trimmed}{skills_section}{kb_section}\n\n"
        f"## Writing Style\n"
        f"Use a {style} writing style for the bullet points."
    )

    for attempt in range(3):
        resp = _call_llm(
            messages=[
                {"role": "system", "content": RESUME_TAILOR_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=4096,
            temperature=temperature,
            tier="resume",
            fixed_pool_key_id=pool_key_id,
        )

        total_usage["prompt_tokens"] += resp.prompt_tokens
        total_usage["completion_tokens"] += resp.completion_tokens
        total_usage["cost"] += resp.cost
        total_usage["provider"] = resp.provider
        total_usage["model_id"] = resp.model_id
        total_usage["model_config_id"] = resp.model_config_id
        total_usage["input_price_per_1k"] = resp.input_price_per_1k
        total_usage["output_price_per_1k"] = resp.output_price_per_1k
        if resp.used_pool_key_id is not None:
            total_usage["used_pool_key_id"] = resp.used_pool_key_id

        content = resp.content
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\s*\n?", "", content)
            content = re.sub(r"\n?```\s*$", "", content)
        content = content.strip()

        if not content:
            if attempt < 2:
                logger.warning("Empty LLM response on attempt %d, retrying", attempt + 1)
                continue
            raise RuntimeError("LLM returned empty response after 3 attempts")

        try:
            result = json.loads(content)
            if not isinstance(result, list):
                raise ValueError("Expected a JSON array")
            for exp in result:
                exp["bullets"] = [_normalize_ai_text(b) for b in exp.get("bullets", [])]
            return result, total_usage
        except (json.JSONDecodeError, ValueError) as e:
            if attempt < 2:
                logger.warning("Tailor resume JSON parse failed attempt %d: %s — retrying", attempt + 1, e)
                user_prompt = f"Your previous response was not valid JSON. Respond with valid JSON only.\n\n{user_prompt}"
            else:
                raise RuntimeError(f"Failed to parse AI response: {e}") from e

    raise RuntimeError("tailor_resume: exhausted retries")


def generate_cover_letter(
    user_name: str,
    email: str | None,
    phone: str | None,
    experiences: list[dict],
    job_description: str,
    job_title: str,
    company: str | None = None,
    knowledge_base: str | None = None,
    creativity_factor: float = 0.3,
    pool_key_id: str | None = None,
) -> tuple[str, dict]:
    """Call LLM to generate a cover letter."""
    formatted_exp = _format_experiences(experiences)
    company_str = company or "the company"
    jd_trimmed = _truncate_jd(job_description)
    temperature = _effective_temperature(creativity_factor)

    kb_section = ""
    if knowledge_base:
        kb_section = f"\n\n## Knowledge Base Guidelines (MUST FOLLOW)\n{knowledge_base}"

    user_prompt = f"""## Candidate Info
Name: {user_name}
Email: {email or "N/A"}
Phone: {phone or "N/A"}

## Candidate Experience
{formatted_exp}

## Target Position
Title: {job_title} at {company_str}

## Job Description
{jd_trimmed}{kb_section}

Write the cover letter body only (Dear Hiring Manager through sign-off)."""

    resp = _call_llm(
        messages=[
            {"role": "system", "content": COVER_LETTER_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=2048,
        temperature=temperature,
        tier="cover_letter",
        fixed_pool_key_id=pool_key_id,
    )

    usage = {
        "prompt_tokens": resp.prompt_tokens,
        "completion_tokens": resp.completion_tokens,
        "cost": resp.cost,
        "provider": resp.provider,
        "model_id": resp.model_id,
        "model_config_id": resp.model_config_id,
        "input_price_per_1k": resp.input_price_per_1k,
        "output_price_per_1k": resp.output_price_per_1k,
        "used_pool_key_id": resp.used_pool_key_id,
    }
    return _normalize_ai_text(resp.content), usage
