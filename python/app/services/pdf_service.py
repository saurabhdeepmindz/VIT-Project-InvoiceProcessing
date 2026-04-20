"""
pdf_service.py  (v3.1)

Renders PDF bytes to per-page PNG bytes using pypdfium2.
Used by ExtractionService when the record is a PDF (multi-page invoice).

@since 3.1.0
"""

from __future__ import annotations

import io
from typing import List, Optional

from ..utils.logger import get_logger

logger = get_logger(__name__)

PDF_MAGIC = b'%PDF-'
DEFAULT_DPI = 144


def looks_like_pdf(bytes_: bytes) -> bool:
    return PDF_MAGIC in bytes_[:1024]


def render_pdf_pages(pdf_bytes: bytes, *, dpi: int = DEFAULT_DPI, max_pages: Optional[int] = None) -> List[bytes]:
    """Returns a list of PNG bytes, one per page. Empty list if PDF can't be opened."""
    try:
        import pypdfium2 as pdfium
    except ImportError:  # pragma: no cover
        logger.warning('pypdfium2 not installed; skipping PDF render')
        return []

    try:
        doc = pdfium.PdfDocument(pdf_bytes)
    except Exception as e:  # noqa: BLE001
        logger.error(f'PDF open failed: {e}')
        return []

    try:
        n = len(doc) if max_pages is None else min(len(doc), max_pages)
        scale = dpi / 72.0  # 72 DPI is the PDF default
        pages: List[bytes] = []
        for i in range(n):
            pil_image = doc[i].render(scale=scale).to_pil()
            buf = io.BytesIO()
            pil_image.save(buf, format='PNG')
            pages.append(buf.getvalue())
        return pages
    finally:
        doc.close()
