"""Document ingestion and parsing pipeline orchestrator.

Coordinates PDF upload, page rendering via PyMuPDF, upload to Supabase Storage,
layout detection, region cropping, OCR, table parsing, and block metadata
persistence in Supabase PostgreSQL.
Handles errors gracefully per page without terminating the entire document job.
"""

from __future__ import annotations

import io
import logging
import uuid
from typing import Optional
from uuid import UUID

from PIL import Image

from app.config import get_settings
from app.db.models import Block, BlockType, Document, DocumentStatus, Page, VerificationStatus
from app.db.session import get_session_factory
from app.services.layout_service import LayoutService, get_layout_service
from app.services.ocr_service import OCRService, get_ocr_service
from app.services.pdf_service import PDFService, get_pdf_service
from app.services.storage_service import StorageService, get_storage_service
from app.services.table_service import TableService, get_table_service

logger = logging.getLogger(__name__)


class IngestionPipeline:
    """Orchestrates document ingestion, layout parsing, OCR, and storage stages."""

    def __init__(
        self,
        pdf_service: Optional[PDFService] = None,
        storage_service: Optional[StorageService] = None,
        layout_service: Optional[LayoutService] = None,
        ocr_service: Optional[OCRService] = None,
        table_service: Optional[TableService] = None,
    ) -> None:
        """Initialize the pipeline with all necessary underlying services."""
        self.settings = get_settings()
        self.pdf_service = pdf_service or get_pdf_service()
        self.storage_service = storage_service or get_storage_service()
        self.layout_service = layout_service or get_layout_service()
        self.ocr_service = ocr_service or get_ocr_service()
        self.table_service = table_service or get_table_service()

    def process_document(self, document_id: UUID, pdf_bytes: bytes) -> None:
        """Execute the full ingestion pipeline for an uploaded PDF document.

        Processes pages one by one to minimize memory overhead:
        1. Renders each page to an optimized image at configured DPI (default 150).
        2. Uploads page images to Supabase Storage ('pages' bucket).
        3. Records page dimensions and storage path in PostgreSQL.
        4. Detects layout regions (headings, text, equations, tables, diagrams).
        5. For visual crops (equations & diagrams), uploads cropped images to 'crops' bucket.
        6. For text & tables, performs OCR / structure extraction.
        7. Persists Block records in PostgreSQL linked to the page.
        8. Updates document status to 'parsed' or 'failed'.

        Args:
            document_id: UUID of the document record in PostgreSQL.
            pdf_bytes: Raw bytes of the uploaded PDF file.
        """
        logger.info("Starting ingestion pipeline for document %s", document_id)
        session_factory = get_session_factory()
        db = session_factory()

        try:
            document = db.query(Document).filter(Document.id == document_id).one_or_none()
            if not document:
                logger.error("Document with id %s not found in database.", document_id)
                return

            document.status = DocumentStatus.PROCESSING.value
            db.commit()

            # 1. Determine total pages
            try:
                page_count = self.pdf_service.get_page_count(pdf_bytes)
                document.page_count = page_count
                db.commit()
                logger.info("Document %s contains %d pages.", document_id, page_count)
            except Exception as e:
                error_msg = f"Failed to open or inspect PDF: {e}"
                logger.error(error_msg)
                document.status = DocumentStatus.FAILED.value
                document.error_message = error_msg
                db.commit()
                return

            ext = "png" if self.settings.PAGE_IMAGE_FORMAT.upper() == "PNG" else "jpg"
            mime_type = "image/png" if ext == "png" else "image/jpeg"
            threshold = self.settings.CONFIDENCE_THRESHOLD

            rendered_pages_count = 0

            # 2. Render each page and process layout / OCR
            for page_num, image_bytes, width_px, height_px in self.pdf_service.iter_pages(
                pdf_bytes=pdf_bytes,
                dpi=self.settings.RENDER_DPI,
                image_format=self.settings.PAGE_IMAGE_FORMAT,
            ):
                try:
                    page_storage_path = f"{document_id}/page_{page_num}.{ext}"

                    # Upload rendered page image to Supabase Storage
                    self.storage_service.upload_file(
                        bucket=self.settings.SUPABASE_BUCKET_PAGES,
                        path=page_storage_path,
                        content=image_bytes,
                        content_type=mime_type,
                    )

                    # Persist Page record in DB
                    page_record = Page(
                        document_id=document_id,
                        page_number=page_num,
                        width_px=width_px,
                        height_px=height_px,
                        dpi=self.settings.RENDER_DPI,
                        image_path=page_storage_path,
                    )
                    db.add(page_record)
                    db.commit()
                    db.refresh(page_record)
                    rendered_pages_count += 1

                    logger.info(
                        "Stored page %d/%d (%dx%d px) for document %s",
                        page_num,
                        page_count,
                        width_px,
                        height_px,
                        document_id,
                    )

                    # 3. Layout Detection & Region Classification
                    try:
                        page_pil_image = Image.open(io.BytesIO(image_bytes))
                        detected_blocks = self.layout_service.detect_layout(
                            image=page_pil_image,
                            width_px=width_px,
                            height_px=height_px,
                            pdf_bytes=pdf_bytes,
                            page_number=page_num,
                        )

                        logger.info(
                            "Detected %d layout blocks on page %d for document %s",
                            len(detected_blocks),
                            page_num,
                            document_id,
                        )

                        # 4. Process each detected block: crop, OCR, table structure
                        for blk in detected_blocks:
                            block_id = uuid.uuid4()
                            b_type = blk.block_type
                            bbox = blk.bbox
                            x0, y0, x1, y1 = bbox

                            crop_path: Optional[str] = None
                            extracted_text: Optional[str] = None
                            ocr_confidence: Optional[float] = None
                            extra_data = dict(blk.extra or {})

                            # Handling visual assets (equation / circuit diagram)
                            if self.ocr_service.is_visual_crop(b_type):
                                try:
                                    crop_img = self.ocr_service.crop_region(page_pil_image, bbox)
                                    crop_bytes = self.ocr_service.image_to_bytes(crop_img, "PNG")
                                    crop_path = f"{document_id}/crops/{block_id}.png"
                                    self.storage_service.upload_file(
                                        bucket=self.settings.SUPABASE_BUCKET_CROPS,
                                        path=crop_path,
                                        content=crop_bytes,
                                        content_type="image/png",
                                    )

                                    # Stage 2: Hand off Circuit Diagrams to Member 2 Diagram Engine
                                    if b_type == BlockType.DIAGRAM.value:
                                        diag_handled = False
                                        try:
                                            import sys
                                            from pathlib import Path
                                            root_dir = Path(__file__).resolve().parent.parent.parent.parent
                                            if str(root_dir) not in sys.path:
                                                sys.path.insert(0, str(root_dir))

                                            import cv2
                                            import numpy as np
                                            from diagram_engine.detector import ComponentDetector
                                            from diagram_engine.wire_tracer import WireTracer
                                            from diagram_engine.graph_netlist import CircuitGraphNetlist

                                            cv_crop = cv2.cvtColor(np.array(crop_img), cv2.COLOR_RGB2BGR)
                                            detector = ComponentDetector()
                                            tracer = WireTracer(inward_mask_margin=0)
                                            graph_engine = CircuitGraphNetlist()

                                            comps = detector.detect(cv_crop)
                                            m_bin, r_bin = tracer.preprocess_and_mask(cv_crop, comps)
                                            skel = tracer.skeletonize(m_bin)
                                            juncs = tracer.classify_junctions(skel, r_bin)
                                            segs = tracer.trace_wire_paths(skel, juncs)
                                            diag_result = graph_engine.process(comps, juncs, segs, skel)

                                            extracted_text = diag_result.summary
                                            extra_data["circuit_netlist"] = diag_result.spice_netlist
                                            extra_data["circuit_summary"] = diag_result.summary
                                            extra_data["diagram_confidence"] = diag_result.confidence_score
                                            extra_data["circuit_nodes"] = [
                                                {
                                                    "node_id": n.node_id,
                                                    "description": n.description,
                                                    "connected_components": [
                                                        {"component_id": c.component_id, "class": c.class_name, "terminal": c.terminal}
                                                        for c in n.connected_components
                                                    ],
                                                }
                                                for n in diag_result.nodes
                                            ]
                                            if diag_result.needs_teacher_review:
                                                blk.needs_review = True
                                            diag_handled = True
                                        except ImportError:
                                            # Local cv2/ultralytics not in this venv; call Diagram Engine microservice (port 8001)
                                            try:
                                                import httpx
                                                with httpx.Client(timeout=15.0) as http_client:
                                                    resp = http_client.post(
                                                        "http://127.0.0.1:8001/process-diagram",
                                                        files={"file": ("diagram_crop.png", crop_bytes, "image/png")},
                                                    )
                                                if resp.status_code == 200:
                                                    diag_json = resp.json()
                                                    extracted_text = diag_json.get("summary") or extra_data.get("diagram_labels") or "Circuit diagram detected"
                                                    extra_data["circuit_netlist"] = diag_json.get("spice_netlist", "")
                                                    extra_data["circuit_summary"] = extracted_text
                                                    extra_data["diagram_confidence"] = diag_json.get("confidence_score", 0.5)
                                                    extra_data["circuit_nodes"] = diag_json.get("nodes", [])
                                                    if diag_json.get("needs_teacher_review", True):
                                                        blk.needs_review = True
                                                    diag_handled = True
                                            except Exception as http_err:
                                                logger.warning("Diagram Engine HTTP fallback failed on block %s: %s", block_id, http_err)
                                        except Exception as diag_err:
                                            logger.warning("Diagram engine processing failed on block %s: %s", block_id, diag_err)

                                        if not diag_handled and extra_data.get("diagram_labels"):
                                            extracted_text = f"Circuit diagram ({extra_data['diagram_labels']})"

                                except Exception as crop_err:
                                    logger.warning("Failed to store crop for block %s: %s", block_id, crop_err)
                                # Use pre-extracted equation text if native PDF extraction produced it;
                                # otherwise leave None until Member 3 transcribes the crop.
                                if b_type == BlockType.EQUATION.value and "extracted_text" in extra_data:
                                    extracted_text = str(extra_data.pop("extracted_text"))
                                    ocr_confidence = 0.92

                            # Handling tabular data
                            elif b_type == BlockType.TABLE.value:
                                if extra_data.get("table") and "extracted_text" in extra_data:
                                    extracted_text = str(extra_data.pop("extracted_text"))
                                    ocr_confidence = 0.94
                                else:
                                    try:
                                        crop_img = self.ocr_service.crop_region(page_pil_image, bbox)
                                        table_grid, table_text = self.table_service.parse_table(crop_img, bbox)
                                        extracted_text = table_text
                                        extra_data["table"] = table_grid.model_dump()
                                        ocr_confidence = 0.85
                                    except Exception as tbl_err:
                                        logger.warning("Table parsing error on block %s: %s", block_id, tbl_err)
                                        extracted_text = ""
                                        ocr_confidence = 0.50

                            # Handling textual content (text, headings, lists, captions)
                            elif self.ocr_service.is_ocr_target(b_type):
                                if "extracted_text" in extra_data:
                                    extracted_text = str(extra_data.pop("extracted_text"))
                                    ocr_confidence = 0.96
                                else:
                                    try:
                                        crop_img = self.ocr_service.crop_region(page_pil_image, bbox)
                                        txt, conf = self.ocr_service.recognize_text(crop_img)
                                        extracted_text = txt
                                        ocr_confidence = conf
                                    except Exception as ocr_err:
                                        logger.warning("OCR failed on block %s: %s", block_id, ocr_err)
                                        extracted_text = ""
                                        ocr_confidence = 0.50

                            # Determine teacher review flag (Stage 3 Gate: < 0.88 Threshold)
                            needs_review = (
                                blk.needs_review
                                or (blk.layout_confidence < threshold)
                                or (ocr_confidence is not None and ocr_confidence < threshold)
                                or (extra_data.get("diagram_confidence") is not None and extra_data["diagram_confidence"] < 0.88)
                            )

                            block_record = Block(
                                id=block_id,
                                page_id=page_record.id,
                                block_type=b_type,
                                reading_order=blk.reading_order,
                                bbox_x0=float(x0),
                                bbox_y0=float(y0),
                                bbox_x1=float(x1),
                                bbox_y1=float(y1),
                                text=extracted_text,
                                crop_path=crop_path,
                                layout_confidence=float(blk.layout_confidence),
                                ocr_confidence=float(ocr_confidence) if ocr_confidence is not None else None,
                                needs_review=needs_review,
                                verification_status=VerificationStatus.PENDING.value,
                                extra=extra_data if extra_data else None,
                            )
                            db.add(block_record)

                        db.commit()

                    except Exception as layout_err:
                        db.rollback()
                        logger.error(
                            "Layout/OCR processing error on page %d for document %s: %s",
                            page_num,
                            document_id,
                            layout_err,
                        )

                except Exception as page_err:
                    db.rollback()
                    logger.error(
                        "Error processing page %d for document %s: %s",
                        page_num,
                        document_id,
                        page_err,
                    )
                    # Per engineering rules: failure on one page must not kill the whole document
                    continue

            # 5. Finalize document status
            if rendered_pages_count == 0 and page_count > 0:
                document.status = DocumentStatus.FAILED.value
                document.error_message = "All pages failed during rendering or storage upload."
                logger.error("Document %s failed completely (0 pages rendered).", document_id)
            else:
                document.status = DocumentStatus.PARSED.value
                logger.info(
                    "Ingestion and layout parsing completed for document %s (%d/%d pages rendered).",
                    document_id,
                    rendered_pages_count,
                    page_count,
                )

            db.commit()

        except Exception as exc:
            db.rollback()
            logger.critical("Unexpected error in pipeline for document %s: %s", document_id, exc)
            try:
                document = db.query(Document).filter(Document.id == document_id).one_or_none()
                if document:
                    document.status = DocumentStatus.FAILED.value
                    document.error_message = f"Pipeline execution error: {exc}"
                    db.commit()
            except Exception as inner_exc:
                logger.error("Failed to set document status to failed: %s", inner_exc)
        finally:
            db.close()


_pipeline: Optional[IngestionPipeline] = None


def get_pipeline() -> IngestionPipeline:
    """Return a singleton instance of IngestionPipeline."""
    global _pipeline
    if _pipeline is None:
        _pipeline = IngestionPipeline()
    return _pipeline
