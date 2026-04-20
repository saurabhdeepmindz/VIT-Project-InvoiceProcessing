"""
confidence_scorer.py  (v3.1)

Weighted 0-100 confidence per LLD §3.4 + v3.1 bonuses.

Weights (sum 100): core-field presence × 80, OCR engine confidence × 20.
Bonuses:
  +5 pts if OCR text corroborates a field value (per field, up to +5 total, cap 100).
  +3 pts if identical value appears on ≥2 pages (multi-page consistency, cap 100).

@since 3.1.0
"""

from __future__ import annotations

from typing import Dict, List, Optional

from ..models.invoice_fields import InvoiceFields
from ..utils.logger import get_logger

logger = get_logger(__name__)

# Weights per LLD §3.4 — must sum to 100 (pre-OCR). Applied to the FIELD x 80% share.
FIELD_WEIGHTS: Dict[str, float] = {
    'invoice_amount_excl_gst':    15,
    'vehicle_registration_number':12,
    'invoice_date':               12,
    'dealer_name':                10,
    'customer_name':              10,
    'gst_amount':                 10,
    'customer_mobile':             8,
    'tyre_size':                   8,
    'invoice_number':              8,
    'quantity':                    6,
    'tyre_pattern':                6,
}
_FIELD_TOTAL = sum(FIELD_WEIGHTS.values())  # 105; normalise to 100

OCR_WEIGHT = 0.20       # 20% of total
FIELDS_WEIGHT = 0.80    # 80% of total
CORROBORATION_BONUS = 5.0
MULTI_PAGE_BONUS = 3.0


class ConfidenceScorer:
    """Produces the 0-100 confidence score from validated fields + signals."""

    def calculate(
        self,
        fields: InvoiceFields,
        truth_table: Dict[str, bool],
        *,
        ocr_confidence: float = 0.0,       # 0.0..1.0 average across OCR pages
        ocr_text: Optional[str] = None,
        per_page_values: Optional[List[Dict[str, object]]] = None,
    ) -> float:
        # Base field-score out of FIELDS_WEIGHT (0..80)
        achieved = 0.0
        for name, weight in FIELD_WEIGHTS.items():
            if truth_table.get(name, False):
                achieved += weight
        field_score = (achieved / _FIELD_TOTAL) * (FIELDS_WEIGHT * 100)

        # OCR share (0..20)
        ocr_score = max(0.0, min(1.0, ocr_confidence)) * (OCR_WEIGHT * 100)

        total = field_score + ocr_score

        # Corroboration bonus: up to +5 if OCR text contains extracted value
        if ocr_text:
            total = self._apply_corroboration_bonus(total, fields, ocr_text)

        # Multi-page consistency bonus
        if per_page_values and len(per_page_values) > 1:
            total = self._apply_multipage_bonus(total, fields, per_page_values)

        return max(0.0, min(100.0, round(total, 2)))

    @staticmethod
    def _apply_corroboration_bonus(score: float, fields: InvoiceFields, ocr_text: str) -> float:
        text_lower = ocr_text.lower()
        checks = [
            fields.invoice_number, fields.invoice_date, fields.vehicle_registration_number,
            fields.dealer_name, fields.customer_name,
        ]
        for v in checks:
            if v and str(v).lower() in text_lower:
                return min(100.0, score + CORROBORATION_BONUS)
        return score

    @staticmethod
    def _apply_multipage_bonus(
        score: float,
        fields: InvoiceFields,
        per_page_values: List[Dict[str, object]],
    ) -> float:
        for key in ('invoice_number', 'invoice_date', 'vehicle_registration_number'):
            hits = sum(1 for p in per_page_values if p.get(key) == getattr(fields, key))
            if hits >= 2 and getattr(fields, key) is not None:
                return min(100.0, score + MULTI_PAGE_BONUS)
        return score
