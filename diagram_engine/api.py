"""
DrishtiVani - Member 2: Circuit Diagram to Accessible Netlist Engine
Module 4: api.py - FastAPI Microservice & Testing UI
"""

from __future__ import annotations

import base64
import io
import logging
import uuid
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, ConfigDict, Field

from diagram_engine.detector import ComponentDetector
from diagram_engine.graph_netlist import CircuitGraphNetlist
from diagram_engine.visualizer import CircuitVisualizer
from diagram_engine.wire_tracer import WireTracer

logger = logging.getLogger(__name__)

# -----------------------------------------------------------------------------
# Pydantic Schemas
# -----------------------------------------------------------------------------

class ConnectedComponentSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    component_id: str = Field(..., description="Component identifier, e.g. V1, R1")
    class_name: str = Field(..., alias="class", description="Component class, e.g. resistor, voltage_source")
    terminal: str = Field(..., description="Connected terminal pin name, e.g. positive, pin_1")


class ElectricalNodeSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    node_id: str = Field(..., description="Electrical node identifier, e.g. n1, 0")
    description: str = Field(..., description="Plain-English description for screen readers")
    connected_components: List[ConnectedComponentSchema] = Field(
        default_factory=list,
        description="List of component pins connected at this node",
    )


class DiagramProcessResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    diagram_id: str = Field(..., description="Unique diagram identifier")
    confidence_score: float = Field(..., description="Automated confidence score (drops < 0.88 if dangling wires exist)")
    needs_teacher_review: bool = Field(..., description="True if confidence < 0.88 or topological ambiguity is flagged")
    summary: str = Field(..., description="Plain-English macro summary of circuit topology and component count")
    spice_netlist: str = Field(..., description="Valid SPICE .cir netlist string")
    nodes: List[ElectricalNodeSchema] = Field(..., description="Hierarchical node connectivity tree for screen readers")
    annotated_image: Optional[str] = Field(None, description="Base64 data URL of the diagnostic visual inspection overlay")


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str


# -----------------------------------------------------------------------------
# FastAPI Application & Singletons
# -----------------------------------------------------------------------------

app = FastAPI(
    title="DrishtiVani - Diagram to Accessible Netlist Engine (Member 2)",
    description=(
        "Converts circuit diagram schematics into valid SPICE netlists (.cir), "
        "hierarchical screen-reader accessible JSON trees, and confidence evaluations (< 0.88 threshold)."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_detector: Optional[ComponentDetector] = None
_wire_tracer: Optional[WireTracer] = None
_graph_netlist: Optional[CircuitGraphNetlist] = None
_visualizer: Optional[CircuitVisualizer] = None


def get_detector() -> ComponentDetector:
    global _detector
    if _detector is None:
        _detector = ComponentDetector(model_path="yolo11s.pt")
    return _detector


def get_wire_tracer() -> WireTracer:
    global _wire_tracer
    if _wire_tracer is None:
        _wire_tracer = WireTracer(inward_mask_margin=0)
    return _wire_tracer


def get_graph_netlist() -> CircuitGraphNetlist:
    global _graph_netlist
    if _graph_netlist is None:
        _graph_netlist = CircuitGraphNetlist(
            snap_threshold_px=15.0,
            review_threshold=0.88,
            unconnected_penalty=0.15,
        )
    return _graph_netlist


def get_visualizer() -> CircuitVisualizer:
    global _visualizer
    if _visualizer is None:
        _visualizer = CircuitVisualizer()
    return _visualizer


def generate_synthetic_voltage_divider() -> Tuple[np.ndarray, list]:
    """Generates a clean synthetic voltage divider circuit for instant testing."""
    w, h = 600, 360
    img = np.ones((h, w, 3), dtype=np.uint8) * 255
    color = (25, 25, 25)
    thick = 3

    # Wires
    cv2.line(img, (90, 80), (220, 80), color, thick)
    cv2.line(img, (320, 80), (460, 80), color, thick)
    cv2.line(img, (460, 80), (460, 150), color, thick)
    cv2.line(img, (460, 230), (460, 280), color, thick)
    cv2.line(img, (90, 280), (460, 280), color, thick)
    cv2.line(img, (460, 280), (460, 310), color, thick)
    cv2.line(img, (90, 80), (90, 140), color, thick)
    cv2.line(img, (90, 220), (90, 280), color, thick)

    # V1 (Circle)
    cv2.circle(img, (90, 180), 30, color, 2)
    cv2.putText(img, "+", (84, 168), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
    cv2.putText(img, "-", (85, 200), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
    cv2.putText(img, "10V", (40, 185), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

    # R1 (Rectangle)
    cv2.rectangle(img, (220, 65), (320, 95), color, 2)
    cv2.putText(img, "R1 (1k)", (240, 85), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

    # R2 (Rectangle)
    cv2.rectangle(img, (445, 150), (475, 230), color, 2)
    cv2.putText(img, "R2", (485, 195), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

    # GND (Tiered bars)
    cv2.line(img, (440, 310), (480, 310), color, 3)
    cv2.line(img, (448, 316), (472, 316), color, 2)
    cv2.line(img, (454, 322), (466, 322), color, 2)

    bboxes = [
        {"id": "V1", "class": "voltage_source", "bbox": [60, 140, 120, 220], "confidence": 0.96, "value": "10V", "orientation": "vertical"},
        {"id": "R1", "class": "resistor", "bbox": [220, 65, 320, 95], "confidence": 0.94, "value": "1k", "orientation": "horizontal"},
        {"id": "R2", "class": "resistor", "bbox": [445, 150, 475, 230], "confidence": 0.92, "value": "2k", "orientation": "vertical"},
        {"id": "GND1", "class": "ground", "bbox": [438, 308, 482, 326], "confidence": 0.98, "value": "0", "orientation": "horizontal"},
    ]
    return img, bboxes


# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse)
def health_check():
    return HealthResponse(status="healthy", service="diagram-engine", version="1.0.0")


@app.post("/process-diagram", response_model=DiagramProcessResponse)
async def process_diagram(
    file: UploadFile = File(..., description="Schematic diagram image"),
    diagram_id: Optional[str] = Form(None),
):
    """Process an uploaded schematic into SPICE netlist and accessible node tree."""
    try:
        contents = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read uploaded file: {e}")

    np_arr = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Invalid image file format.")

    assigned_id = diagram_id.strip() if diagram_id and diagram_id.strip() else str(uuid.uuid4())

    detector = get_detector()
    tracer = get_wire_tracer()
    graph_engine = get_graph_netlist()
    vis = get_visualizer()

    components = detector.detect(image)
    masked_binary, raw_binary = tracer.preprocess_and_mask(image, components)
    skeleton = tracer.skeletonize(masked_binary)
    junctions = tracer.classify_junctions(skeleton, raw_binary)
    wire_segments = tracer.trace_wire_paths(skeleton, junctions)

    result = graph_engine.process(
        components=components,
        junctions=junctions,
        wire_segments=wire_segments,
        skeleton=skeleton,
    )

    overlay = vis.render_overlay(
        base_image=image,
        skeleton=skeleton,
        components=components,
        junctions=junctions,
        confidence_score=result.confidence_score,
        needs_teacher_review=result.needs_teacher_review,
    )
    b64_overlay = vis.to_base64(overlay)

    node_schemas = [
        ElectricalNodeSchema(
            node_id=n.node_id,
            description=n.description,
            connected_components=[
                ConnectedComponentSchema(component_id=c.component_id, class_name=c.class_name, terminal=c.terminal)
                for c in n.connected_components
            ],
        )
        for n in result.nodes
    ]

    return DiagramProcessResponse(
        diagram_id=assigned_id,
        confidence_score=result.confidence_score,
        needs_teacher_review=result.needs_teacher_review,
        summary=result.summary,
        spice_netlist=result.spice_netlist,
        nodes=node_schemas,
        annotated_image=b64_overlay,
    )


@app.post("/demo-schematic", response_model=DiagramProcessResponse)
def process_demo_schematic(simulate_ambiguity: bool = False):
    """Generates and processes a synthetic voltage divider schematic immediately."""
    image, bboxes = generate_synthetic_voltage_divider()
    if simulate_ambiguity:
        bboxes[1]["confidence"] = 0.55  # Force average confidence below 0.88 for review trigger testing

    detector = get_detector()
    tracer = get_wire_tracer()
    graph_engine = get_graph_netlist()
    vis = get_visualizer()

    components = detector.detect(image, initial_detections=bboxes)
    masked_binary, raw_binary = tracer.preprocess_and_mask(image, components)
    skeleton = tracer.skeletonize(masked_binary)
    junctions = tracer.classify_junctions(skeleton, raw_binary)
    wire_segments = tracer.trace_wire_paths(skeleton, junctions)

    result = graph_engine.process(
        components=components,
        junctions=junctions,
        wire_segments=wire_segments,
        skeleton=skeleton,
    )

    overlay = vis.render_overlay(
        base_image=image,
        skeleton=skeleton,
        components=components,
        junctions=junctions,
        confidence_score=result.confidence_score,
        needs_teacher_review=result.needs_teacher_review,
    )
    b64_overlay = vis.to_base64(overlay)

    node_schemas = [
        ElectricalNodeSchema(
            node_id=n.node_id,
            description=n.description,
            connected_components=[
                ConnectedComponentSchema(component_id=c.component_id, class_name=c.class_name, terminal=c.terminal)
                for c in n.connected_components
            ],
        )
        for n in result.nodes
    ]

    return DiagramProcessResponse(
        diagram_id="voltage-divider-demo-01",
        confidence_score=result.confidence_score,
        needs_teacher_review=result.needs_teacher_review,
        summary=result.summary,
        spice_netlist=result.spice_netlist,
        nodes=node_schemas,
        annotated_image=b64_overlay,
    )


# -----------------------------------------------------------------------------
# Embedded Modern Testing Web UI
# -----------------------------------------------------------------------------

UI_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DrishtiVani - Diagram Engine Testing UI</title>
  <style>
    :root {
      --bg: #0f172a;
      --panel: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --success: #10b981;
      --danger: #ef4444;
      --warning: #f59e0b;
      --code-bg: #090d16;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 24px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 24px;
    }
    .header h1 { font-size: 1.6rem; font-weight: 700; color: #60a5fa; }
    .header p { color: var(--text-muted); font-size: 0.9rem; }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .badge-approved { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid #059669; }
    .badge-review { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid #dc2626; }
    
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    @media (max-width: 980px) { .grid { grid-template-columns: 1fr; } }
    
    .card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
    }
    .card h2 { font-size: 1.15rem; margin-bottom: 14px; color: #e2e8f0; border-bottom: 1px solid var(--border); padding-bottom: 8px; }
    
    .upload-box {
      border: 2px dashed var(--border);
      border-radius: 10px;
      padding: 30px;
      text-align: center;
      cursor: pointer;
      transition: border-color 0.2s;
      background: rgba(15, 23, 42, 0.5);
    }
    .upload-box:hover { border-color: var(--primary); }
    .btn-row { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
    button {
      background: var(--primary);
      color: white;
      border: none;
      padding: 10px 16px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      font-size: 0.9rem;
      transition: background 0.2s;
    }
    button:hover { background: var(--primary-hover); }
    button.btn-sec { background: #475569; }
    button.btn-sec:hover { background: #64748b; }
    button.btn-amb { background: #d97706; }
    button.btn-amb:hover { background: #b45309; }
    
    .img-preview {
      width: 100%;
      border-radius: 8px;
      border: 1px solid var(--border);
      margin-top: 14px;
      background: #000;
      max-height: 380px;
      object-fit: contain;
    }
    pre {
      background: var(--code-bg);
      padding: 14px;
      border-radius: 8px;
      color: #38bdf8;
      font-family: Consolas, monospace;
      font-size: 0.88rem;
      overflow-x: auto;
      border: 1px solid var(--border);
      position: relative;
    }
    .copy-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      padding: 4px 8px;
      font-size: 0.75rem;
      background: #1e293b;
      border: 1px solid var(--border);
    }
    .node-item {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 10px;
    }
    .node-header { font-weight: 700; color: #a78bfa; margin-bottom: 4px; }
    .node-desc { font-size: 0.88rem; color: #cbd5e1; margin-bottom: 6px; }
    .pin-pill {
      display: inline-block;
      padding: 2px 8px;
      background: #1e293b;
      border-radius: 6px;
      font-size: 0.78rem;
      margin-right: 6px;
      color: #38bdf8;
      border: 1px solid var(--border);
    }
    .summary-text { font-size: 0.95rem; color: #cbd5e1; margin-bottom: 14px; }
    #loader { display: none; text-align: center; padding: 20px; color: var(--primary); font-weight: 600; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>DrishtiVani - Diagram to Accessible Netlist Engine</h1>
      <p>Member 2: Computer Vision, Guo-Hall Skeletonization, SPICE (.cir) & Screen-Reader Trees</p>
    </div>
    <div>
      <span id="badge" class="badge badge-approved">Engine Ready</span>
    </div>
  </div>

  <div class="grid">
    <!-- Left Column: Input & Visual Inspection -->
    <div>
      <div class="card">
        <h2>1. Schematic Input & Diagnostics</h2>
        <div class="upload-box" id="dropArea" onclick="document.getElementById('fileInput').click()">
          <p>Drag & drop circuit schematic or <strong>click to browse</strong></p>
          <input type="file" id="fileInput" accept="image/*" style="display:none;" onchange="handleFile(this.files[0])">
        </div>

        <div class="btn-row">
          <button onclick="runDemo(false)">⚡ Quick Test: Clean Divider (Approved &ge; 0.88)</button>
          <button class="btn-amb" onclick="runDemo(true)">⚠️ Test Ambiguity Trigger (&lt; 0.88 Review)</button>
        </div>

        <div id="loader">Processing diagram, thinning wires, and resolving nodes...</div>

        <h2 style="margin-top: 20px;">Diagnostic Computer Vision Overlay</h2>
        <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:8px;">
          Legend: <span style="color:#e6d832;">■ Cyan Skeleton</span> | <span style="color:#32cd32;">● Green Endpoints</span> | <span style="color:#ffd700;">● Yellow T-Junctions</span> | <span style="color:#ff3232;">■ Red Crossings</span>
        </p>
        <img id="overlayImg" class="img-preview" alt="Overlay preview will appear here" style="display:none;">
      </div>
    </div>

    <!-- Right Column: Outputs -->
    <div>
      <div class="card">
        <h2>2. Screen-Reader Macro Summary & Confidence</h2>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <span style="font-weight:600;">Confidence Score: <span id="confScore">--</span></span>
          <span id="reviewTag" class="badge badge-approved">--</span>
        </div>
        <p class="summary-text" id="summaryText">Upload an image or click 'Quick Test' to inspect circuit topology.</p>

        <h2>3. SPICE Netlist (.cir)</h2>
        <pre><button class="copy-btn" onclick="copyNetlist()">Copy</button><code id="spiceCode">* SPICE Netlist will render here...</code></pre>

        <h2 style="margin-top:20px;">4. Screen-Reader Accessible Node Tree</h2>
        <div id="nodeList">
          <p style="color:var(--text-muted); font-size:0.88rem;">Nodes and pin connections will appear here...</p>
        </div>
      </div>
    </div>
  </div>

  <script>
    async function handleFile(file) {
      if (!file) return;
      const formData = new FormData();
      formData.append("file", file);

      showLoading(true);
      try {
        const res = await fetch("/process-diagram", { method: "POST", body: formData });
        const data = await res.json();
        renderResult(data);
      } catch (err) {
        alert("Processing error: " + err);
      } finally {
        showLoading(false);
      }
    }

    async function runDemo(simulateAmbiguity) {
      showLoading(true);
      try {
        const res = await fetch(`/demo-schematic?simulate_ambiguity=${simulateAmbiguity}`, { method: "POST" });
        const data = await res.json();
        renderResult(data);
      } catch (err) {
        alert("Demo error: " + err);
      } finally {
        showLoading(false);
      }
    }

    function renderResult(data) {
      document.getElementById("confScore").innerText = data.confidence_score.toFixed(2);
      const tag = document.getElementById("reviewTag");
      const badge = document.getElementById("badge");

      if (data.needs_teacher_review) {
        tag.className = "badge badge-review";
        tag.innerText = "TEACHER REVIEW REQUIRED (< 0.88)";
        badge.className = "badge badge-review";
        badge.innerText = "Needs Review";
      } else {
        tag.className = "badge badge-approved";
        tag.innerText = "APPROVED (>= 0.88)";
        badge.className = "badge badge-approved";
        badge.innerText = "Approved -> Screen Reader";
      }

      document.getElementById("summaryText").innerText = data.summary;
      document.getElementById("spiceCode").innerText = data.spice_netlist;

      const imgEl = document.getElementById("overlayImg");
      if (data.annotated_image) {
        imgEl.src = data.annotated_image;
        imgEl.style.display = "block";
      }

      // Render Nodes
      const list = document.getElementById("nodeList");
      list.innerHTML = "";
      data.nodes.forEach(n => {
        const div = document.createElement("div");
        div.className = "node-item";
        let pinsHtml = "";
        n.connected_components.forEach(c => {
          pinsHtml += `<span class="pin-pill">${c.component_id} (${c.terminal})</span>`;
        });
        div.innerHTML = `
          <div class="node-header">Node ${n.node_id}</div>
          <div class="node-desc">${n.description}</div>
          <div>${pinsHtml}</div>
        `;
        list.appendChild(div);
      });
    }

    function showLoading(show) {
      document.getElementById("loader").style.display = show ? "block" : "none";
    }

    function copyNetlist() {
      const code = document.getElementById("spiceCode").innerText;
      navigator.clipboard.writeText(code);
      alert("SPICE netlist copied to clipboard!");
    }
  </script>
</body>
</html>
"""

@app.get("/", response_class=HTMLResponse)
@app.get("/ui", response_class=HTMLResponse)
def serve_ui():
    """Serves the interactive testing dashboard UI."""
    return HTMLResponse(content=UI_HTML)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("diagram_engine.api:app", host="0.0.0.0", port=8001, reload=True)
