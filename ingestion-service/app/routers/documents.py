"""Router for document ingestion, status tracking, and layout retrieval."""

import logging
import uuid
from typing import List, Optional
from uuid import UUID

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.models import Block, Document, DocumentStatus, Page
from app.db.session import get_db
from app.schemas.layout import (
    BlockLayoutSchema,
    DocumentLayoutResponse,
    DocumentStatusResponse,
    DocumentUploadResponse,
    PageLayoutSchema,
    TableGridSchema,
)
from app.services.pipeline import get_pipeline
from app.services.storage_service import get_storage_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.get(
    "",
    summary="List all uploaded documents with status and metadata",
)
def list_documents(db: Session = Depends(get_db)):
    """Retrieve list of recently uploaded documents for the teacher review queue."""
    docs = db.query(Document).order_by(Document.created_at.desc()).limit(50).all()
    results = []
    for d in docs:
        flagged_count = 0
        total_blocks = 0
        for p in d.pages:
            for b in p.blocks:
                total_blocks += 1
                if b.needs_review:
                    flagged_count += 1
        results.append({
            "id": str(d.id),
            "title": d.title,
            "filename": d.original_filename,
            "page_count": d.page_count,
            "status": d.status,
            "total_blocks": total_blocks,
            "flagged_blocks": flagged_count,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        })
    return results


@router.post(
    "",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload a PDF document for ingestion and parsing",
)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Scanned PDF document to ingest"),
    title: Optional[str] = Form(None, description="Optional title for the document"),
    db: Session = Depends(get_db),
):
    """Accepts a multipart PDF upload, stores the file in Supabase Storage ('handouts' bucket),
    creates a document record in PostgreSQL, and queues page rendering and parsing in the background.
    """
    filename = file.filename or "document.pdf"
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF documents are supported for ingestion.",
        )

    # Read uploaded bytes
    try:
        pdf_bytes = await file.read()
    except Exception as e:
        logger.error("Failed to read uploaded file: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not read uploaded file: {e}",
        )

    if not pdf_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded PDF file is empty.",
        )

    # Validate PDF magic header
    if not pdf_bytes.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format: file header does not match PDF signature.",
        )

    settings = get_settings()
    storage = get_storage_service()
    pipeline = get_pipeline()

    # Determine document title
    document_title = title.strip() if title and title.strip() else filename.rsplit(".", 1)[0]
    document_id = uuid.uuid4()
    storage_path = f"{document_id}/{filename}"

    # 1. Upload original PDF to Supabase Storage ('handouts' bucket)
    try:
        storage.upload_file(
            bucket=settings.SUPABASE_BUCKET_HANDOUTS,
            path=storage_path,
            content=pdf_bytes,
            content_type="application/pdf",
        )
    except Exception as e:
        logger.error("Failed to upload PDF to Supabase Storage: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to store PDF in Supabase Storage: {e}",
        )

    # 2. Record initial Document record in PostgreSQL
    try:
        doc_record = Document(
            id=document_id,
            title=document_title,
            original_filename=filename,
            storage_path=storage_path,
            page_count=0,
            status=DocumentStatus.PROCESSING.value,
        )
        db.add(doc_record)
        db.commit()
        db.refresh(doc_record)
    except Exception as e:
        logger.error("Failed to create document record in DB: %s", e)
        # Attempt to clean up uploaded storage file
        try:
            storage.delete_file(settings.SUPABASE_BUCKET_HANDOUTS, storage_path)
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error during document registration: {e}",
        )

    # 3. Dispatch processing as a background task
    background_tasks.add_task(pipeline.process_document, document_id, pdf_bytes)

    logger.info("Queued document %s ('%s') for background ingestion.", document_id, document_title)
    return DocumentUploadResponse(
        document_id=document_id,
        title=document_title,
        status="processing",
        message="Document uploaded successfully and queued for processing.",
    )


@router.get(
    "/{id}",
    response_model=DocumentStatusResponse,
    summary="Get document ingestion status and page count",
)
def get_document_status(
    id: UUID,
    db: Session = Depends(get_db),
):
    """Check processing status, page count, and metadata for an ingested document."""
    document = db.query(Document).filter(Document.id == id).one_or_none()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with id '{id}' not found.",
        )

    return DocumentStatusResponse(
        document_id=document.id,
        title=document.title,
        status=document.status,
        page_count=document.page_count,
        error_message=document.error_message,
    )


def _serialize_block(block: Block, storage, settings) -> BlockLayoutSchema:
    """Helper to convert a DB Block model into BlockLayoutSchema with signed crop URL."""
    crop_url = None
    if block.crop_path:
        crop_url = storage.create_signed_url(
            bucket=settings.SUPABASE_BUCKET_CROPS,
            path=block.crop_path,
            expires_in=settings.SIGNED_URL_EXPIRATION_SECONDS,
        )

    table_data = None
    if block.extra and "table" in block.extra:
        try:
            table_data = TableGridSchema.model_validate(block.extra["table"])
        except Exception:
            table_data = None

    return BlockLayoutSchema(
        id=block.id,
        type=block.block_type,
        reading_order=block.reading_order,
        bbox=[block.bbox_x0, block.bbox_y0, block.bbox_x1, block.bbox_y1],
        text=block.text,
        crop_url=crop_url,
        layout_confidence=block.layout_confidence,
        ocr_confidence=block.ocr_confidence,
        needs_review=block.needs_review,
        verification_status=block.verification_status,
        table=table_data,
        extra=block.extra,
    )


@router.get(
    "/{id}/layout",
    response_model=DocumentLayoutResponse,
    summary="Get full structured layout JSON for an ingested document",
)
def get_document_layout(
    id: UUID,
    db: Session = Depends(get_db),
):
    """Retrieve full hierarchical layout of pages, blocks, bounding boxes, and table structures."""
    document = db.query(Document).filter(Document.id == id).one_or_none()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with id '{id}' not found.",
        )

    settings = get_settings()
    storage = get_storage_service()

    pages = db.query(Page).filter(Page.document_id == id).order_by(Page.page_number).all()

    page_schemas: List[PageLayoutSchema] = []
    for p in pages:
        image_url = storage.create_signed_url(
            bucket=settings.SUPABASE_BUCKET_PAGES,
            path=p.image_path,
            expires_in=settings.SIGNED_URL_EXPIRATION_SECONDS,
        ) or ""

        blocks = db.query(Block).filter(Block.page_id == p.id).order_by(Block.reading_order).all()
        block_schemas = [_serialize_block(b, storage, settings) for b in blocks]

        page_schemas.append(
            PageLayoutSchema(
                page_number=p.page_number,
                width_px=p.width_px,
                height_px=p.height_px,
                image_url=image_url,
                blocks=block_schemas,
            )
        )

    return DocumentLayoutResponse(
        document_id=document.id,
        title=document.title,
        pages=page_schemas,
    )


@router.get(
    "/{id}/pages/{n}/blocks",
    response_model=List[BlockLayoutSchema],
    summary="Get blocks for a specific page number",
)
def get_page_blocks(
    id: UUID,
    n: int,
    db: Session = Depends(get_db),
):
    """Retrieve all layout blocks on a specific page of a document."""
    document = db.query(Document).filter(Document.id == id).one_or_none()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with id '{id}' not found.",
        )

    page = db.query(Page).filter(Page.document_id == id, Page.page_number == n).one_or_none()
    if not page:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Page {n} not found for document '{id}'.",
        )

    settings = get_settings()
    storage = get_storage_service()

    blocks = db.query(Block).filter(Block.page_id == page.id).order_by(Block.reading_order).all()
    return [_serialize_block(b, storage, settings) for b in blocks]


@router.post(
    "/{id}/publish",
    summary="Approve and publish a document for student access",
)
def publish_document(
    id: UUID,
    db: Session = Depends(get_db),
):
    """Marks document state as PUBLISHED, resolves pending flags, and unlocks for student view."""
    document = db.query(Document).filter(Document.id == id).one_or_none()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with id '{id}' not found.",
        )

    document.status = "published"
    for page in document.pages:
        for block in page.blocks:
            block.needs_review = False
            if block.verification_status == "pending":
                block.verification_status = "approved"

    db.commit()
    db.refresh(document)
    return {
        "status": "published",
        "document_id": str(document.id),
        "message": f"Document '{document.title}' is approved and published for blind student navigation.",
    }
