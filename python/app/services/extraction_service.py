"""
extraction_service.py  (v3.1)

Vision-first orchestrator. Pipeline:
  1. If PDF bytes → render pages via PdfService; else single-page list.
  2. Per page: LLM.extract_fields_from_image(bytes, prompt).
  3. Per page: OCR text (corroboration only, optional).
  4. Merge multi-page results.
  5. RuleEngine normalise + soft-flag.
  6. ConfidenceScorer weighted score + bonuses.
  7. Return ExtractionResult.

@since 3.1.0
"""

from __future__ import annotations

from typing import List

from ..config.settings import Settings
from ..models.invoice_fields import ExtractionResult, InvoiceFields
from ..providers.base_provider import ILlmProvider
from ..providers.provider_factory import LlmProviderFactory
from ..utils.logger import get_logger
from .confidence_scorer import ConfidenceScorer
from .multi_page_merger import merge_pages
from .ocr_service import OcrService, OcrPage
from .pdf_service import looks_like_pdf, render_pdf_pages
from .rule_engine import RuleEngine

logger = get_logger(__name__)

EXTRACTION_PROMPT = (
    'You are a precise invoice data extraction assistant for Australian '
    'automotive tyre invoices. Extract the following fields as JSON only '
    '(no markdown, no explanation):\n'
    'dealer_name, customer_name, customer_mobile, vehicle_registration_number, '
    'tyre_size, tyre_pattern, invoice_amount_excl_gst, gst_amount, gst_components, '
    'quantity, invoice_date (YYYY-MM-DD), invoice_number, comments.\n'
    'Set missing fields to null. Return ONLY valid JSON.'
)


class ExtractionService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._provider: ILlmProvider = LlmProviderFactory.create(settings)
        self._rules = RuleEngine()
        self._scorer = ConfidenceScorer()
        self._ocr = OcrService(settings)

    @property
    def provider_name(self) -> str:
        return self._provider.get_provider_name()

    async def extract(
        self,
        *,
        record_id: str,
        image_bytes: bytes,
        mime_type: str = 'image/jpeg',
    ) -> ExtractionResult:
        try:
            page_images = self._split_pages(image_bytes)
            if not page_images:
                return self._failed(record_id, 'No pages to extract (empty or unreadable bytes)')

            page_mime = 'image/png' if looks_like_pdf(image_bytes) else mime_type
            per_page_raw: List[dict] = []
            for page_bytes in page_images:
                raw = await self._provider.extract_fields_from_image(
                    image_bytes=page_bytes, prompt=EXTRACTION_PROMPT, mime_type=page_mime,
                )
                per_page_raw.append(raw or {})

            ocr_pages: List[OcrPage] = self._ocr.extract_pages(page_images)
            ocr_text = OcrService.combined_text(ocr_pages)
            ocr_conf = OcrService.average_confidence(ocr_pages)

            merged_raw = merge_pages(per_page_raw)
            fields, truth, warnings = self._rules.validate_and_normalize(merged_raw)
            score = self._scorer.calculate(
                fields, truth,
                ocr_confidence=ocr_conf,
                ocr_text=ocr_text,
                per_page_values=per_page_raw,
            )
            populated = sum(1 for v in truth.values() if v)
            status = 'EXTRACTED' if populated >= 8 else ('PARTIAL' if populated >= 3 else 'FAILED')

            return ExtractionResult(
                record_id=record_id,
                fields=fields,
                confidence_score=score,
                status=status,
                llm_provider_used=self.provider_name,
                raw_llm_response={'pages': per_page_raw, 'merged': merged_raw},
                ocr_text=ocr_text,
                warnings=warnings,
            )
        except Exception as e:  # noqa: BLE001
            logger.error(f'Extraction failed for record {record_id}: {e}', exc_info=True)
            return self._failed(record_id, str(e))

    def _split_pages(self, image_bytes: bytes) -> List[bytes]:
        if not image_bytes:
            return []
        if looks_like_pdf(image_bytes):
            pages = render_pdf_pages(image_bytes)
            return pages if pages else []
        return [image_bytes]

    def _failed(self, record_id: str, message: str) -> ExtractionResult:
        return ExtractionResult(
            record_id=record_id,
            fields=InvoiceFields(),
            confidence_score=0.0,
            status='FAILED',
            llm_provider_used=self.provider_name,
            error_message=message,
        )
