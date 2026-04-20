"""
rule_engine.py  (v3.1)

Normalises + soft-validates raw LLM field output.
v3.1: AU rego and GST reconciliation are SOFT FLAGS (warnings in comments);
never block the record.

@since 3.1.0
"""

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from ..models.invoice_fields import InvoiceFields
from ..utils.logger import get_logger

logger = get_logger(__name__)

AU_REGO_PATTERN = re.compile(r'^[A-Z0-9]{2,8}$', re.IGNORECASE)
TYRE_SIZE_PATTERN = re.compile(r'^\d{3}/\d{2}[RrBbZz]\d{2}$')
AU_MOBILE_PATTERN = re.compile(r'^\+614\d{8}$')
DATE_FORMATS = ['%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y', '%d/%m/%y', '%d %b %Y', '%d %B %Y']
GST_RATE = Decimal('0.10')
GST_TOLERANCE = Decimal('0.05')


class RuleEngine:
    """Stateless normaliser/validator. Outputs per-field truth table for the scorer."""

    def validate_and_normalize(self, raw: Dict[str, Any]) -> Tuple[InvoiceFields, Dict[str, bool], List[str]]:
        """
        Returns:
          - InvoiceFields with normalised values (None for invalid/missing)
          - per-field truth table: field_name -> was_populated_after_validation
          - list of soft-flag warnings (appended later to `comments` and `warnings`)
        """
        warnings: List[str] = []

        dealer_name   = self._s(raw.get('dealer_name'), max_len=200)
        customer_name = self._s(raw.get('customer_name'), max_len=200)
        customer_mobile = self._mobile(raw.get('customer_mobile'))
        rego, rego_warn = self._rego(raw.get('vehicle_registration_number'))
        if rego_warn:
            warnings.append(rego_warn)
        tyre_size = self._tyre_size(raw.get('tyre_size'))
        tyre_pattern = self._s(raw.get('tyre_pattern'), max_len=100)

        ex_gst = self._decimal(raw.get('invoice_amount_excl_gst'))
        gst_amt = self._decimal(raw.get('gst_amount'))
        gst_warn = self._gst_reconcile(ex_gst, gst_amt)
        if gst_warn:
            warnings.append(gst_warn)

        gst_components = self._components(raw.get('gst_components'))
        quantity = self._int(raw.get('quantity'))
        invoice_date = self._date(raw.get('invoice_date'))
        invoice_number = self._s(raw.get('invoice_number'), max_len=100)
        comments = self._s(raw.get('comments'), max_len=1000)
        if warnings:
            comments = f"{comments}\n" if comments else ''
            comments += ' | '.join(warnings)

        fields = InvoiceFields(
            dealer_name=dealer_name,
            customer_name=customer_name,
            customer_mobile=customer_mobile,
            vehicle_registration_number=rego,
            tyre_size=tyre_size,
            tyre_pattern=tyre_pattern,
            invoice_amount_excl_gst=ex_gst,
            gst_amount=gst_amt,
            gst_components=gst_components,
            quantity=quantity,
            invoice_date=invoice_date,
            invoice_number=invoice_number,
            comments=comments,
        )

        truth = {
            'dealer_name': dealer_name is not None,
            'customer_name': customer_name is not None,
            'customer_mobile': customer_mobile is not None,
            'vehicle_registration_number': rego is not None,
            'tyre_size': tyre_size is not None,
            'tyre_pattern': tyre_pattern is not None,
            'invoice_amount_excl_gst': ex_gst is not None,
            'gst_amount': gst_amt is not None,
            'quantity': quantity is not None,
            'invoice_date': invoice_date is not None,
            'invoice_number': invoice_number is not None,
        }
        return fields, truth, warnings

    # ── field validators ──────────────────────────────────────────────

    @staticmethod
    def _s(value: Any, *, max_len: int) -> Optional[str]:
        if value is None:
            return None
        s = str(value).strip()
        if not s:
            return None
        return s[:max_len]

    @staticmethod
    def _mobile(value: Any) -> Optional[str]:
        if value is None:
            return None
        raw = re.sub(r'[^\d+]', '', str(value))
        if not raw:
            return None
        if raw.startswith('+61') and len(raw) == 12:
            return raw
        if raw.startswith('61') and len(raw) == 11:
            return f'+{raw}'
        if raw.startswith('04') and len(raw) == 10:
            return f'+61{raw[1:]}'
        if raw.startswith('4') and len(raw) == 9:
            return f'+61{raw}'
        return None

    def _rego(self, value: Any) -> Tuple[Optional[str], Optional[str]]:
        if value is None:
            return None, None
        s = str(value).strip().upper().replace(' ', '')
        if not s:
            return None, None
        if not AU_REGO_PATTERN.match(s):
            return s, f'rego "{s}" does not match AU format — soft flag only'
        return s, None

    @staticmethod
    def _tyre_size(value: Any) -> Optional[str]:
        if value is None:
            return None
        s = str(value).strip().upper().replace(' ', '')
        if not s:
            return None
        return s if TYRE_SIZE_PATTERN.match(s) else s  # keep raw even if format off

    @staticmethod
    def _decimal(value: Any) -> Optional[Decimal]:
        if value is None:
            return None
        try:
            raw = re.sub(r'[^\d.\-]', '', str(value))
            if not raw:
                return None
            d = Decimal(raw).quantize(Decimal('0.01'))
            return d if d >= 0 else None
        except (InvalidOperation, ValueError):
            return None

    @staticmethod
    def _int(value: Any) -> Optional[int]:
        if value is None:
            return None
        try:
            n = int(float(str(value)))
            return n if n > 0 else None
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _components(value: Any) -> Optional[Dict[str, Any]]:
        if value is None:
            return None
        return value if isinstance(value, dict) and value else None

    def _date(self, value: Any) -> Optional[str]:
        if value is None:
            return None
        s = str(value).strip()
        if not s:
            return None
        for fmt in DATE_FORMATS:
            try:
                return datetime.strptime(s, fmt).date().isoformat()
            except ValueError:
                continue
        return None

    @staticmethod
    def _gst_reconcile(ex_gst: Optional[Decimal], gst_amt: Optional[Decimal]) -> Optional[str]:
        if ex_gst is None or gst_amt is None:
            return None
        if ex_gst == 0:
            return None
        expected = (ex_gst * GST_RATE).quantize(Decimal('0.01'))
        diff = abs(gst_amt - expected)
        tolerance = (expected * GST_TOLERANCE).quantize(Decimal('0.01'))
        if diff > tolerance:
            return f'GST mismatch: {gst_amt} vs expected {expected} (±{tolerance}) — soft flag'
        return None
