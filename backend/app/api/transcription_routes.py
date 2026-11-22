import os
import shutil
from typing import List, Dict, Any
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

from backend.app.engines.transcription.math_engine import MathEngine
from backend.app.engines.transcription.table_engine import TableEngine
from backend.app.engines.transcription.braille_exporter import BrailleExporter

router = APIRouter(prefix="/transcription", tags=["Transcription Engine"])

# Instantiate engines
math_engine = MathEngine()

# Request schemas
class TableRequest(BaseModel):
    title: str = "Extracted Table"
    grid_data: List[List[str]]

class ExportBRFRequest(BaseModel):
    parsed_blocks: List[Dict[str, Any]]
    output_filename: str = "transcribed_document.brf"


@router.post("/process-math-crop")
async def process_math_crop(file: UploadFile = File(...)):
    """
    Accepts an uploaded image crop of an equation and returns
    LaTeX, MathML, and Nemeth Braille representations.
    """
    temp_dir = "temp_crops"
    os.makedirs(temp_dir, exist_ok=True)
    temp_path = os.path.join(temp_dir, file.filename)

    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Run equation through Math Engine
        result = math_engine.process_math_crop(temp_path)
        return {"status": "success", "data": result}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@router.post("/process-table")
async def process_table(payload: TableRequest):
    """
    Converts a 2D array of cell strings into an accessible HTML5 table.
    """
    try:
        html_table = TableEngine.generate_accessible_table(payload.grid_data, payload.title)
        return {"status": "success", "html": html_table}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/export-brf")
async def export_brf(payload: ExportBRFRequest):
    """
    Exports full document blocks into a download-ready ASCII .brf file.
    """
    try:
        output_path = os.path.join("output", payload.output_filename)
        saved_path = BrailleExporter.export_to_brf(payload.parsed_blocks, output_path)
        return {"status": "success", "file_path": saved_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))