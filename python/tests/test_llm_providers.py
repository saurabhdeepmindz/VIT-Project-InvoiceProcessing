"""
test_llm_providers.py  (v3.1)

Unit tests for the three real LLM providers plus the shared JSON parser.
External SDKs / HTTP are fully mocked.

@since 3.1.0
"""

from __future__ import annotations

import base64
import json
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.config.settings import Settings
from app.exceptions.exceptions import LlmProviderException
from app.providers._shared import parse_json_response
from app.providers.anthropic_provider import AnthropicProvider
from app.providers.nano_banana_provider import NanoBananaProvider
from app.providers.openai_provider import OpenAIProvider


SAMPLE_FIELDS = {
    "dealer_name": "Bridgestone Select",
    "customer_name": "Jane Doe",
    "customer_mobile": "+61400111222",
    "vehicle_registration_number": "ABC123",
    "tyre_size": "205/55R16",
    "tyre_pattern": "Turanza T005",
    "invoice_amount_excl_gst": 400.0,
    "gst_amount": 40.0,
    "gst_components": {"GST_10": 40.0},
    "quantity": 4,
    "invoice_date": "2026-01-15",
    "invoice_number": "INV-0001",
    "comments": None,
}


# ──────────────────────────────────────────────────────────────────────────
# parse_json_response
# ──────────────────────────────────────────────────────────────────────────

def test_parse_plain_json() -> None:
    assert parse_json_response('{"a": 1}', provider="test") == {"a": 1}


def test_parse_strips_fences() -> None:
    raw = "```json\n{\"a\": 1}\n```"
    assert parse_json_response(raw, provider="test") == {"a": 1}


def test_parse_handles_leading_prose() -> None:
    raw = 'Sure, here is the JSON: {"a": 1, "b": 2}'
    assert parse_json_response(raw, provider="test") == {"a": 1, "b": 2}


def test_parse_handles_trailing_commas() -> None:
    raw = '{"a": 1, "b": [1, 2,],}'
    assert parse_json_response(raw, provider="test") == {"a": 1, "b": [1, 2]}


def test_parse_rejects_empty() -> None:
    with pytest.raises(LlmProviderException):
        parse_json_response("", provider="test")


def test_parse_rejects_non_object() -> None:
    with pytest.raises(LlmProviderException):
        parse_json_response("[1, 2, 3]", provider="test")


def test_parse_rejects_unparseable() -> None:
    with pytest.raises(LlmProviderException):
        parse_json_response("not json at all", provider="test")


# ──────────────────────────────────────────────────────────────────────────
# NanoBananaProvider
# ──────────────────────────────────────────────────────────────────────────

def _nb_settings(**overrides: Any) -> Settings:
    base: dict[str, Any] = dict(
        USE_STUB_PROVIDER=False,
        LLM_PROVIDER="nano_banana",
        NB_API_KEY="nb-test-key",
        NB_API_BASE="https://api.nanobanana.example/v1",
        NB_MODEL="nano-banana-large",
    )
    base.update(overrides)
    return Settings(**base)


def test_nano_banana_requires_api_key() -> None:
    with pytest.raises(ValueError, match="NB_API_KEY"):
        NanoBananaProvider(_nb_settings(NB_API_KEY=""))


@pytest.mark.asyncio
async def test_nano_banana_extract_from_image_success() -> None:
    provider = NanoBananaProvider(_nb_settings())

    fake_response = httpx.Response(
        status_code=200,
        json={"choices": [{"message": {"content": json.dumps(SAMPLE_FIELDS)}}]},
    )
    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_client.post = AsyncMock(return_value=fake_response)
    provider._client = mock_client  # inject

    result = await provider.extract_fields_from_image(
        image_bytes=b"\x89PNGfake", prompt="", mime_type="image/png"
    )
    assert result["dealer_name"] == "Bridgestone Select"
    assert result["quantity"] == 4

    # Verify the request carried a data URL with the right mime type.
    call_kwargs = mock_client.post.call_args.kwargs
    user_msg = call_kwargs["json"]["messages"][1]
    image_block = [c for c in user_msg["content"] if c["type"] == "image_url"][0]
    assert image_block["image_url"]["url"].startswith("data:image/png;base64,")
    assert base64.b64decode(image_block["image_url"]["url"].split(",", 1)[1]) == b"\x89PNGfake"


@pytest.mark.asyncio
async def test_nano_banana_maps_http_error() -> None:
    provider = NanoBananaProvider(_nb_settings())

    fake_response = httpx.Response(status_code=401, text="unauthorized")
    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_client.post = AsyncMock(return_value=fake_response)
    provider._client = mock_client

    with pytest.raises(LlmProviderException) as exc:
        await provider.extract_fields_from_image(
            image_bytes=b"abc", prompt="", mime_type="image/jpeg"
        )
    assert exc.value.status_code == 401
    assert exc.value.provider == "nano_banana"


# ──────────────────────────────────────────────────────────────────────────
# OpenAIProvider
# ──────────────────────────────────────────────────────────────────────────

def _openai_settings(**overrides: Any) -> Settings:
    base: dict[str, Any] = dict(
        USE_STUB_PROVIDER=False,
        LLM_PROVIDER="openai",
        OPENAI_API_KEY="sk-test",
        OPENAI_MODEL="gpt-4o",
    )
    base.update(overrides)
    return Settings(**base)


@pytest.mark.asyncio
async def test_openai_extract_from_image_success() -> None:
    with patch("openai.AsyncOpenAI") as client_cls:
        instance = MagicMock()
        instance.chat.completions.create = AsyncMock(
            return_value=SimpleNamespace(
                choices=[
                    SimpleNamespace(
                        message=SimpleNamespace(content=json.dumps(SAMPLE_FIELDS))
                    )
                ]
            )
        )
        client_cls.return_value = instance
        provider = OpenAIProvider(_openai_settings())

        result = await provider.extract_fields_from_image(
            image_bytes=b"\xff\xd8jpeg", prompt="", mime_type="image/jpeg"
        )
        assert result["invoice_number"] == "INV-0001"

        call = instance.chat.completions.create.await_args.kwargs
        assert call["model"] == "gpt-4o"
        assert call["response_format"] == {"type": "json_object"}
        user_msg = call["messages"][1]
        image_block = [c for c in user_msg["content"] if c["type"] == "image_url"][0]
        assert image_block["image_url"]["url"].startswith("data:image/jpeg;base64,")


@pytest.mark.asyncio
async def test_openai_wraps_sdk_error() -> None:
    with patch("openai.AsyncOpenAI") as client_cls:
        instance = MagicMock()
        err = RuntimeError("rate limited")
        err.status_code = 429  # type: ignore[attr-defined]
        instance.chat.completions.create = AsyncMock(side_effect=err)
        client_cls.return_value = instance
        provider = OpenAIProvider(_openai_settings())

        with pytest.raises(LlmProviderException) as exc:
            await provider.extract_fields_from_image(
                image_bytes=b"abc", prompt="", mime_type="image/jpeg"
            )
        assert exc.value.provider == "openai"
        assert exc.value.status_code == 429


# ──────────────────────────────────────────────────────────────────────────
# AnthropicProvider
# ──────────────────────────────────────────────────────────────────────────

def _anthropic_settings(**overrides: Any) -> Settings:
    base: dict[str, Any] = dict(
        USE_STUB_PROVIDER=False,
        LLM_PROVIDER="anthropic",
        ANTHROPIC_API_KEY="sk-ant-test",
        ANTHROPIC_MODEL="claude-sonnet-4-6",
    )
    base.update(overrides)
    return Settings(**base)


@pytest.mark.asyncio
async def test_anthropic_extract_from_image_success() -> None:
    with patch("anthropic.AsyncAnthropic") as client_cls:
        instance = MagicMock()
        instance.messages.create = AsyncMock(
            return_value=SimpleNamespace(
                content=[
                    SimpleNamespace(type="text", text="```json\n" + json.dumps(SAMPLE_FIELDS) + "\n```")
                ]
            )
        )
        client_cls.return_value = instance
        provider = AnthropicProvider(_anthropic_settings())

        result = await provider.extract_fields_from_image(
            image_bytes=b"pngbytes", prompt="", mime_type="image/png"
        )
        assert result["tyre_size"] == "205/55R16"

        call = instance.messages.create.await_args.kwargs
        assert call["model"] == "claude-sonnet-4-6"
        assert call["system"].startswith("You are a precise invoice data extraction assistant")
        content = call["messages"][0]["content"]
        image_block = [c for c in content if c["type"] == "image"][0]
        assert image_block["source"]["media_type"] == "image/png"
        assert base64.b64decode(image_block["source"]["data"]) == b"pngbytes"


@pytest.mark.asyncio
async def test_anthropic_falls_back_to_png_for_unsupported_mime() -> None:
    with patch("anthropic.AsyncAnthropic") as client_cls:
        instance = MagicMock()
        instance.messages.create = AsyncMock(
            return_value=SimpleNamespace(
                content=[SimpleNamespace(type="text", text=json.dumps(SAMPLE_FIELDS))]
            )
        )
        client_cls.return_value = instance
        provider = AnthropicProvider(_anthropic_settings())

        await provider.extract_fields_from_image(
            image_bytes=b"rendered", prompt="", mime_type="application/pdf"
        )
        call = instance.messages.create.await_args.kwargs
        image_block = call["messages"][0]["content"][0]
        assert image_block["source"]["media_type"] == "image/png"
