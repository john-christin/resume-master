from dataclasses import dataclass
from typing import Callable


@dataclass
class LLMResponse:
    content: str
    prompt_tokens: int
    completion_tokens: int


# Populated after provider modules are imported (avoids circular imports)
_PROVIDER_MAP: dict[str, Callable] = {}


def _ensure_providers_loaded():
    if _PROVIDER_MAP:
        return
    from .openai_provider import call_openai, call_azure_openai
    from .anthropic_provider import call_anthropic
    from .google_provider import call_google

    _PROVIDER_MAP.update({
        "openai": call_openai,
        "azure_openai": call_azure_openai,
        "anthropic": call_anthropic,
        "google": call_google,
    })


def call_provider(messages, max_tokens, temperature, config) -> LLMResponse:
    _ensure_providers_loaded()
    provider = config["provider"]
    handler = _PROVIDER_MAP.get(provider)
    if not handler:
        raise RuntimeError(f"Unsupported AI provider: {provider}")
    return handler(messages, max_tokens, temperature, config)


def test_model_connection(config: dict) -> str:
    """Send a minimal test message to verify the model is reachable."""
    resp = call_provider(
        messages=[
            {"role": "system", "content": "Reply with OK only."},
            {"role": "user", "content": "ping"},
        ],
        max_tokens=5,
        temperature=0.0,
        config=config,
    )
    return resp.content
