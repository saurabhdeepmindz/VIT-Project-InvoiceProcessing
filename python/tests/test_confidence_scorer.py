"""Unit tests for ConfidenceScorer."""

from app.models.invoice_fields import InvoiceFields
from app.services.confidence_scorer import ConfidenceScorer


def _full_truth() -> dict:
    return {
        'dealer_name': True, 'customer_name': True, 'customer_mobile': True,
        'vehicle_registration_number': True, 'tyre_size': True, 'tyre_pattern': True,
        'invoice_amount_excl_gst': True, 'gst_amount': True, 'quantity': True,
        'invoice_date': True, 'invoice_number': True,
    }


def test_all_fields_present_no_ocr_gives_80():
    scorer = ConfidenceScorer()
    score = scorer.calculate(InvoiceFields(), _full_truth(), ocr_confidence=0.0)
    assert score == 80.0


def test_all_fields_plus_full_ocr_confidence_gives_100():
    scorer = ConfidenceScorer()
    score = scorer.calculate(InvoiceFields(), _full_truth(), ocr_confidence=1.0)
    assert score == 100.0


def test_zero_fields_gives_zero_plus_ocr_only():
    scorer = ConfidenceScorer()
    truth = {k: False for k in _full_truth()}
    score = scorer.calculate(InvoiceFields(), truth, ocr_confidence=0.5)
    # Field contribution 0; OCR = 0.5 * 20 = 10
    assert score == 10.0


def test_corroboration_bonus_applied_when_ocr_contains_value():
    scorer = ConfidenceScorer()
    fields = InvoiceFields(invoice_number='INV-1234')
    truth = {k: False for k in _full_truth()}
    score_without = scorer.calculate(fields, truth, ocr_confidence=0.0, ocr_text='random text')
    score_with = scorer.calculate(fields, truth, ocr_confidence=0.0, ocr_text='here is INV-1234 on the invoice')
    assert score_with > score_without


def test_multipage_consistency_bonus():
    scorer = ConfidenceScorer()
    fields = InvoiceFields(invoice_number='INV-1234')
    truth = {k: False for k in _full_truth()}
    single = scorer.calculate(fields, truth, ocr_confidence=0.0,
                              per_page_values=[{'invoice_number': 'INV-1234'}])
    double = scorer.calculate(fields, truth, ocr_confidence=0.0,
                              per_page_values=[{'invoice_number': 'INV-1234'}, {'invoice_number': 'INV-1234'}])
    assert double > single
