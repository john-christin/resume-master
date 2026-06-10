from ..providers.base import LLMResponse


def call_google(messages, max_tokens, temperature, config) -> LLMResponse:
    import google.generativeai as genai

    genai.configure(api_key=config["api_key"])

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
