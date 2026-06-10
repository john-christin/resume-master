from ..providers.base import LLMResponse


def call_openai(messages, max_tokens, temperature, config) -> LLMResponse:
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


def call_azure_openai(messages, max_tokens, temperature, config) -> LLMResponse:
    from openai import AzureOpenAI
    from config import settings

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
