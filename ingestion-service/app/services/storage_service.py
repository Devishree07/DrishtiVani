"""Supabase Storage Service.

Encapsulates all object storage interactions with Supabase Storage.
Ensures private buckets, uploads page renders and crops, generates time-limited signed URLs,
and performs connectivity checks. No other module should directly import the Supabase client.
"""

import logging
from pathlib import Path
from typing import List, Optional
from supabase import Client, create_client
from app.config import get_settings

logger = logging.getLogger(__name__)


class StorageService:
    """Service wrapping Supabase Storage operations with local filesystem fallback."""

    def __init__(self, client: Optional[Client] = None) -> None:
        """Initialize the Supabase client or local storage directory."""
        self._settings = get_settings()
        self._local_dir = Path(self._settings.LOCAL_STORAGE_DIR).resolve()

        if client is not None:
            self._client = client
            self._use_local = False
            logger.info("StorageService initialized with provided client.")
        elif self._settings.USE_LOCAL_STORAGE:
            self._use_local = True
            self._client = None
            logger.info("StorageService running in LOCAL mode at: %s", self._local_dir)
        elif self._settings.SUPABASE_URL and self._settings.SUPABASE_SERVICE_ROLE_KEY:
            self._client = create_client(
                self._settings.SUPABASE_URL,
                self._settings.SUPABASE_SERVICE_ROLE_KEY,
            )
            self._use_local = False
            logger.info("Supabase Storage client initialized.")
        else:
            self._use_local = True
            self._client = None
            logger.warning("Supabase credentials missing, falling back to LOCAL mode.")

    @property
    def client(self) -> Client:
        """Return the active Supabase client or raise if uninitialized."""
        if self._client is None and not self._use_local:
            raise RuntimeError(
                "Supabase client is not configured. "
                "Please configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file."
            )
        return self._client

    def ensure_buckets_exist(self) -> List[str]:
        """Verify that the required storage buckets exist; if not, create them as PRIVATE buckets.

        The three required buckets are:
        - handouts: original uploaded PDF handouts
        - pages: rendered page images (150 DPI)
        - crops: cropped equation and diagram images

        Returns:
            List[str]: List of ensured bucket names.
        """
        required_buckets = [
            self._settings.SUPABASE_BUCKET_HANDOUTS,
            self._settings.SUPABASE_BUCKET_PAGES,
            self._settings.SUPABASE_BUCKET_CROPS,
        ]

        if self._use_local:
            for bucket_name in required_buckets:
                (self._local_dir / bucket_name).mkdir(parents=True, exist_ok=True)
            return required_buckets

        try:
            existing = self.client.storage.list_buckets()
            existing_ids = {b.id for b in existing}
        except Exception as e:
            logger.error("Failed to list Supabase Storage buckets: %s", e)
            raise

        for bucket_name in required_buckets:
            if bucket_name not in existing_ids:
                logger.info("Bucket '%s' not found. Creating as PRIVATE bucket...", bucket_name)
                try:
                    # Supabase Storage creates private buckets by setting public=False
                    self.client.storage.create_bucket(
                        bucket_name,
                        options={"public": False},
                    )
                    logger.info("Successfully created private bucket '%s'.", bucket_name)
                except Exception as e:
                    # Check if another process created it concurrently
                    if "already exists" in str(e).lower():
                        logger.info("Bucket '%s' already exists.", bucket_name)
                    else:
                        logger.error("Failed to create bucket '%s': %s", bucket_name, e)
                        raise
            else:
                logger.debug("Bucket '%s' already exists.", bucket_name)

        return required_buckets

    def upload_file(
        self,
        bucket: str,
        path: str,
        content: bytes,
        content_type: str = "application/octet-stream",
    ) -> str:
        """Upload raw bytes to a target bucket and storage path."""
        if self._use_local:
            file_path = self._local_dir / bucket / path
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_bytes(content)
            logger.debug("Local upload %d bytes to '%s/%s'", len(content), bucket, path)
            return path

        try:
            self.client.storage.from_(bucket).upload(
                path=path,
                file=content,
                file_options={"content-type": content_type, "x-upsert": "true", "upsert": "true"},
            )
            logger.debug("Uploaded %d bytes to '%s/%s'", len(content), bucket, path)
            return path
        except Exception as e:
            logger.error("Failed to upload file to '%s/%s': %s", bucket, path, e)
            raise

    def create_signed_url(
        self,
        bucket: str,
        path: Optional[str],
        expires_in: Optional[int] = None,
    ) -> Optional[str]:
        """Generate a time-limited signed URL for a file stored in a private bucket."""
        if not path:
            return None

        if self._use_local:
            return f"/local_storage/{bucket}/{path}"

        ttl = expires_in if expires_in is not None else self._settings.SIGNED_URL_EXPIRATION_SECONDS
        try:
            res = self.client.storage.from_(bucket).create_signed_url(path, ttl)
            if isinstance(res, dict):
                return res.get("signedURL") or res.get("signedUrl")
            return str(res)
        except Exception as e:
            logger.error("Failed to create signed URL for '%s/%s': %s", bucket, path, e)
            return None

    def download_file(self, bucket: str, path: str) -> bytes:
        """Download raw bytes of a file from Storage."""
        if self._use_local:
            target = self._local_dir / bucket / path
            if not target.exists():
                raise FileNotFoundError(f"Local storage file not found: {target}")
            return target.read_bytes()

        try:
            return self.client.storage.from_(bucket).download(path)
        except Exception as e:
            logger.error("Failed to download file '%s/%s': %s", bucket, path, e)
            raise

    def delete_file(self, bucket: str, path: str) -> None:
        """Delete a file from Storage."""
        if self._use_local:
            target = self._local_dir / bucket / path
            if target.exists():
                target.unlink()
            return

        try:
            self.client.storage.from_(bucket).remove([path])
            logger.info("Deleted file '%s/%s'", bucket, path)
        except Exception as e:
            logger.error("Failed to delete file '%s/%s': %s", bucket, path, e)
            raise

    def check_storage_connectivity(self) -> bool:
        """Check if Storage is reachable."""
        if self._use_local:
            self._local_dir.mkdir(parents=True, exist_ok=True)
            return True

        try:
            self.client.storage.list_buckets()
            return True
        except Exception as e:
            logger.warning("Supabase Storage reachability check failed: %s", e)
            return False


_storage_service: Optional[StorageService] = None


def get_storage_service() -> StorageService:
    """Return a singleton instance of StorageService."""
    global _storage_service
    if _storage_service is None:
        _storage_service = StorageService()
    return _storage_service
