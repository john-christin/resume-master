import hashlib
import json
import logging
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
    RESUME_TAILOR as RESUME_SYSTEM_PROMPT,
)


def _get_active_model_config(role: str = "resume", profile_id: str | None = None):
    """Load whichever model is assigned to a role, via role_model_assignments.

    Args:
        role: "resume" for resume tailoring/content (quality-critical),
              "cover_letter" for cover letter generation,
              "jd_parse" for job-description extraction,
              "chat" for interview-prep chat,
              "utility" for miscellaneous cheap tasks.
              Every role except "resume" falls back to "resume" if
              unconfigured, so nothing breaks before an admin sets up the
              new roles. The same model can be assigned to multiple roles
              at once (that's the whole point of the mapping table).
        profile_id: If given and role == "resume", and the profile has its
              own Microsoft Foundry-hosted Claude key attached, that key is
              used instead of the global role assignment — the profile's
              own Azure resource is billed rather than the shared platform
              key. Falls through to the global assignment otherwise.
    """
    from models.ai_model_config import AIModelConfig
    from models.profile import Profile
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
        if profile_id and role == "resume":
            profile = db.get(Profile, profile_id)
            if profile and profile.foundry_api_key:
                return {
                    "id": None,
                    "provider": "anthropic",
                    "model_id": profile.foundry_model_id,
                    "api_key": profile.foundry_api_key,
                    "endpoint": profile.foundry_endpoint,
                    "api_version": None,
                    "input_price_per_1k": 0.0,
                    "output_price_per_1k": 0.0,
                }

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


# Server-side web search tool — only meaningful for Anthropic-family
# providers; other providers' call_*() functions accept and ignore `tools`.
_WEB_SEARCH_TOOLS = [{"type": "web_search_20260209", "name": "web_search"}]


def _call_llm(
    messages: list[dict],
    max_tokens: int = 1024,
    temperature: float = 0.7,
    tier: str = "resume",
    model_config_id: str | None = None,
    profile_id: str | None = None,
) -> LLMResponse:
    """Route to the correct provider based on active model config.

    Args:
        tier: "resume" (tailoring + summary/skills), "cover_letter",
              "jd_parse" (JD extraction), "chat" (interview prep),
              or "utility" (misc cheap tasks).
        model_config_id: If provided, use this specific model config instead of tier lookup.
        profile_id: Threaded to _get_active_model_config for the per-profile
              Foundry-key override (see there). Ignored when model_config_id
              is given — an explicit model choice always wins.

    Cost is computed here, immediately, from the same config that served
    the call — not re-derived later from a separately-fetched "current
    active model" price, which could reflect a different model than the
    one that actually ran if the active config changed in between.
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
        config = _get_active_model_config(role=tier, profile_id=profile_id)

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

    tools = _WEB_SEARCH_TOOLS if tier == "resume" and config["provider"] == "anthropic" else None

    start = time.monotonic()
    try:
        result = call_provider(messages, max_tokens, temperature, config, tools=tools)
        result.cost = (
            result.prompt_tokens / 1000 * config["input_price_per_1k"]
            + result.completion_tokens / 1000 * config["output_price_per_1k"]
        )
        result.provider = config["provider"]
        result.model_id = config["model_id"]
        result.model_config_id = config.get("id")
        result.input_price_per_1k = config["input_price_per_1k"]
        result.output_price_per_1k = config["output_price_per_1k"]
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
            },
            duration_ms=duration_ms,
        )
        return result
    except Exception as exc:
        duration_ms = int((time.monotonic() - start) * 1000)
        log_service.log_bg(
            log_service.ERROR, log_service.AI_CALL,
            f"LLM call failed · {config.get('provider', '?')} / {config.get('model_id', '?')}",
            details={
                "provider": config.get("provider"),
                "model_id": config.get("model_id"),
                "tier": tier,
                "max_tokens": max_tokens,
            },
            duration_ms=duration_ms,
            **log_service.exc_to_log_kwargs(exc),
        )
        raise


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
    """Format company/title/dates only — candidates no longer author bullets."""
    parts = []
    for exp in experiences:
        end = exp.get("end_date") or "Present"
        parts.append(
            f"Company: {exp['company']} | Title: {exp['title']} | {exp['start_date']} to {end}"
        )
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
    }

    for attempt in range(2):
        resp = _call_llm(
            messages=[
                {"role": "system", "content": COMBINED_CONTENT_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=8192,
            temperature=temperature,
            tier="resume",
            profile_id=profile_id,
        )

        total_usage["prompt_tokens"] += resp.prompt_tokens
        total_usage["completion_tokens"] += resp.completion_tokens
        total_usage["cost"] += resp.cost
        total_usage["provider"] = resp.provider
        total_usage["model_id"] = resp.model_id
        total_usage["model_config_id"] = resp.model_config_id
        total_usage["input_price_per_1k"] = resp.input_price_per_1k
        total_usage["output_price_per_1k"] = resp.output_price_per_1k

        content = resp.content
        # Strip markdown code fences if present
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\s*\n?", "", content)
            content = re.sub(r"\n?```\s*$", "", content)
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
            if attempt == 0:
                logger.warning(
                    "Combined content JSON parse failed on attempt 1, retrying: %s", e
                )
                user_prompt = (
                    f"Your previous response was not valid JSON. "
                    f"Please respond with valid JSON only.\n\n{user_prompt}"
                )
            else:
                logger.error("Combined content JSON parse failed on attempt 2: %s", e)
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
) -> tuple[list[dict], dict]:
    """Call LLM to research each employer via web search and write grounded resume bullets.

    Candidates no longer author bullets themselves — `experiences` carries
    only company/title/dates, and the model researches each employer (via
    the web_search tool enabled in _call_llm for the "resume" tier) to write
    bullets grounded in real, plausible work rather than reworded boilerplate.
    """
    formatted_exp = _format_experiences(experiences)
    company_str = company or "the company"

    skills_section = ""
    if required_skills:
        skills_section = (
            "\n\n## Job Description Required Skills\n" + ", ".join(required_skills)
        )

    kb_section = ""
    if knowledge_base:
        kb_section = f"""

## Knowledge Base Guidelines (MUST FOLLOW)
{knowledge_base}
"""

    jd_trimmed = _truncate_jd(job_description)
    style = _style_hint(creativity_factor)
    temperature = _effective_temperature(creativity_factor)

    user_prompt = f"""## Candidate's Work History (company, title, dates only — no prior bullets)
{formatted_exp}

## Target Job Description
Title: {job_title} at {company_str}
{jd_trimmed}{skills_section}
{kb_section}
## Writing Style
Use a {style} writing style for the bullet points.

## Required Output Format
[
  {{
    "company": "...",
    "location": "...",
    "title": "...",
    "start_date": "...",
    "end_date": "...",
    "bullets": ["bullet 1", "bullet 2"]
  }}
]"""

    total_usage = {
        "prompt_tokens": 0, "completion_tokens": 0, "cost": 0.0,
        "provider": "", "model_id": "", "model_config_id": None,
        "input_price_per_1k": 0.0, "output_price_per_1k": 0.0,
    }

    for attempt in range(2):
        resp = _call_llm(
            messages=[
                {"role": "system", "content": RESUME_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=8192,
            temperature=temperature,
            tier="resume",
            profile_id=profile_id,
        )

        total_usage["prompt_tokens"] += resp.prompt_tokens
        total_usage["completion_tokens"] += resp.completion_tokens
        total_usage["cost"] += resp.cost
        total_usage["provider"] = resp.provider
        total_usage["model_id"] = resp.model_id
        total_usage["model_config_id"] = resp.model_config_id
        total_usage["input_price_per_1k"] = resp.input_price_per_1k
        total_usage["output_price_per_1k"] = resp.output_price_per_1k

        content = resp.content
        # Strip markdown code fences if present
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\s*\n?", "", content)
            content = re.sub(r"\n?```\s*$", "", content)
        try:
            result = json.loads(content)
            if not isinstance(result, list):
                raise ValueError("Expected a JSON array")
            required = {"company", "title", "start_date"}
            invalid = [e for e in result if not required.issubset(e.keys())]
            if invalid:
                raise ValueError(
                    f"Experience objects missing required keys: {invalid[0]}"
                )
            for exp in result:
                exp["bullets"] = [
                    _normalize_ai_text(b) for b in exp.get("bullets", [])
                ]
            return result, total_usage
        except (json.JSONDecodeError, ValueError) as e:
            if attempt == 0:
                logger.warning(
                    "JSON parse failed on attempt 1, retrying: %s", e
                )
                user_prompt = (
                    f"Your previous response was not valid JSON or had wrong structure. "
                    f"Please respond with valid JSON only.\n\n{user_prompt}"
                )
            else:
                logger.error("JSON parse failed on attempt 2: %s", e)
                raise RuntimeError(
                    f"Failed to parse AI response: {e}"
                ) from e


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
    }
    return _normalize_ai_text(resp.content), usage
