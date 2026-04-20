"""
@file   exceptions.py
@module exceptions
@description
    Custom exception classes for the Python AI microservice.
    All exceptions include structured context for the global
    exception handler in main.py to produce consistent JSON error responses.

EPIC: EPIC-003 (PreprocessingException), EPIC-004 (OcrException,
      ExtractionException, LlmProviderException)

@author  Invoice Processing Platform Engineering
@version 1.0.0
@since   2025-01-01
"""


class OcrException(Exception):
    """
    Raised when OCR processing fails for an invoice image.

    EPIC: EPIC-004 — OCR Stage Failure
    Attributes:
        image_path:  Path to the failing image.
        engine:      OCR engine name: 'tesseract' or 'azure_cv'.
        code:        Machine-readable error code: 'OCR_ERROR'.
    """

    def __init__(self, image_path: str, engine: str, message: str):
        """
        EPIC: EPIC-004 | OCR Exception
        @param image_path: Path to the invoice image that failed.
        @param engine:     OCR engine name.
        @param message:    Descriptive error message.
        """
        self.image_path = image_path
        self.engine     = engine
        self.code       = "OCR_ERROR"
        super().__init__(message)


class ExtractionException(Exception):
    """
    Raised when invoice field extraction encounters an unrecoverable failure.

    EPIC: EPIC-004 — EDA Extraction Failure
    Attributes:
        record_id: UUID of the failing InvoiceRecord.
        stage:     Pipeline stage: 'ocr', 'llm', 'rule_engine'.
        code:      'EXTRACTION_ERROR'.
    """

    def __init__(self, record_id: str, stage: str, message: str):
        """
        EPIC: EPIC-004 | Extraction Exception
        @param record_id: UUID of the InvoiceRecord.
        @param stage:     Processing stage where failure occurred.
        @param message:   Descriptive error message.
        """
        self.record_id = record_id
        self.stage     = stage
        self.code      = "EXTRACTION_ERROR"
        super().__init__(message)


class LlmProviderException(Exception):
    """
    Raised when the configured LLM provider API returns an error or is unavailable.

    EPIC: EPIC-004 — LLM API Failure
    Attributes:
        provider:    LLM provider name: 'nano_banana', 'openai', etc.
        status_code: HTTP status from the provider API response.
        code:        'LLM_PROVIDER_ERROR'.
    """

    def __init__(self, provider: str, status_code: int, message: str):
        """
        EPIC: EPIC-004 | LLM Provider Exception
        @param provider:    Provider identifier string.
        @param status_code: HTTP status code from provider API.
        @param message:     Descriptive error message.
        """
        self.provider    = provider
        self.status_code = status_code
        self.code        = "LLM_PROVIDER_ERROR"
        super().__init__(message)


class PreprocessingException(Exception):
    """
    Raised when the batch preprocessing pipeline encounters a critical failure.

    EPIC: EPIC-003 — Preprocessing Pipeline Failure
    Attributes:
        batch_id: UUID of the InvoiceBatch being processed.
        code:     'PREPROCESSING_ERROR'.
    """

    def __init__(self, batch_id: str, message: str):
        """
        EPIC: EPIC-003 | Preprocessing Exception
        @param batch_id: UUID of the failing batch.
        @param message:  Descriptive error message.
        """
        self.batch_id = batch_id
        self.code     = "PREPROCESSING_ERROR"
        super().__init__(message)


class ImageQualityException(OcrException):
    """
    Raised when image quality is too poor for reliable OCR.
    Extends OcrException with DPI context.

    EPIC: EPIC-004 — Low Quality Image Detection
    Attributes:
        detected_dpi:    DPI detected in the image.
        min_required_dpi: Minimum acceptable DPI (default 150).
    """

    def __init__(self, image_path: str, detected_dpi: int, min_required_dpi: int = 150):
        """
        EPIC: EPIC-004 | Image Quality Exception
        @param image_path:       Path to the low-quality image.
        @param detected_dpi:     Detected DPI value.
        @param min_required_dpi: Minimum acceptable DPI threshold.
        """
        self.detected_dpi     = detected_dpi
        self.min_required_dpi = min_required_dpi
        self.code             = "IMAGE_QUALITY_TOO_LOW"
        msg = (
            f"Image DPI {detected_dpi} is below minimum {min_required_dpi} DPI "
            f"required for reliable OCR. Image: {image_path}"
        )
        super().__init__(image_path, "n/a", msg)
