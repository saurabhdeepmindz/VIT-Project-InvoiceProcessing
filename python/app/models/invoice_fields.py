"""
invoice_fields.py  (v3.1)

Structured field + result models for the EDA extraction pipeline.

EPIC: EPIC-004 — Automated Invoice Data Extraction
"""

from decimal import Decimal
from typing import Optional, Dict, Any, List

from pydantic import BaseModel, ConfigDict


class InvoiceFields(BaseModel):
    """13 canonical fields per LLD §3.2. All Optional — missing = None."""

    model_config = ConfigDict(json_encoders={Decimal: str})

    dealer_name:                   Optional[str] = None
    customer_name:                 Optional[str] = None
    customer_mobile:               Optional[str] = None         # E.164 (+61…)
    vehicle_registration_number:   Optional[str] = None
    tyre_size:                     Optional[str] = None         # e.g. 205/55R16
    tyre_pattern:                  Optional[str] = None
    invoice_amount_excl_gst:       Optional[Decimal] = None     # 2dp
    gst_amount:                    Optional[Decimal] = None     # 2dp
    gst_components:                Optional[Dict[str, Any]] = None
    quantity:                      Optional[int] = None
    invoice_date:                  Optional[str] = None         # ISO 8601 (YYYY-MM-DD)
    invoice_number:                Optional[str] = None
    comments:                      Optional[str] = None


class ExtractionResult(BaseModel):
    """
    Full extraction result per invoice_record, returned by /eda/extract.

    v3.1 additions: ocr_text (corroboration signal), warnings (soft-flags from
    rule engine — GST mismatch, rego format, etc.).
    """

    record_id:         str
    fields:            Optional[InvoiceFields] = None
    confidence_score:  float = 0.0
    status:            str = 'PENDING'          # EXTRACTED | PARTIAL | FAILED
    llm_provider_used: str = 'unknown'
    raw_llm_response:  Optional[Dict[str, Any]] = None
    ocr_text:          Optional[str] = None
    warnings:          List[str] = []
    error_message:     Optional[str] = None
