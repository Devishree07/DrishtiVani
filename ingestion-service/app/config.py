"""Application configuration module using pydantic-settings.

Loads environment variables from `.env` or system environment, validates configuration,
and provides helper utilities for database and storage connections.
"""

import os
from functools import lru_cache
from pathlib import Path
from typing import Literal
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Ensure Hugging Face and PyTorch models cache to the 80GB partition on D:
if os.path.exists("D:\\"):
    os.environ.setdefault("HF_HOME", "D:\\huggingface")
    os.environ.setdefault("TORCH_HOME", "D:\\torch")

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"


class Settings(BaseSettings):
    """Configuration settings for the Ingestion Service."""

    model_config = SettingsConfigDict(
        env_file=[str(ENV_PATH), ".env"],
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    # Supabase API Credentials
    SUPABASE_URL: str = Field(
        default="",
        description="Supabase project URL (e.g. https://xyz.supabase.co)",
    )
    SUPABASE_SERVICE_ROLE_KEY: str = Field(
        default="",
        description="Supabase secret service-role API key (server-side only)",
    )

    # Supabase Postgres Connection String
    DATABASE_URL: str = Field(
        default="",
        description="Connection string to Supabase Postgres (connection-pooler URI)",
    )

    # Supabase Storage Buckets
    SUPABASE_BUCKET_HANDOUTS: str = Field(
        default="handouts",
        description="Bucket for original uploaded PDF files",
    )
    SUPABASE_BUCKET_PAGES: str = Field(
        default="pages",
        description="Bucket for rendered page images",
    )
    SUPABASE_BUCKET_CROPS: str = Field(
        default="crops",
        description="Bucket for cropped equation and diagram images",
    )

    # PDF Ingestion & Rendering
    RENDER_DPI: int = Field(
        default=150,
        description="Rendering DPI for PDF page rasterization (150 is storage-conscious and clear for OCR)",
    )
    PAGE_IMAGE_FORMAT: Literal["PNG", "JPEG"] = Field(
        default="PNG",
        description="Image encoding format for rendered pages (PNG or JPEG)",
    )

    # Signed URL Expiration
    SIGNED_URL_EXPIRATION_SECONDS: int = Field(
        default=3600,
        description="Time-to-live in seconds for generated Supabase Storage signed URLs (default 1 hour)",
    )

    # Layout & Confidence Thresholds
    CONFIDENCE_THRESHOLD: float = Field(
        default=0.80,
        description="Confidence threshold below which blocks are flagged as needs_review=True",
    )
    USE_LAYOUTLMV3_FALLBACK: bool = Field(
        default=False,
        description="Flag to enable optional LayoutLMv3 fallback classifier",
    )

    # Database Pool Settings (Tuned for Supabase PgBouncer Pooler)
    DB_POOL_SIZE: int = Field(
        default=5,
        description="SQLAlchemy engine connection pool size",
    )
    DB_MAX_OVERFLOW: int = Field(
        default=5,
        description="Max overflow connections beyond pool size",
    )
    DB_POOL_PRE_PING: bool = Field(
        default=True,
        description="Test connections for liveness before checkout to prevent stale disconnects",
    )
    DB_POOL_RECYCLE: int = Field(
        default=300,
        description="Connection recycle time in seconds",
    )

    # Service & Environment
    APP_ENV: str = Field(
        default="development",
        description="Runtime environment (development, test, production)",
    )
    LOG_LEVEL: str = Field(
        default="INFO",
        description="Logging level",
    )
    SKIP_STARTUP_CHECKS: bool = Field(
        default=False,
        description="Skip live external connectivity checks on startup (useful for unit testing / CI)",
    )
    USE_LOCAL_STORAGE: bool = Field(
        default=False,
        description="Enable local SQLite database and local filesystem storage for offline testing",
    )
    LOCAL_STORAGE_DIR: str = Field(
        default="./local_storage",
        description="Local directory for storing handouts, pages, and crops when in local mode",
    )

    def get_sqlalchemy_database_url(self) -> str:
        """Return the database URL formatted for SQLAlchemy with the psycopg (v3) driver.

        Supports local SQLite mode when DATABASE_URL is empty or sqlite, or when USE_LOCAL_STORAGE=True.
        """
        url = self.DATABASE_URL.strip() if self.DATABASE_URL else ""
        if not url:
            return "sqlite:///./drishtivani_local.db"

        if url.startswith("sqlite"):
            return url
        if url.startswith("postgres://"):
            return "postgresql+psycopg://" + url[len("postgres://"):]
        if url.startswith("postgresql://"):
            return "postgresql+psycopg://" + url[len("postgresql://"):]
        return url


@lru_cache()
def get_settings() -> Settings:
    """Return a cached singleton instance of the application settings."""
    return Settings()
