"""
multi_page_merger.py  (v3.1)

Merges per-page extraction dicts into one field map.
Rule: pick first non-None value per field across pages, prefer longer strings.
Lists (line items) concatenated in page order.
"""

from typing import Any, Dict, List


SCALAR_FIELDS = [
    'dealer_name', 'customer_name', 'customer_mobile',
    'vehicle_registration_number', 'tyre_size', 'tyre_pattern',
    'invoice_amount_excl_gst', 'gst_amount', 'quantity',
    'invoice_date', 'invoice_number',
]


def merge_pages(pages: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not pages:
        return {}
    if len(pages) == 1:
        return pages[0]

    merged: Dict[str, Any] = {}
    for field in SCALAR_FIELDS:
        merged[field] = _pick_best(field, pages)

    # comments concatenated across pages
    comments = [str(p.get('comments', '')).strip() for p in pages if p.get('comments')]
    merged['comments'] = ' | '.join([c for c in comments if c]) or None

    # gst_components: merge dicts (first-wins on key collision)
    gst_merged: Dict[str, Any] = {}
    for p in pages:
        comp = p.get('gst_components')
        if isinstance(comp, dict):
            for k, v in comp.items():
                gst_merged.setdefault(k, v)
    merged['gst_components'] = gst_merged or None

    return merged


def _pick_best(field: str, pages: List[Dict[str, Any]]) -> Any:
    candidates = [p.get(field) for p in pages if p.get(field) is not None]
    if not candidates:
        return None
    # Prefer the longest string (often has the full value when pages clip text)
    if all(isinstance(c, str) for c in candidates):
        return max(candidates, key=len)
    return candidates[0]
