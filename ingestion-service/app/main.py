"""Main FastAPI application for Accessible Engineering Notes - Ingestion Service.

Provides health checks, document ingestion, layout parsing, and block verification endpoints.
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware

from pathlib import Path
from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.db.session import check_db_connectivity
from app.routers import blocks_router, documents_router
from app.schemas.layout import HealthResponse
from app.services.storage_service import get_storage_service

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ingestion-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown lifecycle.

    On startup:
    1. Validates Supabase database connectivity. Fails immediately with an informative
       error if the Supabase project is paused or credentials are misconfigured.
    2. Validates Supabase Storage and ensures private buckets (handouts, pages, crops) exist.
    """
    settings = get_settings()
    logger.info("Starting Accessible Engineering Notes - Ingestion Service (%s mode)...", settings.APP_ENV)

    if settings.SKIP_STARTUP_CHECKS:
        logger.warning("SKIP_STARTUP_CHECKS=True. Skipping strict Supabase DB and Storage checks on startup.")
    else:
        # 1. DB Connectivity Check
        try:
            check_db_connectivity()
            logger.info("Supabase PostgreSQL connection confirmed.")
        except Exception as exc:
            msg = (
                "CRITICAL: Failed to connect to Supabase PostgreSQL database! "
                "If using Supabase Free Tier, the project may be paused due to inactivity. "
                "Please check the Supabase dashboard (https://supabase.com/dashboard) to unpause your project, "
                f"or check your DATABASE_URL in .env. Root cause: {exc}"
            )
            logger.critical(msg)
            raise RuntimeError(msg) from exc

        # 2. Supabase Storage & Bucket Creation Check
        try:
            storage = get_storage_service()
            ensured_buckets = storage.ensure_buckets_exist()
            logger.info("Supabase Storage confirmed. Ensured private buckets: %s", ensured_buckets)
        except Exception as exc:
            msg = (
                "CRITICAL: Failed to connect to Supabase Storage or ensure required private buckets! "
                "Please check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env. "
                f"Root cause: {exc}"
            )
            logger.critical(msg)
            raise RuntimeError(msg) from exc

    yield

    logger.info("Shutting down Ingestion Service.")


app = FastAPI(
    title="Accessible Engineering Notes - Document Ingestion Service",
    description=(
        "First stage pipeline service converting scanned engineering handouts "
        "into structured, screen-reader-accessible layout blocks with Supabase storage."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for frontend and teacher UI access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount local storage static directory if configured/existing
_local_dir = Path(get_settings().LOCAL_STORAGE_DIR).resolve()
_local_dir.mkdir(parents=True, exist_ok=True)
app.mount("/local_storage", StaticFiles(directory=str(_local_dir)), name="local_storage")

# Register routers
app.include_router(documents_router)
app.include_router(blocks_router)

_static_dir = Path(__file__).resolve().parent / "static"
_static_dir.mkdir(parents=True, exist_ok=True)
_index_html_path = _static_dir / "index.html"


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
@app.get("/ui", response_class=HTMLResponse, include_in_schema=False)
@app.get("/review", response_class=HTMLResponse, include_in_schema=False)
def serve_review_console():
    """Serve the Teacher Ingestion and Review Console Web UI."""
    if _index_html_path.exists():
        return HTMLResponse(_index_html_path.read_text(encoding="utf-8"))
    return HTMLResponse("<h2>DrishtiVani Ingestion Service</h2><p>Visit <a href='/docs'>/docs</a></p>")


@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check verifying Supabase PostgreSQL and Storage connectivity",
    tags=["Health"],
)
def health_check(response: Response):
    """Check database and storage connectivity.

    Returns HTTP 200 if both are operational.
    Returns HTTP 503 if Supabase Postgres or Storage is unreachable,
    flagging potential project pausing on the Supabase Free Tier.
    """
    settings = get_settings()
    storage = get_storage_service()

    db_url = settings.get_sqlalchemy_database_url()
    is_local = "sqlite" in db_url

    db_status = {"status": "connected", "mode": "local_sqlite" if is_local else "supabase_postgres"}
    storage_status = {
        "status": "connected",
        "mode": "local_filesystem" if storage._use_local else "supabase_storage",
        "buckets": [
            settings.SUPABASE_BUCKET_HANDOUTS,
            settings.SUPABASE_BUCKET_PAGES,
            settings.SUPABASE_BUCKET_CROPS,
        ],
    }

    is_healthy = True

    # 1. Test DB
    try:
        check_db_connectivity()
    except Exception as exc:
        is_healthy = False
        db_status = {
            "status": "disconnected",
            "error": "Failed to connect to Supabase PostgreSQL database. If using Supabase Free Tier, the project may be paused due to inactivity. Check https://supabase.com/dashboard",
            "details": str(exc),
        }

    # 2. Test Storage
    try:
        if not storage.check_storage_connectivity():
            is_healthy = False
            storage_status = {
                "status": "unreachable",
                "error": "Storage did not respond to bucket listing.",
            }
    except Exception as exc:
        is_healthy = False
        storage_status = {
            "status": "unreachable",
            "error": "Storage reachability check failed.",
            "details": str(exc),
        }

    if not is_healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return HealthResponse(
            status="unhealthy",
            database=db_status,
            storage=storage_status,
        )

    return HealthResponse(
        status="healthy",
        database=db_status,
        storage=storage_status,
    )
