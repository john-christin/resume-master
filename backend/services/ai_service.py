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


# In-memory cache for extraction results (saves AI calls in batch mode)
_extraction_cache: dict[str, tuple] = {}
_CACHE_MAX_SIZE = 200

from prompts import (
    COVER_LETTER as COVER_LETTER_SYSTEM_PROMPT,
    DUPLICATE_JOB_CHECK,
    RESUME_COMBINED as COMBINED_CONTENT_SYSTEM_PROMPT,
    RESUME_SKILLS as SKILLS_SYSTEM_PROMPT,
    RESUME_SUMMARY as SUMMARY_SYSTEM_PROMPT,
    RESUME_TAILOR as RESUME_SYSTEM_PROMPT,
)


def _get_active_model_config(role: str = "primary"):
    """Load an AI model config from DB by role.

    Args:
        role: "primary" for quality-critical tasks,
              "utility" for cheap extraction tasks.
              Falls back to primary if no utility model is configured.
    """
    from models.ai_model_config import AIModelConfig

    db = SessionLocal()
    try:
        # Try to find model with the requested role
        config = db.scalars(
            select(AIModelConfig).where(
                AIModelConfig.is_active.is_(True),
                AIModelConfig.role == role,
            )
        ).first()

        # Fallback: if no utility model, use primary
        if not config and role == "utility":
            config = db.scalars(
                select(AIModelConfig).where(
                    AIModelConfig.is_active.is_(True),
                    AIModelConfig.role == "primary",
                )
            ).first()

        # Legacy fallback: active model without role set
        if not config:
            config = db.scalars(
                select(AIModelConfig).where(AIModelConfig.is_active.is_(True))
            ).first()

        if config:
            return {
                "provider": config.provider,
                "model_id": config.model_id,
                "api_key": config.api_key,
                "endpoint": config.endpoint,
                "api_version": config.api_version,
            }
    finally:
        db.close()
    return None


def _call_llm(
    messages: list[dict],
    max_tokens: int = 1024,
    temperature: float = 0.7,
    tier: str = "primary",
    model_config_id: str | None = None,
) -> LLMResponse:
    """Route to the correct provider based on active model config.

    Args:
        tier: "primary" for quality-critical tasks (resume tailoring,
              summary, skills, cover letter), "utility" for cheap
              extraction tasks (company name, location, duplicate check).
        model_config_id: If provided, use this specific model config instead of tier lookup.
    """
    if model_config_id:
        from models.ai_model_config import AIModelConfig
        db = SessionLocal()
        try:
            m = db.get(AIModelConfig, model_config_id)
            config = {
                "provider": m.provider,
                "model_id": m.model_id,
                "api_key": m.api_key,
                "endpoint": m.endpoint,
                "api_version": m.api_version,
            } if m else None
        finally:
            db.close()
    else:
        config = _get_active_model_config(role=tier)

    if not config:
        # Fallback to env-var Azure config for backwards compatibility
        config = {
            "provider": "azure_openai",
            "model_id": settings.azure_openai_deployment,
            "api_key": settings.azure_openai_api_key,
            "endpoint": settings.azure_openai_endpoint,
            "api_version": settings.azure_openai_api_version,
        }

    start = time.monotonic()
    try:
        result = call_provider(messages, max_tokens, temperature, config)
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
    parts = []
    for exp in experiences:
        end = exp.get("end_date") or "Present"
        location = exp.get("location") or ""
        header = f"Company: {exp['company']}"
        if location:
            header += f", {location}"
        header += f" | Title: {exp['title']} | {exp['start_date']} to {end}"
        bullets = "\n".join(
            f"- {line.strip()}"
            for line in exp["description"].split("\n")
            if line.strip()
        )
        parts.append(f"{header}\n{bullets}")
    return "\n\n".join(parts)


def text_similarity(text1: str, text2: str) -> float:
    """Compute Jaccard similarity on word sets (0.0 to 1.0)."""
    words1 = set(re.findall(r"\w+", text1.lower()))
    words2 = set(re.findall(r"\w+", text2.lower()))
    if not words1 or not words2:
        return 0.0
    intersection = words1 & words2
    union = words1 | words2
    return len(intersection) / len(union)


def ai_check_same_role(jd1: str, jd2: str) -> tuple[bool, dict]:
    """Use AI to determine if two job descriptions are for the same role.

    Returns (is_same_role, usage_dict).
    """
    usage = {"prompt_tokens": 0, "completion_tokens": 0}
    try:
        resp = _call_llm(
            messages=[
                {"role": "system", "content": DUPLICATE_JOB_CHECK},
                {
                    "role": "user",
                    "content": f"## Job Description 1\n{jd1[:1500]}\n\n## Job Description 2\n{jd2[:1500]}",
                },
            ],
            max_tokens=10,
            temperature=0.0,
            tier="utility",
        )
        usage = {
            "prompt_tokens": resp.prompt_tokens,
            "completion_tokens": resp.completion_tokens,
        }
        return resp.content.upper() == "SAME", usage
    except Exception as exc:
        logger.warning("AI duplicate check failed", exc_info=True)
        log_service.log_bg(
            log_service.WARNING, log_service.AI_CALL,
            "AI duplicate check failed — returning False",
            **log_service.exc_to_log_kwargs(exc),
        )
        return False, usage


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


def extract_company_name(job_description: str) -> str | None:
    """Try to extract company name from job description."""
    patterns = [
        r"(?:About|Join)\s+([A-Z][A-Za-z0-9\s&.,'-]{1,50}?)(?:\s*[\n\r]|\s+is\b|\s+—|\s+-)",
        r"([A-Z][A-Za-z0-9\s&.,'-]{1,50}?)\s+is\s+(?:seeking|hiring|looking|a\s+leading|a\s+global|an?\s+)",
        r"Company:\s*([^\n]{2,50})",
        r"(?:at|@)\s+([A-Z][A-Za-z0-9\s&.,'-]{1,50}?)(?:\.|,|\n|$)",
    ]

    for pattern in patterns:
        match = re.search(pattern, job_description)
        if match:
            name = match.group(1).strip().rstrip(".,")
            if 2 <= len(name) <= 50 and name.lower() not in {
                "the company",
                "our company",
                "we",
                "our",
            }:
                return name

    # AI fallback
    try:
        resp = _call_llm(
            messages=[
                {
                    "role": "system",
                    "content": "Extract the company name from the job description. "
                    "Reply with ONLY the company name, nothing else. "
                    "If you cannot determine the company name, reply with UNKNOWN.",
                },
                {"role": "user", "content": job_description[:2000]},
            ],
            max_tokens=50,
            temperature=0.0,
            tier="utility",
        )
        result = resp.content
        if result and result.upper() != "UNKNOWN":
            return result
    except Exception as exc:
        logger.warning("Company extraction AI call failed", exc_info=True)
        log_service.log_bg(
            log_service.WARNING, log_service.AI_CALL,
            "Company extraction AI call failed — returning None",
            **log_service.exc_to_log_kwargs(exc),
        )

    return None


def extract_company_name_with_usage(
    job_description: str,
) -> tuple[str | None, dict]:
    """Extract company name, returning (name, usage_dict)."""
    cache_key = f"company:{_jd_hash(job_description)}"
    if cache_key in _extraction_cache:
        return _extraction_cache[cache_key]

    usage = {"prompt_tokens": 0, "completion_tokens": 0}

    patterns = [
        r"(?:About|Join)\s+([A-Z][A-Za-z0-9\s&.,'-]{1,50}?)(?:\s*[\n\r]|\s+is\b|\s+—|\s+-)",
        r"([A-Z][A-Za-z0-9\s&.,'-]{1,50}?)\s+is\s+(?:seeking|hiring|looking|a\s+leading|a\s+global|an?\s+)",
        r"Company:\s*([^\n]{2,50})",
        r"(?:at|@)\s+([A-Z][A-Za-z0-9\s&.,'-]{1,50}?)(?:\.|,|\n|$)",
    ]

    for pattern in patterns:
        match = re.search(pattern, job_description)
        if match:
            name = match.group(1).strip().rstrip(".,")
            if 2 <= len(name) <= 50 and name.lower() not in {
                "the company",
                "our company",
                "we",
                "our",
            }:
                result = (name, usage)
                _extraction_cache[cache_key] = result
                return result

    # AI fallback
    try:
        resp = _call_llm(
            messages=[
                {
                    "role": "system",
                    "content": "Extract the company name from the job description. "
                    "Reply with ONLY the company name, nothing else. "
                    "If you cannot determine the company name, reply with UNKNOWN.",
                },
                {"role": "user", "content": job_description[:2000]},
            ],
            max_tokens=50,
            temperature=0.0,
            tier="utility",
        )
        usage = {
            "prompt_tokens": resp.prompt_tokens,
            "completion_tokens": resp.completion_tokens,
        }
        ai_result = resp.content
        if ai_result and ai_result.upper() != "UNKNOWN":
            result = (ai_result, usage)
            _extraction_cache[cache_key] = result
            return result
    except Exception as exc:
        logger.warning("Company extraction AI call failed", exc_info=True)
        log_service.log_bg(
            log_service.WARNING, log_service.AI_CALL,
            "Company extraction AI call failed — returning None",
            **log_service.exc_to_log_kwargs(exc),
        )

    result = (None, usage)
    _extraction_cache[cache_key] = result
    if len(_extraction_cache) > _CACHE_MAX_SIZE:
        # Evict oldest entries
        keys = list(_extraction_cache.keys())
        for k in keys[: len(keys) - _CACHE_MAX_SIZE]:
            _extraction_cache.pop(k, None)
    return result


def extract_jd_info(job_description: str) -> dict:
    """Extract salary range and required skills from a job description.

    Returns {"salary_range": str|None, "required_skills": list[str], "usage": dict}
    """
    from prompts import JD_EXTRACTION

    cache_key = f"jd_info:{_jd_hash(job_description)}"
    if cache_key in _extraction_cache:
        return _extraction_cache[cache_key]

    fallback = {"salary_range": None, "required_skills": [], "usage": {"prompt_tokens": 0, "completion_tokens": 0}}
    try:
        resp = _call_llm(
            messages=[
                {"role": "system", "content": JD_EXTRACTION},
                {"role": "user", "content": job_description},
            ],
            max_tokens=512,
            temperature=0.0,
            tier="utility",
        )
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
            "usage": {"prompt_tokens": resp.prompt_tokens, "completion_tokens": resp.completion_tokens},
        }
    except Exception as exc:
        logger.warning("JD info extraction failed: %s", exc)
        result = fallback

    _extraction_cache[cache_key] = result
    if len(_extraction_cache) > _CACHE_MAX_SIZE:
        keys = list(_extraction_cache.keys())
        for k in keys[: len(keys) - _CACHE_MAX_SIZE]:
            _extraction_cache.pop(k, None)
    return result


def generate_summary(
    user_name: str,
    experiences: list[dict],
    job_description: str,
    job_title: str,
    company: str | None = None,
    knowledge_base: str | None = None,
) -> tuple[str, dict]:
    """Call LLM to generate a tailored professional summary."""
    formatted_exp = _format_experiences(experiences)
    company_str = company or "the company"
    jd_trimmed = _truncate_jd(job_description)

    kb_section = ""
    if knowledge_base:
        kb_section = f"""

## Knowledge Base Guidelines (MUST FOLLOW)
{knowledge_base}
"""

    user_prompt = f"""## Candidate: {user_name}

## Candidate Experience
{formatted_exp}

## Target Position
Title: {job_title} at {company_str}

## Job Description
{jd_trimmed}
{kb_section}
Write a 2-3 sentence professional summary for this candidate's resume, \
tailored to the target position."""

    resp = _call_llm(
        messages=[
            {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=300,
        temperature=0.7,
    )

    usage = {
        "prompt_tokens": resp.prompt_tokens,
        "completion_tokens": resp.completion_tokens,
    }
    return _normalize_ai_text(resp.content), usage


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

    total_usage = {"prompt_tokens": 0, "completion_tokens": 0}

    for attempt in range(2):
        resp = _call_llm(
            messages=[
                {"role": "system", "content": COMBINED_CONTENT_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=8192,
            temperature=temperature,
        )

        total_usage["prompt_tokens"] += resp.prompt_tokens
        total_usage["completion_tokens"] += resp.completion_tokens

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
    educations: list[dict],
    job_description: str,
    job_title: str,
    company: str | None = None,
    reference_bullets: list[dict] | None = None,
    knowledge_base: str | None = None,
    creativity_factor: float = 0.3,
) -> tuple[list[dict], dict]:
    """Call LLM to tailor resume bullets to a job description."""
    formatted_exp = _format_experiences(experiences)
    company_str = company or "the company"

    reference_section = ""
    if reference_bullets:
        ref_parts = []
        for exp in reference_bullets:
            bullets = "\n".join(f"- {b}" for b in exp.get("bullets", []))
            ref_parts.append(
                f"Company: {exp.get('company', '')} | Title: {exp.get('title', '')}\n{bullets}"
            )
        reference_section = f"""

## Reference Bullets (from a colleague's application for the same role)
Use similar framing, metrics style, and technical depth for the bullets below.
Adapt to THIS candidate's actual experience — do NOT copy verbatim or fabricate.

{chr(10).join(ref_parts)}
"""

    kb_section = ""
    if knowledge_base:
        kb_section = f"""

## Knowledge Base Guidelines (MUST FOLLOW)
{knowledge_base}
"""

    jd_trimmed = _truncate_jd(job_description)
    style = _style_hint(creativity_factor)
    temperature = _effective_temperature(creativity_factor)

    user_prompt = f"""## Candidate's Experience
{formatted_exp}

## Target Job Description
Title: {job_title} at {company_str}
{jd_trimmed}
{reference_section}{kb_section}
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

    total_usage = {"prompt_tokens": 0, "completion_tokens": 0}

    for attempt in range(2):
        resp = _call_llm(
            messages=[
                {"role": "system", "content": RESUME_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=8192,
            temperature=temperature,
        )

        total_usage["prompt_tokens"] += resp.prompt_tokens
        total_usage["completion_tokens"] += resp.completion_tokens

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
    )

    usage = {
        "prompt_tokens": resp.prompt_tokens,
        "completion_tokens": resp.completion_tokens,
    }
    return _normalize_ai_text(resp.content), usage


def generate_skills(
    user_name: str,
    experiences: list[dict],
    job_description: str,
    job_title: str,
    company: str | None = None,
    knowledge_base: str | None = None,
) -> tuple[list[dict], dict]:
    """Call LLM to generate categorized skills from experience + JD.

    Returns (skills_list, usage_dict) where skills_list is
    [{"category": "...", "skills": ["...", ...]}, ...].
    """
    formatted_exp = _format_experiences(experiences)
    company_str = company or "the company"
    jd_trimmed = _truncate_jd(job_description)

    kb_section = ""
    if knowledge_base:
        kb_section = f"""

## Knowledge Base Guidelines (MUST FOLLOW)
{knowledge_base}
"""

    user_prompt = f"""## Candidate: {user_name}

## Candidate Experience
{formatted_exp}

## Target Position
Title: {job_title} at {company_str}

## Job Description
{jd_trimmed}
{kb_section}
Extract and categorize the candidate's skills based on their experience \
and the target job description."""

    total_usage = {"prompt_tokens": 0, "completion_tokens": 0}

    for attempt in range(2):
        resp = _call_llm(
            messages=[
                {"role": "system", "content": SKILLS_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=1024,
            temperature=0.7,
        )

        total_usage["prompt_tokens"] += resp.prompt_tokens
        total_usage["completion_tokens"] += resp.completion_tokens

        content = resp.content
        # Strip markdown code fences if present
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\s*\n?", "", content)
            content = re.sub(r"\n?```\s*$", "", content)
        try:
            result = json.loads(content)
            if isinstance(result, list):
                return result, total_usage
            raise ValueError("Expected a JSON array")
        except (json.JSONDecodeError, ValueError) as e:
            if attempt == 0:
                logger.warning(
                    "Skills JSON parse failed on attempt 1, retrying: %s", e
                )
                user_prompt = (
                    f"Your previous response was not valid JSON. "
                    f"Please respond with valid JSON only.\n\n{user_prompt}"
                )
            else:
                logger.error("Skills JSON parse failed on attempt 2: %s", e)
                raise RuntimeError(
                    f"Failed to parse AI skills response: {e}"
                ) from e
