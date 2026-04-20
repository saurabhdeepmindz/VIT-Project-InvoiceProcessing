"""Unit tests for RuleEngine normalisation + soft-flag rules."""

from decimal import Decimal
from app.services.rule_engine import RuleEngine


def test_normalises_full_valid_record():
    engine = RuleEngine()
    raw = {
        'dealer_name': '  Bridgestone Select Tyres  ',
        'customer_name': 'Jane Doe',
        'customer_mobile': '0412 345 678',
        'vehicle_registration_number': 'abc123',
        'tyre_size': '205/55R16',
        'tyre_pattern': 'Turanza T005',
        'invoice_amount_excl_gst': '$400.50',
        'gst_amount': 40.05,
        'quantity': '4',
        'invoice_date': '08/12/2025',
        'invoice_number': 'INV-1234',
    }
    fields, truth, warnings = engine.validate_and_normalize(raw)
    assert fields.dealer_name == 'Bridgestone Select Tyres'
    assert fields.customer_mobile == '+61412345678'          # converted from 0412…
    assert fields.vehicle_registration_number == 'ABC123'    # upper-cased
    assert fields.invoice_amount_excl_gst == Decimal('400.50')
    assert fields.gst_amount == Decimal('40.05')
    assert fields.invoice_date == '2025-12-08'                # DD/MM/YYYY -> ISO
    assert all(truth[f] for f in [
        'dealer_name', 'customer_name', 'customer_mobile',
        'vehicle_registration_number', 'tyre_size', 'tyre_pattern',
        'invoice_amount_excl_gst', 'gst_amount', 'quantity',
        'invoice_date', 'invoice_number',
    ])
    assert warnings == []


def test_gst_reconciliation_soft_flag():
    engine = RuleEngine()
    # 400 * 10% = 40.00; tolerance 5% of 40 = 2.00. gst_amt = 50 differs by 10 → flag
    fields, _, warnings = engine.validate_and_normalize({
        'invoice_amount_excl_gst': '400.00',
        'gst_amount': '50.00',
    })
    assert any('GST mismatch' in w for w in warnings)
    # Warning appended to comments
    assert fields.comments is not None
    assert 'GST mismatch' in fields.comments


def test_rego_soft_flag_on_bad_format():
    engine = RuleEngine()
    fields, truth, warnings = engine.validate_and_normalize({
        'vehicle_registration_number': 'TOO-LONG-REGO-STRING-12345',   # fails [A-Z0-9]{2,8}
    })
    # rego kept (soft flag, not rejected)
    assert fields.vehicle_registration_number is not None
    assert any('rego' in w.lower() for w in warnings)
    assert truth['vehicle_registration_number'] is True


def test_mobile_variants():
    engine = RuleEngine()
    for raw_val, expected in [
        ('0412345678', '+61412345678'),
        ('+61412345678', '+61412345678'),
        ('61412345678', '+61412345678'),
        ('412345678', '+61412345678'),
        ('not-a-number', None),
    ]:
        fields, _, _ = engine.validate_and_normalize({'customer_mobile': raw_val})
        assert fields.customer_mobile == expected, f'raw={raw_val} got {fields.customer_mobile}'


def test_date_formats():
    engine = RuleEngine()
    for raw_val, expected in [
        ('2025-12-08', '2025-12-08'),
        ('08/12/2025', '2025-12-08'),
        ('08-12-2025', '2025-12-08'),
        ('not a date', None),
    ]:
        fields, _, _ = engine.validate_and_normalize({'invoice_date': raw_val})
        assert fields.invoice_date == expected


def test_rejects_negative_amount():
    engine = RuleEngine()
    fields, _, _ = engine.validate_and_normalize({
        'invoice_amount_excl_gst': '-100.00',
    })
    assert fields.invoice_amount_excl_gst is None
