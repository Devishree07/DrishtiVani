"""Router for layout block verification updates."""

from datetime import datetime, timezone
import logging
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.models import Block
from app.db.session import get_db
from app.schemas.layout import (
    BlockVerificationResponse,
    VerificationUpdateRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/blocks", tags=["Blocks"])


@router.patch(
    "/{id}/verification",
    response_model=BlockVerificationResponse,
    summary="Update block verification status by a teacher or reviewer",
)
def update_block_verification(
    id: UUID,
    payload: VerificationUpdateRequest,
    db: Session = Depends(get_db),
):
    """Update block verification status (pending, approved, edited, rejected) and record reviewer details."""
    block = db.query(Block).filter(Block.id == id).one_or_none()
    if not block:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Block with id '{id}' not found.",
        )

    block.verification_status = payload.verification_status
    block.verified_by = payload.verified_by
    block.verified_at = datetime.now(timezone.utc)

    if payload.corrected_text is not None:
        block.text = payload.corrected_text

    if payload.corrected_netlist is not None:
        curr_extra = dict(block.extra or {})
        curr_extra["circuit_netlist"] = payload.corrected_netlist
        block.extra = curr_extra

    # Automatically resolve or reinstate needs_review based on teacher verification decision
    if payload.verification_status in ("approved", "edited"):
        block.needs_review = False
    elif payload.verification_status == "rejected":
        block.needs_review = True

    try:
        db.commit()
        db.refresh(block)
    except Exception as e:
        db.rollback()
        logger.error("Failed to update verification for block %s: %s", id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to persist block verification update: {e}",
        )

    return BlockVerificationResponse(
        id=block.id,
        verification_status=block.verification_status,
        verified_by=block.verified_by,
        needs_review=block.needs_review,
        updated_at=block.verified_at.isoformat() if block.verified_at else None,
    )
