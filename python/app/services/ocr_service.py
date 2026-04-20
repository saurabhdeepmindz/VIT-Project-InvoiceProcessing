"""
ocr_service.py  (v3.1)

Optional Tesseract wrapper. In v3.1 vision-first mode, OCR is a
CORROBORATION signal only — if unavailable, extraction still succeeds.

Setting OCR_PROVIDER=none skips OCR entirely.

@since 3.1.0
"""

from __future__ import annotations

import io
from dataclasses import dataclass
from typing import List, Optional

from ..config.settings import Settings
from ..utils.logger import get_logger

logger = get_logger(__name__)


@dataclass(frozen=True)
class OcrPage:
    text: str
    confidence: float  # 0.0..1.0


class OcrService:
    def __init__(self, settings: Settings) -> None:
        self._provider = (settings.OCR_PROVIDER or 'none').lower()
        self._min_conf = max(0.0, float(settings.OCR_MIN_CONFIDENCE))
        self._tesseract_cmd = settings.TESSERACT_CMD

    def enabled(self) -> bool:
        return self._provider not in ('none', '', 'off', 'false')

    def extract_pages(self, page_images: List[bytes]) -> List[OcrPage]:
        """One OcrPage per input image. Returns empty list when disabled/unavailable."""
        if not self.enabled():
            return []
        if self._provider == 'tesseract':
            return self._run_tesseract(page_images)
        logger.warning(f'OCR provider "{self._provider}" not supported; skipping')
        return []

    def _run_tesseract(self, page_images: List[bytes]) -> List[OcrPage]:
        try:
            import pytesseract                   # type: ignore
            from PIL import Image                 # type: ignore
        except ImportError:
            logger.warning('pytesseract / Pillow not installed; skipping OCR')
            return []

        if self._tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = self._tesseract_cmd

        results: List[OcrPage] = []
        for idx, data in enumerate(page_images):
            try:
                img = Image.open(io.BytesIO(data))
                data_dict = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
                text = ' '.join(t for t in data_dict.get('text', []) if t and t.strip())
                confs = [int(c) for c in data_dict.get('conf', []) if str(c).lstrip('-').isdigit() and int(c) >= 0]
                conf = (sum(confs) / len(confs) / 100.0) if confs else 0.0
                results.append(OcrPage(text=text, confidence=conf))
            except Exception as e:  # noqa: BLE001
                logger.warning(f'Tesseract failed on page {idx}: {e}')
                results.append(OcrPage(text='', confidence=0.0))
        return results

    @staticmethod
    def combined_text(pages: List[OcrPage]) -> Optional[str]:
        text = '\n'.join(p.text for p in pages if p.text).strip()
        return text or None

    @staticmethod
    def average_confidence(pages: List[OcrPage]) -> float:
        if not pages:
            return 0.0
        return sum(p.confidence for p in pages) / len(pages)
