"""
@file   anthropic_provider.py
@module providers
@description
    Anthropic Claude LLM provider — swap-in implementation.
    Activate by setting LLM_PROVIDER=anthropic in .env.
    Zero code changes required; only .env update needed.

EPIC: EPIC-004 — Automated Invoice Data Extraction (EDA)
User Story: Modular LLM provider pattern — Anthropic Claude swap-in.
Acceptance: "LLM can be changed without code changes — only .env update"

@author  Invoice Processing Platform Engineering
@version 1.0.0
@since   2025-01-01
"""

import json
import anthropic
from tenacity import retry, stop_after_attempt, wait_exponential

from .base_provider         import ILlmProvider
from .nano_banana_provider  import SYSTEM_PROMPT  # reuse same prompt
from ..exceptions.llm_exception import LlmProviderException
from ..config.settings      import Settings
from ..utils.logger         import get_logger

logger = get_logger(__name__)


class AnthropicProvider(ILlmProvider):
    """
    Anthropic Claude LLM provider for invoice field extraction.

    EPIC: EPIC-004 — Modular LLM Provider (Anthropic Swap-in)
    Activate: LLM_PROVIDER=anthropic in .env
    Configure: ANTHROPIC_API_KEY, ANTHROPIC_MODEL

    Uses the Anthropic Messages API with the same extraction prompt as
    NanoBananaProvider — ensures consistent field extraction regardless of provider.

    Usage:
        provider = AnthropicProvider(settings)
        fields   = await provider.extract_fields(ocr_text)
    """

    def __init__(self, settings: Settings):
        """
        Initialises Anthropic provider with API credentials.

        EPIC: EPIC-004 | Anthropic Provider Initialisation
        @param settings: Application settings (ANTHROPIC_API_KEY, ANTHROPIC_MODEL).
        @raises ValueError: When ANTHROPIC_API_KEY is not configured.
        """
        # TODO: self.api_key = settings.ANTHROPIC_API_KEY
        # TODO: self.model   = settings.ANTHROPIC_MODEL
        # TODO: self.client  = anthropic.AsyncAnthropic(api_key=self.api_key)
        # TODO: self.validate_config()
        pass

    def get_provider_name(self) -> str:
        """
        @return: 'anthropic'
        """
        return 'anthropic'

    def validate_config(self) -> bool:
        """
        Validates ANTHROPIC_API_KEY and ANTHROPIC_MODEL are set.

        EPIC: EPIC-004 | Provider Config Validation
        @return: True if valid.
        @raises ValueError: When configuration is missing.
        """
        # TODO: if not self.api_key: raise ValueError("ANTHROPIC_API_KEY is required for LLM_PROVIDER=anthropic")
        # TODO: if not self.model:   raise ValueError("ANTHROPIC_MODEL is required for LLM_PROVIDER=anthropic")
        # TODO: return True
        raise NotImplementedError

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8), reraise=True)
    async def extract_fields(self, ocr_text: str) -> dict:
        """
        Calls Anthropic Messages API to extract structured invoice fields.

        EPIC: EPIC-004 | Anthropic Field Extraction
        Acceptance: "All predefined fields extracted correctly; provider swappable via .env"

        Uses the same SYSTEM_PROMPT as NanoBananaProvider for consistency.
        Claude's JSON mode is invoked by including 'Output JSON:' prefix.

        @param ocr_text: Raw OCR text from invoice image.
        @return: Dict containing extracted invoice field values.
        @raises LlmProviderException: After 3 failed attempts.
        """
        # TODO: message = await self.client.messages.create(
        #           model=self.model,
        #           max_tokens=2048,
        #           system=SYSTEM_PROMPT,
        #           messages=[{"role":"user","content":f"OCR Text:\n---\n{ocr_text}\n---\nOutput JSON:"}]
        #       )
        # TODO: content = message.content[0].text
        # TODO: # Strip any markdown fences Claude might add
        # TODO: content = content.strip().lstrip('```json').rstrip('```').strip()
        # TODO: extracted = json.loads(content)
        # TODO: logger.info("Anthropic extraction success", extra={"model": self.model})
        # TODO: return extracted
        raise NotImplementedError
