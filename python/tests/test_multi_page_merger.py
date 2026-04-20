"""Unit tests for MultiPageMerger."""

from app.services.multi_page_merger import merge_pages


def test_merge_empty():
    assert merge_pages([]) == {}


def test_merge_single_page_returns_itself():
    p = {'dealer_name': 'X', 'quantity': 4}
    assert merge_pages([p]) is p


def test_merge_picks_first_non_null_per_field():
    pages = [
        {'dealer_name': None, 'invoice_number': 'INV-1'},
        {'dealer_name': 'Bridgestone', 'invoice_number': None},
    ]
    merged = merge_pages(pages)
    assert merged['dealer_name'] == 'Bridgestone'
    assert merged['invoice_number'] == 'INV-1'


def test_merge_prefers_longer_string():
    pages = [
        {'dealer_name': 'Bridgestone'},
        {'dealer_name': 'Bridgestone Select Tyres Pty Ltd'},
    ]
    merged = merge_pages(pages)
    assert merged['dealer_name'] == 'Bridgestone Select Tyres Pty Ltd'


def test_merge_concatenates_comments():
    pages = [{'comments': 'buyback'}, {'comments': 'exchange'}]
    merged = merge_pages(pages)
    assert 'buyback' in merged['comments']
    assert 'exchange' in merged['comments']


def test_merge_combines_gst_components():
    pages = [
        {'gst_components': {'GST_10': 40}},
        {'gst_components': {'GST_5': 10}},
    ]
    merged = merge_pages(pages)
    assert merged['gst_components'] == {'GST_10': 40, 'GST_5': 10}
