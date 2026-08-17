from ..providers.base import LLMResponse


def call_anthropic(messages, max_tokens, temperature, config, tools=None) -> LLMResponse:
    system_text = ""
    chat_messages = []
    for msg in messages:
        if msg["role"] == "system":
            system_text = msg["content"]
        else:
            chat_messages.append(msg)

    if config.get("endpoint"):
        # Azure/Microsoft Foundry: use raw httpx because the SDK sends an
        # anthropic-version header that Foundry doesn't support.
        import httpx

        body: dict = {
            "model": config["model_id"],
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": chat_messages,
        }
        if system_text:
            body["system"] = system_text
        if tools:
            body["tools"] = tools

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
        # With web-search tools enabled, content interleaves server_tool_use /
        # web_search_tool_result blocks before the final text — concatenate
        # only the text blocks rather than assuming content[0] is the answer.
        text = "".join(
            b.get("text", "") for b in data.get("content", []) if b.get("type") == "text"
        ).strip()
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
    if tools:
        kwargs["tools"] = tools

    response = client.messages.create(**kwargs)
    # Same interleaving concern as the raw-httpx branch above.
    text = "".join(
        b.text for b in response.content if getattr(b, "type", None) == "text"
    ).strip()
    return LLMResponse(
        content=text,
        prompt_tokens=response.usage.input_tokens,
        completion_tokens=response.usage.output_tokens,
    )
