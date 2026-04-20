"""
@file   preprocessing_router.py
@module routers
@description
    FastAPI router for batch preprocessing endpoints.
    Called by NestJS PreprocessingService to trigger Python-side
    image validation and metadata extraction.

EPIC: EPIC-003 — Data Preprocessing & Validation
User Story: Integration — scheduler triggers preprocessing pipeline.

@author  Invoice Processing Platform Engineering
@version 1.0.0
@since   2025-01-01
"""

from fastapi import APIRouter, BackgroundTasks, status
from pydantic import BaseModel
from typing import Optional

from ..config.settings import Settings
from ..utils.logger    import get_logger

logger   = get_logger(__name__)
router   = APIRouter()
settings = Settings()


class PreprocessBatchRequest(BaseModel):
    """
    Request body for batch preprocessing endpoint.

    EPIC: EPIC-003 | Integration Request
    Attributes:
        batch_id:  UUID of the InvoiceBatch to preprocess.
        csv_path:  Storage path to the uploaded CSV file.
        image_dir: Storage prefix/directory containing invoice images.
    """
    batch_id:  str
    csv_path:  str
    image_dir: str


class PreprocessBatchResponse(BaseModel):
    """
    EPIC: EPIC-003 | Integration Response
    Attributes:
        batch_id:  UUID echoed back.
        status:    'ACCEPTED' when job queued successfully.
        message:   Human-readable confirmation.
    """
    batch_id:  str
    status:    str
    message:   str


@router.post(
    "/batch",
    response_model=PreprocessBatchResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Submit batch for preprocessing validation — EPIC-003",
)
async def preprocess_batch(
    request: PreprocessBatchRequest,
    background_tasks: BackgroundTasks,
) -> PreprocessBatchResponse:
    """
    Accepts a preprocessing request and runs it as a background task.

    EPIC: EPIC-003 | User Story: Backend Integration — Preprocessing
    Acceptance: "Batch executes; data passed correctly; failures handled"

    @param request:          PreprocessBatchRequest with batch_id, csv_path, image_dir.
    @param background_tasks: FastAPI BackgroundTasks for async execution.
    @return: PreprocessBatchResponse confirming acceptance.
    @raises HTTPException 400: On invalid request parameters.
    """
    # TODO: from ..services.preprocessing_service import PreprocessingService
    # TODO: service = PreprocessingService(settings.STORAGE_BASE_PATH)
    # TODO: background_tasks.add_task(service.process_batch, request.batch_id, request.csv_path, request.image_dir)
    # TODO: logger.info(f"Preprocessing queued for batch: {request.batch_id}")
    # TODO: return PreprocessBatchResponse(batch_id=request.batch_id, status='ACCEPTED', message='Preprocessing started')
    raise NotImplementedError


@router.get(
    "/batch/{batch_id}/status",
    summary="Get preprocessing status — EPIC-003",
)
async def get_preprocessing_status(batch_id: str) -> dict:
    """
    Returns current preprocessing status for a batch.

    EPIC: EPIC-003 | Status Check
    @param batch_id: UUID of the InvoiceBatch.
    @return: Dict with status and counts.
    """
    # TODO: return {"batch_id": batch_id, "status": "DONE", "processed_count": 0, "error_count": 0}
    raise NotImplementedError
