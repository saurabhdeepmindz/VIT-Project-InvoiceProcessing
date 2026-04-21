"""
anthropic_provider.py  (v3.1)

Anthropic Claude vision-first provider. Uses the official `anthropic` async
client: messages.create with a multi-part user content list — text prompt +
image block (base64 source) — and a system prompt that forces JSON-only
output.

Activate: LLM_PROVIDER=anthropic  (USE_STUB_PROVIDER=false)
Config:   ANTHROPIC_API_KEY, ANTHROPIC_MODEL, ANTHROPIC_MAX_TOKENS

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

_PROVIDER_NAME = "anthropic"

_SUPPORTED_IMAGE_MIME = {"image/jpeg", "image/png", "image/gif", "image/webp"}


class AnthropicProvider(ILlmProvider):
    """Anthropic Claude messages-API client, vision-enabled via base64 image block."""

    def __init__(self, settings: Settings) -> None:
        import anthropic  # noqa: WPS433 — lazy so missing SDK doesn't crash factory.

        self.api_key = settings.ANTHROPIC_API_KEY
        self.model = settings.ANTHROPIC_MODEL
        self.max_tokens = settings.ANTHROPIC_MAX_TOKENS
        self.validate_config()
        self._client = anthropic.AsyncAnthropic(api_key=self.api_key)

    def get_provider_name(self) -> str:
        return _PROVIDER_NAME

    def validate_config(self) -> bool:
        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY is required for LLM_PROVIDER=anthropic")
        if not self.model:
            raise ValueError("ANTHROPIC_MODEL is required for LLM_PROVIDER=anthropic")
        return True

    async def extract_fields_from_image(
        self,
        image_bytes: bytes,
        prompt: str,
        *,
        mime_type: str = "image/jpeg",
    ) -> dict[str, Any]:
        if mime_type not in _SUPPORTED_IMAGE_MIME:
            # Anthropic rejects unsupported mime types outright; rather than
            # let the request fail mid-flight, map PDFs (which the pipeline
            # has already rasterised by this point) or unknown types to PNG.
            mime_type = "image/png"

        b64 = base64.b64encode(image_bytes).decode("ascii")
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": mime_type, "data": b64},
                    },
                    {"type": "text", "text": prompt or IMAGE_USER_PROMPT},
                ],
            }
        ]
        return await self._messages_create(messages)

    async def extract_fields_from_text(
        self,
        ocr_text: str,
        prompt: str,
    ) -> dict[str, Any]:
        user_text = prompt or TEXT_USER_PROMPT_TEMPLATE.format(ocr_text=ocr_text)
        messages = [{"role": "user", "content": user_text}]
        return await self._messages_create(messages)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        retry=retry_if_exception_type(LlmProviderException),
        reraise=True,
    )
    async def _messages_create(self, messages: list[dict[str, Any]]) -> dict[str, Any]:
        try:
            response = await self._client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=VISION_SYSTEM_PROMPT,
                messages=messages,
            )
        except Exception as exc:
            status_code = getattr(exc, "status_code", 0) or 0
            raise LlmProviderException(_PROVIDER_NAME, status_code, str(exc)) from exc

        raw = _first_text_block(response)
        if raw is None:
            raise LlmProviderException(
                _PROVIDER_NAME, 0, "Anthropic response contained no text block"
            )

        parsed = parse_json_response(raw, provider=_PROVIDER_NAME)
        logger.info(
            "anthropic extraction ok",
            extra={"model": self.model, "fields": sum(1 for v in parsed.values() if v is not None)},
        )
        return parsed


def _first_text_block(response: Any) -> str | None:
    content = getattr(response, "content", None)
    if not content:
        return None
    for block in content:
        if getattr(block, "type", None) == "text":
            text = getattr(block, "text", None)
            if text:
                return text
    return None
