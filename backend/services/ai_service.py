import hashlib
import json
import logging
import re
from dataclasses import dataclass
from sqlalchemy import select

from config import settings
from database import SessionLocal

logger = logging.getLogger(__name__)


def _jd_hash(text: str) -> str:
    """Stable hash of a job description for cache keying."""
    return hashlib.md5(text.strip().lower().encode()).hexdigest()


# Simple in-memory cache for extraction results (saves AI calls in batch mode)
_extraction_cache: dict[str, tuple] = {}
_CACHE_MAX_SIZE = 200

RESUME_SYSTEM_PROMPT = """You are an expert resume writer. Your task is to tailor a candidate's \
experience bullet points to match a specific job description. You must:
1. Preserve truthfulness -- never fabricate experience the candidate doesn't have
2. Reword and reorder bullets to emphasize skills/keywords from the job description
3. Use strong action verbs and quantify impact where possible
4. Remove or de-emphasize bullets that are irrelevant to the target role
5. Each experience should have 3-5 bullets maximum

Respond with valid JSON only. No markdown fences, no explanation."""

SUMMARY_SYSTEM_PROMPT = """You are an expert resume writer. Write a professional summary for a resume. \
The summary must be 2-3 concise sentences that:
1. Mention the candidate's total years of experience with major tech stacks relevant to the job description
2. Highlight both technical achievements and cultural/collaborative success
3. Demonstrate passion and dedication to the field
4. Align keywords and emphasis with the target job description

Respond with the summary text only. No quotes, no labels, no explanation."""

SKILLS_SYSTEM_PROMPT = """You are an expert resume writer. Extract and categorize the candidate's \
skills based on their experience AND the target job description. You must:
1. Include skills the candidate actually has (from their experience)
2. Prioritize skills that match the job description
3. Group skills into logical categories (e.g., "Programming Languages", "Cloud & DevOps", \
"Frameworks & Libraries", "Databases", "Tools & Platforms", etc.)
4. Each category should have 3-8 skills
5. Include 3-6 categories total
6. Order categories by relevance to the target job
7. Include both technical and soft skills if relevant

Respond with valid JSON only. No markdown fences, no explanation.
Format:
[
  {"category": "Category Name", "skills": ["Skill 1", "Skill 2", "Skill 3"]}
]"""

COVER_LETTER_SYSTEM_PROMPT = """You are an expert cover letter writer. Write a compelling, \
professional cover letter that:
1. Is 3-4 paragraphs long
2. Opens with enthusiasm for the specific role and company
3. Connects the candidate's concrete experience to the job requirements
4. Highlights 2-3 specific achievements relevant to the role
5. Closes with a call to action
6. Uses a professional but warm tone -- not generic or robotic
7. Does NOT include the header/address block -- just the letter body

Write the cover letter body only (Dear Hiring Manager through sign-off)."""

COMBINED_CONTENT_SYSTEM_PROMPT = """You are an expert resume and cover letter writer. \
You will generate three pieces of content in a single response as valid JSON.

## Output format
Respond with valid JSON only. No markdown fences, no explanation.
{
  "summary": "<2-3 sentence professional summary>",
  "skills": [{"category": "<Category Name>", "skills": ["Skill1", "Skill2"]}],
  "cover_letter": "<full cover letter body>"
}

## Summary rules
- 2-3 concise sentences
- Mention total years of experience with major tech stacks relevant to the job
- Highlight technical achievements and cultural/collaborative success
- Align keywords with the target job description

## Skills rules
- Include skills the candidate actually has (from their experience)
- Prioritize skills matching the job description
- Group into 3-6 logical categories (e.g., "Programming Languages", "Cloud & DevOps", etc.)
- Each category: 3-8 skills, ordered by relevance to the target job

## Cover letter rules
- 3-4 paragraphs, Dear Hiring Manager through sign-off
- Connect candidate's concrete experience to job requirements
- Highlight 2-3 specific achievements relevant to the role
- Professional but warm tone -- not generic or robotic
- Body only -- no header/address block"""


# ---------------------------------------------------------------------------
# Provider abstraction
# ---------------------------------------------------------------------------

@dataclass
class LLMResponse:
    content: str
    prompt_tokens: int
    completion_tokens: int


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


def _call_openai(messages, max_tokens, temperature, config):
    """Call OpenAI-compatible API (OpenAI direct)."""
    from openai import OpenAI

    kwargs = {"api_key": config["api_key"]}
    if config.get("endpoint"):
        kwargs["base_url"] = config["endpoint"]

    client = OpenAI(**kwargs)
    response = client.chat.completions.create(
        model=config["model_id"],
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
    )
    return LLMResponse(
        content=response.choices[0].message.content.strip(),
        prompt_tokens=response.usage.prompt_tokens,
        completion_tokens=response.usage.completion_tokens,
    )


def _call_azure_openai(messages, max_tokens, temperature, config):
    """Call Azure OpenAI API."""
    from openai import AzureOpenAI

    client = AzureOpenAI(
        api_key=config["api_key"],
        azure_endpoint=config["endpoint"] or settings.azure_openai_endpoint,
        api_version=config.get("api_version") or settings.azure_openai_api_version,
    )
    response = client.chat.completions.create(
        model=config["model_id"],
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
    )
    return LLMResponse(
        content=response.choices[0].message.content.strip(),
        prompt_tokens=response.usage.prompt_tokens,
        completion_tokens=response.usage.completion_tokens,
    )


def _call_anthropic(messages, max_tokens, temperature, config):
    """Call Anthropic Claude API (direct or via Azure AI Foundry)."""
    # Separate system message from user/assistant messages
    system_text = ""
    chat_messages = []
    for msg in messages:
        if msg["role"] == "system":
            system_text = msg["content"]
        else:
            chat_messages.append(msg)

    if config.get("endpoint"):
        # Azure AI Foundry: use raw httpx because the SDK sends an
        # anthropic-version header that Azure doesn't support.
        import httpx

        body: dict = {
            "model": config["model_id"],
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": chat_messages,
        }
        if system_text:
            body["system"] = system_text

        endpoint = config["endpoint"].rstrip("/")
        resp = httpx.post(
            f"{endpoint}/messages",
            json=body,
            headers={
                "Content-Type": "application/json",
                "x-api-key": config["api_key"],
                "anthropic-version": "2023-06-01",
            },
            timeout=120,
        )
        resp.raise_for_status()
        data = resp.json()
        text = data["content"][0]["text"].strip() if data.get("content") else ""
        return LLMResponse(
            content=text,
            prompt_tokens=data["usage"]["input_tokens"],
            completion_tokens=data["usage"]["output_tokens"],
        )

    # Direct Anthropic API: use the SDK
    import anthropic

    client = anthropic.Anthropic(api_key=config["api_key"])
    kwargs = {
        "model": config["model_id"],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "messages": chat_messages,
    }
    if system_text:
        kwargs["system"] = system_text

    response = client.messages.create(**kwargs)
    return LLMResponse(
        content=response.content[0].text.strip(),
        prompt_tokens=response.usage.input_tokens,
        completion_tokens=response.usage.output_tokens,
    )


def _call_google(messages, max_tokens, temperature, config):
    """Call Google Gemini API."""
    import google.generativeai as genai

    genai.configure(api_key=config["api_key"])

    # Extract system instruction and build contents
    system_text = ""
    contents = []
    for msg in messages:
        if msg["role"] == "system":
            system_text = msg["content"]
        elif msg["role"] == "user":
            contents.append({"role": "user", "parts": [msg["content"]]})
        elif msg["role"] == "assistant":
            contents.append({"role": "model", "parts": [msg["content"]]})

    model_kwargs = {}
    if system_text:
        model_kwargs["system_instruction"] = system_text

    model = genai.GenerativeModel(config["model_id"], **model_kwargs)
    response = model.generate_content(
        contents,
        generation_config=genai.types.GenerationConfig(
            max_output_tokens=max_tokens,
            temperature=temperature,
        ),
    )
    usage = response.usage_metadata
    return LLMResponse(
        content=response.text.strip(),
        prompt_tokens=getattr(usage, "prompt_token_count", 0) or 0,
        completion_tokens=getattr(usage, "candidates_token_count", 0) or 0,
    )


_PROVIDER_MAP = {
    "azure_openai": _call_azure_openai,
    "openai": _call_openai,
    "anthropic": _call_anthropic,
    "google": _call_google,
}


def test_model_connection(config: dict) -> str:
    """Send a minimal test message to verify the model is reachable.

    Returns the model's reply on success; raises on failure.
    """
    handler = _PROVIDER_MAP.get(config["provider"])
    if not handler:
        raise RuntimeError(f"Unsupported provider: {config['provider']}")

    resp = handler(
        messages=[
            {"role": "system", "content": "Reply with OK only."},
            {"role": "user", "content": "ping"},
        ],
        max_tokens=5,
        temperature=0.0,
        config=config,
    )
    return resp.content


def _call_llm(
    messages: list[dict],
    max_tokens: int = 1024,
    temperature: float = 0.7,
    tier: str = "primary",
) -> LLMResponse:
    """Route to the correct provider based on active model config.

    Args:
        tier: "primary" for quality-critical tasks (resume tailoring,
              summary, skills, cover letter), "utility" for cheap
              extraction tasks (company name, location, duplicate check).
    """
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

    provider = config["provider"]
    handler = _PROVIDER_MAP.get(provider)
    if not handler:
        raise RuntimeError(f"Unsupported AI provider: {provider}")

    return handler(messages, max_tokens, temperature, config)


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
                {
                    "role": "system",
                    "content": "You are comparing two job descriptions to determine if they "
                    "are for the same role (possibly a repost or minor edit). "
                    "Reply with ONLY 'SAME' or 'DIFFERENT'. "
                    "SAME means it is essentially the same position, possibly reposted. "
                    "DIFFERENT means it is a genuinely different role or significantly different requirements.",
                },
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
    except Exception:
        logger.warning("AI duplicate check failed", exc_info=True)
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
    except Exception:
        logger.warning("Company extraction AI call failed", exc_info=True)

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
    except Exception:
        logger.warning("Company extraction AI call failed", exc_info=True)

    result = (None, usage)
    _extraction_cache[cache_key] = result
    if len(_extraction_cache) > _CACHE_MAX_SIZE:
        # Evict oldest entries
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


def generate_resume_content(
    user_name: str,
    email: str | None,
    phone: str | None,
    experiences: list[dict],
    job_description: str,
    job_title: str,
    company: str | None = None,
    knowledge_base: str | None = None,
) -> tuple[dict, dict]:
    """Generate summary, skills, and cover letter in a single LLM call.

    Returns (content_dict, usage_dict) where content_dict has keys:
    "summary" (str), "skills" (list[dict]), "cover_letter" (str).
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
Generate the summary, skills, and cover letter as a single JSON object."""

    total_usage = {"prompt_tokens": 0, "completion_tokens": 0}

    for attempt in range(2):
        resp = _call_llm(
            messages=[
                {"role": "system", "content": COMBINED_CONTENT_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=4096,
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
            if not isinstance(result, dict):
                raise ValueError("Expected a JSON object")
            # Validate required keys
            if "summary" not in result or "cover_letter" not in result:
                raise ValueError("Missing required keys: summary, cover_letter")
            if "skills" not in result:
                result["skills"] = []
            # Normalize smart characters to plain ASCII
            result["summary"] = _normalize_ai_text(result["summary"])
            result["cover_letter"] = _normalize_ai_text(result["cover_letter"])
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

    user_prompt = f"""## Candidate's Experience
{formatted_exp}

## Target Job Description
Title: {job_title} at {company_str}
{jd_trimmed}
{reference_section}{kb_section}
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
            max_tokens=4096,
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
                # Normalize smart characters in bullet text
                for exp in result:
                    exp["bullets"] = [
                        _normalize_ai_text(b) for b in exp.get("bullets", [])
                    ]
                return result, total_usage
            raise ValueError("Expected a JSON array")
        except (json.JSONDecodeError, ValueError) as e:
            if attempt == 0:
                logger.warning(
                    "JSON parse failed on attempt 1, retrying: %s", e
                )
                user_prompt = (
                    f"Your previous response was not valid JSON. "
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
) -> tuple[str, dict]:
    """Call LLM to generate a cover letter."""
    formatted_exp = _format_experiences(experiences)
    company_str = company or "the company"
    jd_trimmed = _truncate_jd(job_description)

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

Write the cover letter body only (Dear Hiring Manager through sign-off)."""

    resp = _call_llm(
        messages=[
            {"role": "system", "content": COVER_LETTER_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=2048,
        temperature=0.7,
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
