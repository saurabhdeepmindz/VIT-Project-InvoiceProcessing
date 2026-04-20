"""
base_provider.py  (v3.1 — vision-first)

Abstract LLM provider contract. v3.1 introduces
`extract_fields_from_image` as the primary extraction path; the legacy
`extract_fields_from_text` remains as a fallback (OCR-first mode).

EPIC: EPIC-004 — Automated Invoice Data Extraction
@since 3.1.0
"""

from abc import ABC, abstractmethod
from typing import Any


class ILlmProvider(ABC):
    """Contract implemented by every concrete LLM provider."""

    @abstractmethod
    async def extract_fields_from_image(
        self,
        image_bytes: bytes,
        prompt: str,
        *,
        mime_type: str = "image/jpeg",
    ) -> dict[str, Any]:
        """Primary vision-first extraction. Returns field dict (missing → None)."""

    @abstractmethod
    async def extract_fields_from_text(
        self,
        ocr_text: str,
        prompt: str,
    ) -> dict[str, Any]:
        """Legacy OCR-first extraction. Kept for fallback mode."""

    @abstractmethod
    def get_provider_name(self) -> str:
        """Human-readable provider identifier (e.g. 'nano_banana')."""

    @abstractmethod
    def validate_config(self) -> bool:
        """Validate required config (API key, endpoint). Raise ValueError if missing."""
