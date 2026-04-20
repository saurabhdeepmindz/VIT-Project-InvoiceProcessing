"""
settings.py  (v3.1)

Typed application settings loaded from .env via pydantic-settings.
Covers:
  - FastAPI runtime config
  - LLM provider selection (+ USE_STUB_PROVIDER toggle, v3.1)
  - OCR engine
  - Vision-first extraction mode (v3.1)
  - Image download caps (v3.1)

@since 3.1.0
"""

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Runtime ──────────────────────────────────────────────────────
    APP_ENV: str = "development"
    PYTHON_APP_PORT: int = 8001
    PYTHON_LOG_LEVEL: str = "info"
    PYTHON_LOG_FORMAT: str = "pretty"
    PYTHON_ENABLE_DOCS: bool = True
    PYTHON_ALLOWED_ORIGINS: List[str] = ["http://localhost:3001"]

    # ── LLM Provider (Modular) ──────────────────────────────────────
    LLM_PROVIDER: str = "nano_banana"
    USE_STUB_PROVIDER: bool = True              # v3.1: overrides LLM_PROVIDER when true

    # Nano Banana
    NB_API_KEY: str = ""
    NB_API_BASE: str = "https://api.nanobanana.ai/v1"
    NB_MODEL: str = "nano-banana-large"
    NB_MAX_TOKENS: int = 2048
    NB_TEMPERATURE: float = 0.0

    # OpenAI
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o"
    OPENAI_MAX_TOKENS: int = 2048
    OPENAI_TEMPERATURE: float = 0.0

    # Anthropic
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-sonnet-4-6"
    ANTHROPIC_MAX_TOKENS: int = 2048

    # Azure OpenAI
    AZURE_OPENAI_API_KEY: str = ""
    AZURE_OPENAI_ENDPOINT: str = ""
    AZURE_OPENAI_DEPLOYMENT: str = ""
    AZURE_OPENAI_API_VERSION: str = "2024-10-21"

    # ── OCR ──────────────────────────────────────────────────────────
    OCR_PROVIDER: str = "tesseract"             # tesseract | azure_cv | none
    OCR_MIN_CONFIDENCE: float = 0.5
    TESSERACT_CMD: str = ""
    AZURE_CV_KEY: str = ""
    AZURE_CV_ENDPOINT: str = ""

    # ── v3.1: Extraction Mode ──────────────────────────────────────
    EXTRACTION_MODE: str = "vision_first"       # vision_first | ocr_first

    # ── v3.1: Image download caps ──────────────────────────────────
    IMG_MAX_DOWNLOAD_MB: int = 30
    IMG_DOWNLOAD_TIMEOUT_MS: int = 180_000
    IMG_DOWNLOAD_RETRY: int = 3

    # ── Batch ───────────────────────────────────────────────────────
    BATCH_MAX_CONCURRENT: int = 5
    BATCH_RETRY_ATTEMPTS: int = 3
    BATCH_RETRY_DELAY_MS: int = 2000


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
