"""
openai_provider.py  (v3.1)

OpenAI (or OpenAI-compatible) vision-first provider. Uses the official `openai`
async client: chat.completions.create with multi-part user content so that a
base64 data URL is passed alongside the text prompt.

Activate: LLM_PROVIDER=openai  (USE_STUB_PROVIDER=false)
Config:   OPENAI_API_KEY, OPENAI_MODEL, OPENAI_MAX_TOKENS, OPENAI_TEMPERATURE

@since 3.1.0
"""

from __future__ import annotations

import base64
from typing import Any

from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from ..config.settings import Settings
from ..exceptions.exceptions import LlmProviderException
from ..utils.logger import get_logger
from ._shared import (
    IMAGE_USER_PROMPT,
    TEXT_USER_PROMPT_TEMPLATE,
    VISION_SYSTEM_PROMPT,
    parse_json_response,
)
from .base_provider import ILlmProvider


logger = get_logger(__name__)

_PROVIDER_NAME = "openai"


class OpenAIProvider(ILlmProvider):
    """OpenAI chat.completions client, vision-enabled via data-URL image blocks."""

    def __init__(self, settings: Settings) -> None:
        # Import lazily so missing optional SDK doesn't crash the factory.
        import openai  # noqa: WPS433

        self.api_key = settings.OPENAI_API_KEY
        self.model = settings.OPENAI_MODEL
        self.max_tokens = settings.OPENAI_MAX_TOKENS
        self.temperature = settings.OPENAI_TEMPERATURE
        self.validate_config()
        self._client = openai.AsyncOpenAI(api_key=self.api_key)

    def get_provider_name(self) -> str:
        return _PROVIDER_NAME

    def validate_config(self) -> bool:
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY is required for LLM_PROVIDER=openai")
        if not self.model:
            raise ValueError("OPENAI_MODEL is required for LLM_PROVIDER=openai")
        return True

    async def extract_fields_from_image(
        self,
        image_bytes: bytes,
        prompt: str,
        *,
        mime_type: str = "image/jpeg",
    ) -> dict[str, Any]:
        data_url = _to_data_url(image_bytes, mime_type)
        messages = [
            {"role": "system", "content": VISION_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt or IMAGE_USER_PROMPT},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            },
        ]
        return await self._chat_completion(messages)

    async def extract_fields_from_text(
        self,
        ocr_text: str,
        prompt: str,
    ) -> dict[str, Any]:
        user_text = prompt or TEXT_USER_PROMPT_TEMPLATE.format(ocr_text=ocr_text)
        messages = [
            {"role": "system", "content": VISION_SYSTEM_PROMPT},
            {"role": "user", "content": user_text},
        ]
        return await self._chat_completion(messages)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        retry=retry_if_exception_type(LlmProviderException),
        reraise=True,
    )
    async def _chat_completion(self, messages: list[dict[str, Any]]) -> dict[str, Any]:
        try:
            response = await self._client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                response_format={"type": "json_object"},
            )
        except Exception as exc:  # openai.* exceptions — re-wrap uniformly.
            status_code = getattr(exc, "status_code", 0) or 0
            raise LlmProviderException(_PROVIDER_NAME, status_code, str(exc)) from exc

        try:
            raw = response.choices[0].message.content
        except (AttributeError, IndexError) as exc:
            raise LlmProviderException(
                _PROVIDER_NAME, 0, f"malformed response envelope: {exc}"
            ) from exc

        parsed = parse_json_response(raw or "", provider=_PROVIDER_NAME)
        logger.info(
            "openai extraction ok",
            extra={"model": self.model, "fields": sum(1 for v in parsed.values() if v is not None)},
        )
        return parsed


def _to_data_url(image_bytes: bytes, mime_type: str) -> str:
    b64 = base64.b64encode(image_bytes).decode("ascii")
    return f"data:{mime_type};base64,{b64}"
