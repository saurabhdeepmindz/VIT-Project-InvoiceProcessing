"""
eda_router.py  (v3.1)

POST /eda/extract — JSON body: { record_id, image_b64, mime_type? }
Returns an ExtractionResult dict.

@since 3.1.0
"""

from __future__ import annotations

import base64
import binascii
from functools import lru_cache

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from ..config.settings import get_settings
from ..models.invoice_fields import ExtractionResult
from ..services.extraction_service import ExtractionService
from ..utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


class ExtractRequest(BaseModel):
    record_id: str = Field(..., description='UUID of the invoice_record')
    image_b64: str = Field(..., description='Base64-encoded image or PDF bytes')
    mime_type: str = Field('image/jpeg', description='image/jpeg | image/png | application/pdf')


@lru_cache(maxsize=1)
def _service() -> ExtractionService:
    return ExtractionService(get_settings())


@router.post('/extract', response_model=ExtractionResult)
async def extract(req: ExtractRequest) -> ExtractionResult:
    try:
        image_bytes = base64.b64decode(req.image_b64, validate=True)
    except (binascii.Error, ValueError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f'invalid base64: {e}')

    if not image_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='empty image_bytes')

    logger.info(f'Extract request: record={req.record_id} size={len(image_bytes)} mime={req.mime_type}')
    return await _service().extract(
        record_id=req.record_id,
        image_bytes=image_bytes,
        mime_type=req.mime_type,
    )


@router.get('/provider')
async def provider_info() -> dict:
    s = _service()
    return {'provider': s.provider_name, 'use_stub': get_settings().USE_STUB_PROVIDER}
