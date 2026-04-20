"""
main.py  (v3.1)

FastAPI entry point for the Invoice Processing AI microservice.

Phase 0 scope:
  - /health  (liveness)
  - /ready   (readiness — validates provider config)
  - /metrics (Prometheus)

EPIC-004 EDA router is wired but its endpoints are elaborated in Phase 3.

@since 3.1.0
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse

from prometheus_client import CollectorRegistry, generate_latest, CONTENT_TYPE_LATEST

from .config.settings import get_settings
from .providers.provider_factory import LlmProviderFactory
from .utils.logger import get_logger

logger = get_logger(__name__)
settings = get_settings()

app = FastAPI(
    title="Invoice Processing AI Service",
    description="Internal OCR + Vision-LLM extraction microservice (v3.1)",
    version="3.1.0",
    docs_url="/docs" if settings.PYTHON_ENABLE_DOCS else None,
    redoc_url="/redoc" if settings.PYTHON_ENABLE_DOCS else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.PYTHON_ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Prometheus registry for this service
metrics_registry = CollectorRegistry()


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(f"Unhandled error on {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"code": "INTERNAL_ERROR", "message": str(exc), "path": str(request.url)},
    )


@app.get("/health", summary="Liveness")
async def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "invoice-ai",
        "version": "3.1.0",
        "llm_provider": "stub" if settings.USE_STUB_PROVIDER else settings.LLM_PROVIDER,
        "extraction_mode": settings.EXTRACTION_MODE,
    }


@app.get("/ready", summary="Readiness")
async def ready() -> dict[str, object]:
    checks: dict[str, dict[str, object]] = {}
    try:
        LlmProviderFactory.create(settings)
        checks["llm_provider"] = {"ok": True}
    except Exception as e:  # noqa: BLE001
        checks["llm_provider"] = {"ok": False, "detail": str(e)}
    all_ok = all(c.get("ok") for c in checks.values())
    return {"status": "ready" if all_ok else "degraded", "checks": checks}


@app.get("/metrics")
async def metrics() -> PlainTextResponse:
    return PlainTextResponse(
        content=generate_latest(metrics_registry).decode("utf-8"),
        media_type=CONTENT_TYPE_LATEST,
    )


# ── Routers ────────────────────────────────────────────────────────
from .routers.eda_router import router as eda_router
app.include_router(eda_router, prefix="/eda", tags=["EDA Extraction"])
