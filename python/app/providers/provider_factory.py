"""
provider_factory.py  (v3.1)

Factory selecting the active LLM provider. Honours USE_STUB_PROVIDER
first; otherwise dispatches based on LLM_PROVIDER.

EPIC: EPIC-004 — Modular LLM Provider
@since 3.1.0
"""

from __future__ import annotations

from ..config.settings import Settings
from ..utils.logger import get_logger
from .base_provider import ILlmProvider
from .stub_provider import StubProvider

logger = get_logger(__name__)


class LlmProviderFactory:
    """Creates the configured provider. Add new entries to PROVIDER_REGISTRY."""

    @staticmethod
    def create(settings: Settings) -> ILlmProvider:
        # v3.1: stub short-circuit
        if settings.USE_STUB_PROVIDER:
            provider = StubProvider(settings)
            provider.validate_config()
            logger.info("LLM provider initialised: stub (USE_STUB_PROVIDER=true)")
            return provider

        key = (settings.LLM_PROVIDER or "").lower().strip()
        provider_cls = LlmProviderFactory._registry().get(key)
        if provider_cls is None:
            available = ", ".join(LlmProviderFactory._registry().keys())
            raise ValueError(f"Unknown LLM_PROVIDER '{key}'. Available: {available}")

        instance = provider_cls(settings)
        instance.validate_config()
        logger.info(f"LLM provider initialised: {key}")
        return instance

    @staticmethod
    def _registry() -> dict[str, type[ILlmProvider]]:
        """Lazy import so missing optional deps don't crash the factory."""
        registry: dict[str, type[ILlmProvider]] = {}
        try:
            from .nano_banana_provider import NanoBananaProvider
            registry["nano_banana"] = NanoBananaProvider
        except Exception as e:  # noqa: BLE001
            logger.debug(f"nano_banana provider unavailable: {e}")
        try:
            from .openai_provider import OpenAIProvider
            registry["openai"] = OpenAIProvider
        except Exception as e:  # noqa: BLE001
            logger.debug(f"openai provider unavailable: {e}")
        try:
            from .anthropic_provider import AnthropicProvider
            registry["anthropic"] = AnthropicProvider
        except Exception as e:  # noqa: BLE001
            logger.debug(f"anthropic provider unavailable: {e}")
        return registry
