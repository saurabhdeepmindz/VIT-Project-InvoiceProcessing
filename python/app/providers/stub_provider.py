"""
stub_provider.py  (v3.1 — new)

Deterministic canned-response provider. Used when USE_STUB_PROVIDER=true
so the full pipeline can run without any external LLM keys.

Returns plausible dummy field values derived from the image bytes hash
so repeated calls for the same image produce identical output.

@since 3.1.0
"""

from __future__ import annotations

import hashlib
from typing import Any

from ..config.settings import Settings
from .base_provider import ILlmProvider


class StubProvider(ILlmProvider):
    """Canned-response provider. No external calls. No keys required."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def get_provider_name(self) -> str:
        return "stub"

    def validate_config(self) -> bool:
        return True

    async def extract_fields_from_image(
        self,
        image_bytes: bytes,
        prompt: str,
        *,
        mime_type: str = "image/jpeg",
    ) -> dict[str, Any]:
        return self._canned_result(image_bytes)

    async def extract_fields_from_text(
        self,
        ocr_text: str,
        prompt: str,
    ) -> dict[str, Any]:
        return self._canned_result(ocr_text.encode("utf-8"))

    @staticmethod
    def _canned_result(source: bytes) -> dict[str, Any]:
        """Produce deterministic placeholder fields keyed off source hash."""
        digest = hashlib.sha256(source).hexdigest()[:8].upper()
        return {
            "dealer_name": f"Dealer-{digest}",
            "customer_name": "Stub Customer",
            "customer_mobile": "+61400000000",
            "vehicle_registration_number": f"AB{digest[:4]}",
            "tyre_size": "205/55R16",
            "tyre_pattern": "Bridgestone Turanza T005",
            "invoice_amount_excl_gst": 400.00,
            "gst_amount": 40.00,
            "gst_components": {"GST_10": 40.00},
            "quantity": 4,
            "invoice_date": "2025-12-08",
            "invoice_number": f"INV-{digest}",
            "comments": "stub provider output — replace by setting USE_STUB_PROVIDER=false",
        }
