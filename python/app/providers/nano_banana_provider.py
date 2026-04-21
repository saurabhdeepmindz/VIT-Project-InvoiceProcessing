"""
nano_banana_provider.py  (v3.1)

Concrete LLM provider hitting the Nano Banana hosted endpoint, which exposes
an OpenAI-compatible /chat/completions API. Vision invocation is done via the
standard content-block form where a base64 data URL is embedded in the user
message alongside the text prompt.

EPIC: EPIC-004 — Automated Invoice Data Extraction (EDA)
@since 3.1.0
"""

from __future__ import annotations

import base64
from typing import Any

import httpx
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

# Back-compat export used by older callers / tests that imported the prompt
# from this module.
SYSTEM_PROMPT = VISION_SYSTEM_PROMPT


_PROVIDER_NAME = "nano_banana"
_DEFAULT_TIMEOUT_S = 60.0


class NanoBananaProvider(ILlmProvider):
    """OpenAI-compatible Nano Banana chat-completions client (vision enabled)."""

    def __init__(self, settings: Settings) -> None:
        self.api_key = settings.NB_API_KEY
        self.base_url = settings.NB_API_BASE.rstrip("/")
        self.model = settings.NB_MODEL
        self.max_tokens = settings.NB_MAX_TOKENS
        self.temperature = settings.NB_TEMPERATURE
        self._client: httpx.AsyncClient | None = None
        self.validate_config()

    def get_provider_name(self) -> str:
        return _PROVIDER_NAME

    def validate_config(self) -> bool:
        if not self.api_key:
            raise ValueError("NB_API_KEY is required for LLM_PROVIDER=nano_banana")
        if not self.base_url:
            raise ValueError("NB_API_BASE is required for LLM_PROVIDER=nano_banana")
        if not self.model:
            raise ValueError("NB_MODEL is required for LLM_PROVIDER=nano_banana")
        return True

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT_S)
        return self._client

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
        retry=retry_if_exception_type((httpx.HTTPError, LlmProviderException)),
        reraise=True,
    )
    async def _chat_completion(self, messages: list[dict[str, Any]]) -> dict[str, Any]:
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "response_format": {"type": "json_object"},
        }
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        try:
            response = await self._get_client().post(url, json=payload, headers=headers)
        except httpx.HTTPError as exc:
            raise LlmProviderException(_PROVIDER_NAME, 0, f"transport error: {exc}") from exc

        if response.status_code >= 400:
            raise LlmProviderException(
                _PROVIDER_NAME, response.status_code,
                f"{response.status_code} {response.text[:500]}",
            )

        try:
            body = response.json()
            raw = body["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError) as exc:
            raise LlmProviderException(
                _PROVIDER_NAME, response.status_code,
                f"malformed response envelope: {exc}",
            ) from exc

        parsed = parse_json_response(raw, provider=_PROVIDER_NAME)
        logger.info(
            "nano_banana extraction ok",
            extra={"model": self.model, "fields": sum(1 for v in parsed.values() if v is not None)},
        )
        return parsed


def _to_data_url(image_bytes: bytes, mime_type: str) -> str:
    b64 = base64.b64encode(image_bytes).decode("ascii")
    return f"data:{mime_type};base64,{b64}"
