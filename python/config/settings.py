"""
@file   settings.py
@module config
@description
    Application settings loaded from environment variables via pydantic-settings.
    Covers all configuration for the Python AI microservice including LLM provider
    selection, OCR engine choice, storage, and logging.

EPIC: EPIC-004 — Automated Invoice Data Extraction (EDA)
Supports modular LLM provider swap via LLM_PROVIDER env variable.

@author  Invoice Processing Platform Engineering
@version 1.0.0
@since   2025-01-01
"""

from pydantic_settings import BaseSettings
from typing import List, Optional


class Settings(BaseSettings):
    """
    Complete application configuration for the Python AI service.
    All values are loaded from environment variables or .env file.

    EPIC: EPIC-004 — Modular LLM Provider Configuration
    Change LLM_PROVIDER in .env to swap between Nano Banana, OpenAI, Anthropic, etc.
    """

    # ─── Application ─────────────────────────────────────────────────
    APP_ENV: str = "development"
    PYTHON_APP_PORT: int = 8001
    PYTHON_LOG_LEVEL: str = "info"
    PYTHON_ENABLE_DOCS: bool = True
    PYTHON_ALLOWED_ORIGINS: List[str] = ["http://localhost:3001"]

    # ─── LLM Provider (Modular) ───────────────────────────────────────
    LLM_PROVIDER: str = "nano_banana"   # nano_banana | openai | anthropic | azure_openai

    # Nano Banana (default)
    NB_API_KEY: str = ""
    NB_API_BASE: str = "https://api.nanobanana.ai/v1"
    NB_MODEL: str = "nano-banana-large"
    NB_MAX_TOKENS: int = 2048
    NB_TEMPERATURE: float = 0.0

    # OpenAI (swap-in)
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_MAX_TOKENS: int = 2048

    # Anthropic (swap-in)
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-3-haiku-20240307"

    # ─── OCR Engine ───────────────────────────────────────────────────
    OCR_PROVIDER: str = "tesseract"   # tesseract | azure_cv
    OCR_MIN_CONFIDENCE: float = 0.5
    AZURE_CV_KEY: str = ""
    AZURE_CV_ENDPOINT: str = ""

    # ─── File Storage ─────────────────────────────────────────────────
    STORAGE_BASE_PATH: str = "/data/storage"
    PROCESSED_DIR_PATH: str = "/data/processed"
    OUTPUT_DIR_PATH: str = "/data/output"

    # ─── Batch Processing ─────────────────────────────────────────────
    BATCH_MAX_CONCURRENT: int = 5
    BATCH_RETRY_ATTEMPTS: int = 3
    BATCH_RETRY_DELAY_MS: int = 2000

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
