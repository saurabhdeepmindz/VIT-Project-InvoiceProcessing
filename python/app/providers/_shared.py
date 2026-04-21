"""
_shared.py  (v3.1)

Shared prompt + JSON-response utilities used by every concrete LLM provider.

The response parser is intentionally tolerant — real-world model output
frequently includes Markdown fences, commentary preambles, or trailing
commas, and we want a single place to normalise all of that rather than
repeating the logic in each provider.

@since 3.1.0
"""

from __future__ import annotations

import json
import re
from typing import Any

from ..exceptions.exceptions import LlmProviderException


VISION_SYSTEM_PROMPT = """You are a precise invoice data extraction assistant for
Australian automotive tyre invoices. Extract the fields below from the
attached invoice image and return them as a single JSON object.

RULES:
- If a field is not present, set it to null. Do NOT guess or infer.
- Return ONLY a valid JSON object. No markdown, no prose, no code fences.
- invoice_date MUST use YYYY-MM-DD format.
- customer_mobile MUST use E.164 format (+61XXXXXXXXX for Australian numbers).
- Monetary amounts MUST be numbers only (no $ symbol, no thousands separator).
- gst_components is a JSON object keyed by component name (e.g. {"GST_10": 40.0}).

Fields:
{
  "dealer_name":                   string | null,
  "customer_name":                 string | null,
  "customer_mobile":               string | null,
  "vehicle_registration_number":   string | null,
  "tyre_size":                     string | null,
  "tyre_pattern":                  string | null,
  "invoice_amount_excl_gst":       number | null,
  "gst_amount":                    number | null,
  "gst_components":                object | null,
  "quantity":                      integer | null,
  "invoice_date":                  string | null,
  "invoice_number":                string | null,
  "comments":                      string | null
}"""


TEXT_USER_PROMPT_TEMPLATE = (
    "OCR text from invoice:\n---\n{ocr_text}\n---\n"
    "Return ONLY the JSON object with the fields above."
)

IMAGE_USER_PROMPT = (
    "Extract the invoice fields defined in the system instructions from the "
    "attached image. Return ONLY the JSON object."
)


_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE | re.MULTILINE)


def parse_json_response(raw: str, *, provider: str) -> dict[str, Any]:
    """Coerce provider output into a dict. Raises LlmProviderException on failure.

    Handles:
      * ```json ... ``` and ``` ... ``` fences
      * leading/trailing whitespace
      * stray prose before/after the JSON object
      * trailing commas (lenient fallback)
    """
    if raw is None:
        raise LlmProviderException(provider, 0, "empty response from LLM")
    text = raw.strip()
    if not text:
        raise LlmProviderException(provider, 0, "empty response from LLM")

    # Strip fences if present.
    text = _FENCE_RE.sub("", text).strip()

    try:
        return _as_dict(json.loads(text), provider)
    except json.JSONDecodeError:
        pass

    # Fall back: locate the first balanced {...} block.
    extracted = _extract_first_json_object(text)
    if extracted is None:
        raise LlmProviderException(
            provider, 0, f"no JSON object found in response: {text[:200]!r}"
        )
    try:
        return _as_dict(json.loads(extracted), provider)
    except json.JSONDecodeError:
        # Lenient retry with trailing-comma cleanup.
        cleaned = re.sub(r",\s*([}\]])", r"\1", extracted)
        try:
            return _as_dict(json.loads(cleaned), provider)
        except json.JSONDecodeError as exc:
            raise LlmProviderException(
                provider, 0, f"invalid JSON in LLM response: {exc.msg}"
            ) from exc


def _as_dict(value: Any, provider: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise LlmProviderException(
            provider, 0, f"expected JSON object, got {type(value).__name__}"
        )
    return value


def _extract_first_json_object(text: str) -> str | None:
    """Return the first {...}-delimited substring with balanced braces, else None."""
    depth = 0
    start = -1
    in_string = False
    escape = False
    for i, ch in enumerate(text):
        if escape:
            escape = False
            continue
        if ch == "\\" and in_string:
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            if depth > 0:
                depth -= 1
                if depth == 0 and start >= 0:
                    return text[start : i + 1]
    return None
