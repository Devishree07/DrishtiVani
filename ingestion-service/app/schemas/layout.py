"""Pydantic schemas adhering strictly to the contract for Accessible Engineering Notes.

Provides type-safe serialization, validation, and JSON generation for documents,
pages, layout blocks, table structures, and health endpoints.
"""

from typing import List, Literal, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


# Allowed block types according to the specification
BlockTypeLiteral = Literal[
    "heading_h1",
    "heading_h2",
    "heading_h3",
    "text",
    "equation",
    "table",
    "diagram",
    "figure_caption",
    "list_item",
    "other",
]

# Allowed verification statuses
VerificationStatusLiteral = Literal[
    "pending",
    "approved",
    "edited",
    "rejected",
]


class TableCellSchema(BaseModel):
    """Schema for an individual cell in a table grid."""
    row: int = Field(..., description="Row index (0-indexed)")
    col: int = Field(..., description="Column index (0-indexed)")
    row_span: int = Field(default=1, description="Number of rows spanned")
    col_span: int = Field(default=1, description="Number of columns spanned")
    is_header: bool = Field(default=False, description="True if cell is a table header")
    bbox: List[float] = Field(..., description="Cell bounding box [x0, y0, x1, y1] in page pixel coords")
    text: str = Field(default="", description="Recognized text in the cell")


class TableRowSchema(BaseModel):
    """Schema for a table row containing cells."""
    cells: List[TableCellSchema] = Field(default_factory=list)


class TableGridSchema(BaseModel):
    """Structured table representation produced by Table Transformer (TATR)."""
    rows: List[TableRowSchema] = Field(default_factory=list)


class BlockLayoutSchema(BaseModel):
    """Block schema matching the exact output contract for GET /documents/{id}/layout."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    type: BlockTypeLiteral
    reading_order: int
    bbox: List[float] = Field(..., description="[x0, y0, x1, y1] in page image pixel coordinates")
    text: Optional[str] = None
    crop_url: Optional[str] = None
    layout_confidence: float
    ocr_confidence: Optional[float] = None
    needs_review: bool
    verification_status: VerificationStatusLiteral = "pending"
    table: Optional[TableGridSchema] = None
    extra: Optional[dict] = None


class PageLayoutSchema(BaseModel):
    """Page schema containing rendered image signed URL and list of blocks."""
    model_config = ConfigDict(from_attributes=True)

    page_number: int
    width_px: int
    height_px: int
    image_url: str
    blocks: List[BlockLayoutSchema] = Field(default_factory=list)


class DocumentLayoutResponse(BaseModel):
    """Root contract for GET /documents/{id}/layout."""
    model_config = ConfigDict(from_attributes=True)

    document_id: UUID
    title: str
    pages: List[PageLayoutSchema] = Field(default_factory=list)


class DocumentUploadResponse(BaseModel):
    """Response returned upon POST /documents upload."""
    document_id: UUID
    title: str
    status: Literal["processing", "uploaded", "parsed", "failed"] = "processing"
    message: str = "Document uploaded successfully and queued for processing."


class DocumentStatusResponse(BaseModel):
    """Response for GET /documents/{id}."""
    document_id: UUID
    title: str
    status: Literal["uploaded", "processing", "parsed", "failed"]
    page_count: int
    error_message: Optional[str] = None


class VerificationUpdateRequest(BaseModel):
    """Payload for PATCH /blocks/{id}/verification."""
    verification_status: VerificationStatusLiteral
    verified_by: Optional[str] = None
    corrected_text: Optional[str] = None
    corrected_netlist: Optional[str] = None


class BlockVerificationResponse(BaseModel):
    """Response for PATCH /blocks/{id}/verification."""
    id: UUID
    verification_status: VerificationStatusLiteral
    verified_by: Optional[str] = None
    needs_review: bool
    updated_at: Optional[str] = None


class HealthResponse(BaseModel):
    """Response model for GET /health."""
    status: Literal["healthy", "unhealthy"]
    database: dict
    storage: dict
