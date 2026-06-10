from ..providers.base import LLMResponse


def call_anthropic(messages, max_tokens, temperature, config) -> LLMResponse:
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
            timeout=httpx.Timeout(connect=15.0, read=600.0, write=30.0, pool=15.0),
        )
        resp.raise_for_status()
        data = resp.json()
        text = data["content"][0]["text"].strip() if data.get("content") else ""
        return LLMResponse(
            content=text,
            prompt_tokens=data["usage"]["input_tokens"],
            completion_tokens=data["usage"]["output_tokens"],
        )

    import anthropic

    client = anthropic.Anthropic(api_key=config["api_key"])
    kwargs: dict = {
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
