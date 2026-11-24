import {
  CONFIDENCE_REVIEW_THRESHOLD,
  INITIAL_MOCK_DOCUMENTS,
} from "@/lib/mock-data";
import type {
  BlockType,
  BlockVerificationUpdate,
  DocumentRecord,
  ExtractedBlock,
  HeadingLevel,
  HealthCheckResult,
  PageMetadata,
  ProcessingStatus,
  TableContent,
  VerificationStatus,
} from "@/types/document";

const DEMO_STORAGE_KEY = "drishtivani_demo_documents_v1";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/+$/, "");

export const DIAGRAM_API_URL = (
  process.env.NEXT_PUBLIC_DIAGRAM_API_URL ?? "http://localhost:8001"
).replace(/\/+$/, "");

export const TRANSCRIPTION_API_URL = (
  process.env.NEXT_PUBLIC_TRANSCRIPTION_API_URL ?? "http://localhost:8002"
).replace(/\/+$/, "");

export function isDemoMode(): boolean {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "false" && API_BASE_URL) {
    return false;
  }
  return true;
}

export function resolveBackendUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

// -----------------------------------------------------------------------------
// Demo Mode LocalStorage Store
// -----------------------------------------------------------------------------

function cloneInitialDocuments(): DocumentRecord[] {
  return JSON.parse(JSON.stringify(INITIAL_MOCK_DOCUMENTS)) as DocumentRecord[];
}

function readDemoStore(): DocumentRecord[] {
  if (typeof window === "undefined") {
    return cloneInitialDocuments();
  }
  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) {
      const seed = cloneInitialDocuments();
      window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(raw) as DocumentRecord[];
  } catch {
    return cloneInitialDocuments();
  }
}

function writeDemoStore(docs: DocumentRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(docs));
  } catch {
    // Ignore storage quota errors in demo mode
  }
}

export function resetDemoDocuments(): DocumentRecord[] {
  const fresh = cloneInitialDocuments();
  writeDemoStore(fresh);
  return fresh;
}

export function countLowConfidenceBlocks(doc: DocumentRecord): number {
  if (typeof doc.flaggedBlocks === "number" && doc.blocks.length === 0) {
    return doc.flaggedBlocks;
  }
  const threshold = doc.lowConfidenceThreshold ?? CONFIDENCE_REVIEW_THRESHOLD;
  return doc.blocks.filter(
    (b) =>
      (b.needsReview === true || b.confidence < threshold) &&
      b.verificationStatus === "pending",
  ).length;
}

// -----------------------------------------------------------------------------
// Backend Response Mappers (ingestion-service FastAPI contracts)
// -----------------------------------------------------------------------------

interface BackendDocumentListItem {
  id: string;
  title: string;
  filename: string;
  page_count: number;
  status: string;
  total_blocks: number;
  flagged_blocks: number;
  created_at?: string | null;
}

interface BackendTableCell {
  row: number;
  col: number;
  is_header?: boolean;
  text?: string;
}

interface BackendTableGrid {
  rows?: Array<{ cells?: BackendTableCell[] }>;
}

interface BackendBlockLayout {
  id: string;
  type: string;
  reading_order: number;
  bbox: number[];
  text?: string | null;
  crop_url?: string | null;
  layout_confidence: number;
  ocr_confidence?: number | null;
  needs_review: boolean;
  verification_status: VerificationStatus;
  table?: BackendTableGrid | null;
  extra?: Record<string, unknown> | null;
}

interface BackendPageLayout {
  page_number: number;
  width_px: number;
  height_px: number;
  image_url: string;
  blocks: BackendBlockLayout[];
}

interface BackendDocumentLayout {
  document_id: string;
  title: string;
  pages: BackendPageLayout[];
}

function mapBlockType(rawType: string): {
  type: BlockType;
  headingLevel?: HeadingLevel;
} {
  if (rawType === "heading_h1") return { type: "heading", headingLevel: "H1" };
  if (rawType === "heading_h2") return { type: "heading", headingLevel: "H2" };
  if (rawType === "heading_h3") return { type: "heading", headingLevel: "H3" };
  if (rawType === "equation") return { type: "equation" };
  if (rawType === "table") return { type: "table" };
  if (rawType === "diagram") return { type: "diagram" };
  return { type: "text" };
}

function mapTableGrid(table?: BackendTableGrid | null): TableContent | undefined {
  if (!table?.rows || table.rows.length === 0) return undefined;
  const grid = table.rows.map((r) =>
    (r.cells ?? []).map((c) => c.text ?? ""),
  );
  if (grid.length === 0) return undefined;
  return {
    caption: "Extracted Table",
    headers: grid[0] ?? [],
    rows: grid.slice(1),
  };
}

function mapBackendBlock(
  b: BackendBlockLayout,
  pageNumber: number,
): ExtractedBlock {
  const [x0 = 0, y0 = 0, x1 = 0, y1 = 0] = b.bbox ?? [];
  const { type, headingLevel } = mapBlockType(b.type);
  const confidence =
    typeof b.ocr_confidence === "number"
      ? b.ocr_confidence
      : b.layout_confidence;

  const extraNetlist =
    b.extra && typeof b.extra.circuit_netlist === "string"
      ? b.extra.circuit_netlist
      : undefined;

  return {
    id: b.id,
    pageNumber,
    order: b.reading_order + 1,
    type,
    rawType: b.type,
    headingLevel,
    content: b.text ?? "",
    table: mapTableGrid(b.table),
    diagram:
      type === "diagram"
        ? {
            title: "Detected Diagram Region",
            description: b.text || "Diagram crop extracted for review.",
            spiceNetlist: extraNetlist,
          }
        : undefined,
    bbox: {
      x: x0,
      y: y0,
      width: Math.max(0, x1 - x0),
      height: Math.max(0, y1 - y0),
    },
    confidence,
    layoutConfidence: b.layout_confidence,
    ocrConfidence: b.ocr_confidence ?? null,
    needsReview: b.needs_review,
    cropUrl: resolveBackendUrl(b.crop_url),
    extra: b.extra ?? null,
    verificationStatus: b.verification_status ?? "pending",
  };
}

function mapBackendStatus(status: string): ProcessingStatus {
  const valid: ProcessingStatus[] = [
    "uploaded",
    "queued",
    "processing",
    "parsed",
    "published",
    "awaiting_review",
    "approved",
    "failed",
  ];
  return valid.includes(status as ProcessingStatus)
    ? (status as ProcessingStatus)
    : "processing";
}

// -----------------------------------------------------------------------------
// Public API Client Functions
// -----------------------------------------------------------------------------

export async function checkBackendHealth(): Promise<HealthCheckResult> {
  if (isDemoMode()) {
    return {
      status: "healthy",
      database: { status: "connected", mode: "demo_mock" },
      storage: { status: "connected", mode: "demo_mock" },
    };
  }

  const res = await fetch(`${API_BASE_URL}/health`, { cache: "no-store" });
  const data = (await res.json()) as HealthCheckResult;
  if (!res.ok && res.status !== 503) {
    throw new Error(`Health check failed (${res.status})`);
  }
  return data;
}

export async function fetchDocuments(): Promise<DocumentRecord[]> {
  if (isDemoMode()) {
    return readDemoStore();
  }

  const res = await fetch(`${API_BASE_URL}/documents`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch documents (${res.status})`);
  }
  const items = (await res.json()) as BackendDocumentListItem[];

  return items.map((item) => ({
    id: item.id,
    filename: item.filename,
    title: item.title,
    subject: "Uploaded Handout",
    uploadedAt: item.created_at ?? new Date().toISOString(),
    processingStatus: mapBackendStatus(item.status),
    totalPages: item.page_count,
    totalBlocks: item.total_blocks,
    flaggedBlocks: item.flagged_blocks,
    lowConfidenceThreshold: CONFIDENCE_REVIEW_THRESHOLD,
    pages: [],
    blocks: [],
  }));
}

export async function fetchDocumentStatus(docId: string): Promise<{
  document_id: string;
  title: string;
  status: ProcessingStatus;
  page_count: number;
  error_message?: string | null;
}> {
  const res = await fetch(`${API_BASE_URL}/documents/${docId}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch document status (${res.status})`);
  }
  const data = await res.json();
  return {
    ...data,
    status: mapBackendStatus(data.status),
  };
}

export async function fetchDocumentById(
  docId: string,
): Promise<DocumentRecord | null> {
  if (isDemoMode()) {
    const docs = readDemoStore();
    return docs.find((d) => d.id === docId) ?? null;
  }

  const [layoutRes, statusData] = await Promise.all([
    fetch(`${API_BASE_URL}/documents/${docId}/layout`, { cache: "no-store" }),
    fetchDocumentStatus(docId).catch(() => null),
  ]);

  if (layoutRes.status === 404) return null;
  if (!layoutRes.ok) {
    throw new Error(`Failed to fetch document layout (${layoutRes.status})`);
  }

  const layout = (await layoutRes.json()) as BackendDocumentLayout;

  const pages: PageMetadata[] = layout.pages.map((p) => ({
    pageNumber: p.page_number,
    width: p.width_px,
    height: p.height_px,
    dpi: 150,
    title: `Page ${p.page_number}`,
    imageUrl: resolveBackendUrl(p.image_url),
  }));

  const blocks: ExtractedBlock[] = layout.pages.flatMap((p) =>
    p.blocks.map((b) => mapBackendBlock(b, p.page_number)),
  );

  return {
    id: layout.document_id,
    filename: `${layout.title}.pdf`,
    title: layout.title,
    subject: "Ingested Document",
    uploadedAt: new Date().toISOString(),
    processingStatus: statusData?.status ?? "parsed",
    totalPages: pages.length,
    totalBlocks: blocks.length,
    flaggedBlocks: blocks.filter((b) => b.needsReview).length,
    errorMessage: statusData?.error_message ?? null,
    lowConfidenceThreshold: CONFIDENCE_REVIEW_THRESHOLD,
    pages,
    blocks,
  };
}

export async function fetchPageBlocks(
  docId: string,
  pageNumber: number,
): Promise<ExtractedBlock[]> {
  if (isDemoMode()) {
    const doc = await fetchDocumentById(docId);
    return (doc?.blocks ?? []).filter((b) => b.pageNumber === pageNumber);
  }

  const res = await fetch(
    `${API_BASE_URL}/documents/${docId}/pages/${pageNumber}/blocks`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch page blocks (${res.status})`);
  }
  const rawBlocks = (await res.json()) as BackendBlockLayout[];
  return rawBlocks.map((b) => mapBackendBlock(b, pageNumber));
}

export async function uploadDocument(
  file: File,
  title?: string,
): Promise<{ documentId: string; status: ProcessingStatus }> {
  if (isDemoMode()) {
    const created = await uploadDemoDocument(file.name);
    return { documentId: created.id, status: created.processingStatus };
  }

  const formData = new FormData();
  formData.append("file", file);
  if (title?.trim()) {
    formData.append("title", title.trim());
  }

  const res = await fetch(`${API_BASE_URL}/documents`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      errBody.detail || `PDF upload failed (${res.status})`,
    );
  }

  const data = await res.json();
  return {
    documentId: data.document_id,
    status: mapBackendStatus(data.status),
  };
}

export async function updateBlockVerification(
  docId: string,
  blockId: string,
  update: BlockVerificationUpdate,
): Promise<{ verificationStatus: VerificationStatus; needsReview: boolean }> {
  if (isDemoMode()) {
    const docs = readDemoStore();
    const doc = docs.find((d) => d.id === docId);
    if (!doc) throw new Error(`Document ${docId} not found`);

    const block = doc.blocks.find((b) => b.id === blockId);
    if (!block) throw new Error(`Block ${blockId} not found`);

    block.verificationStatus = update.verificationStatus;
    if (typeof update.content === "string") {
      block.content = update.content;
    }
    if (typeof update.correctedNetlist === "string") {
      block.diagram = {
        title: block.diagram?.title ?? "Circuit Schematic",
        description: block.diagram?.description ?? block.content,
        spiceNetlist: update.correctedNetlist,
        nodesSummary: block.diagram?.nodesSummary,
      };
    }
    if (typeof update.reviewerNote === "string") {
      block.reviewerNote = update.reviewerNote;
    }
    block.needsReview = update.verificationStatus === "rejected";

    const hasPending = doc.blocks.some(
      (b) => b.verificationStatus === "pending",
    );
    doc.processingStatus = hasPending ? "awaiting_review" : "approved";

    writeDemoStore(docs);
    return {
      verificationStatus: block.verificationStatus,
      needsReview: Boolean(block.needsReview),
    };
  }

  const payload: Record<string, unknown> = {
    verification_status: update.verificationStatus,
    verified_by: update.verifiedBy ?? "teacher_portal",
  };
  if (typeof update.content === "string") {
    payload.corrected_text = update.content;
  }
  if (typeof update.correctedNetlist === "string") {
    payload.corrected_netlist = update.correctedNetlist;
  }

  const res = await fetch(`${API_BASE_URL}/blocks/${blockId}/verification`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      errBody.detail || `Failed to update block (${res.status})`,
    );
  }
  const data = await res.json();
  return {
    verificationStatus: data.verification_status,
    needsReview: Boolean(data.needs_review),
  };
}

export async function publishDocument(docId: string): Promise<{
  status: string;
  document_id: string;
  message: string;
}> {
  if (isDemoMode()) {
    const docs = readDemoStore();
    const doc = docs.find((d) => d.id === docId);
    if (!doc) throw new Error(`Document ${docId} not found`);
    doc.processingStatus = "published";
    for (const block of doc.blocks) {
      block.needsReview = false;
      if (block.verificationStatus === "pending") {
        block.verificationStatus = "approved";
      }
    }
    writeDemoStore(docs);
    return {
      status: "published",
      document_id: doc.id,
      message: `Document '${doc.title}' published in Demo Mode.`,
    };
  }

  const res = await fetch(`${API_BASE_URL}/documents/${docId}/publish`, {
    method: "POST",
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      errBody.detail || `Failed to publish document (${res.status})`,
    );
  }
  return res.json();
}

export async function analyzeDiagramCrop(cropUrl: string): Promise<{
  summary: string;
  spiceNetlist: string;
  confidenceScore: number;
}> {
  const imgRes = await fetch(cropUrl);
  if (!imgRes.ok) {
    throw new Error(`Could not fetch diagram crop (${imgRes.status})`);
  }
  const blob = await imgRes.blob();
  const formData = new FormData();
  formData.append("file", blob, "diagram_crop.png");

  const res = await fetch(`${DIAGRAM_API_URL}/process-diagram`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    throw new Error(`Diagram Engine error (${res.status})`);
  }
  const data = await res.json();
  return {
    summary: data.summary ?? "",
    spiceNetlist: data.spice_netlist ?? "",
    confidenceScore: data.confidence_score ?? 0,
  };
}

export async function transcribeMathCrop(cropUrl: string): Promise<{
  latex: string;
  mathml: string;
  nemeth: string;
}> {
  const imgRes = await fetch(cropUrl);
  if (!imgRes.ok) {
    throw new Error(`Could not fetch equation crop (${imgRes.status})`);
  }
  const blob = await imgRes.blob();
  const formData = new FormData();
  formData.append("file", blob, "math_crop.png");

  const res = await fetch(
    `${TRANSCRIPTION_API_URL}/api/v1/transcription/process-math-crop`,
    {
      method: "POST",
      body: formData,
    },
  );
  if (!res.ok) {
    throw new Error(`Transcription Engine error (${res.status})`);
  }
  const json = await res.json();
  return {
    latex: json.data?.latex ?? "",
    mathml: json.data?.mathml ?? "",
    nemeth: json.data?.nemeth ?? "",
  };
}

export function buildBrfFallbackContent(doc: DocumentRecord): string {
  const lines: string[] = [
    `DRISHTIVANI ACCESSIBLE BRAILLE EXPORT`,
    `TITLE: ${doc.title}`,
    `========================================`,
    "",
  ];
  for (const b of doc.blocks) {
    if (b.verificationStatus === "rejected") continue;
    if (b.type === "heading") {
      lines.push(`[${b.headingLevel ?? "HEADING"}] ${b.content}`);
    } else if (b.type === "equation") {
      lines.push(`[EQUATION] ${b.math?.nemeth ?? b.math?.latex ?? b.content}`);
    } else if (b.type === "diagram") {
      lines.push(`[DIAGRAM] ${b.diagram?.description ?? b.content}`);
      if (b.diagram?.spiceNetlist) {
        lines.push(b.diagram.spiceNetlist);
      }
    } else if (b.type === "table" && b.table) {
      lines.push(`[TABLE] ${b.table.caption}`);
      lines.push(b.table.headers.join(" | "));
      for (const row of b.table.rows) {
        lines.push(row.join(" | "));
      }
    } else if (b.content) {
      lines.push(b.content);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export async function uploadDemoDocument(
  fileName: string,
): Promise<DocumentRecord> {
  const docs = readDemoStore();
  const newDoc: DocumentRecord = {
    id: `doc-upload-${Date.now()}`,
    filename: fileName,
    title: fileName.replace(/\.pdf$/i, "").replace(/[_-]+/g, " "),
    subject: "Uploaded Handout (Demo)",
    uploadedAt: new Date().toISOString(),
    processingStatus: "processing",
    totalPages: 1,
    lowConfidenceThreshold: CONFIDENCE_REVIEW_THRESHOLD,
    pages: [
      {
        pageNumber: 1,
        width: 1000,
        height: 1400,
        dpi: 150,
        title: "Page 1 — Queued for Layout Extraction",
      },
    ],
    blocks: [
      {
        id: `blk-demo-${Date.now()}`,
        pageNumber: 1,
        order: 1,
        type: "heading",
        headingLevel: "H1",
        content: `${fileName} (Mock Extraction Preview)`,
        bbox: { x: 70, y: 80, width: 840, height: 64 },
        confidence: 0.85,
        verificationStatus: "pending",
        reviewerNote: "Sample placeholder block generated in Demo Mode.",
      },
    ],
  };
  const updated = [newDoc, ...docs];
  writeDemoStore(updated);
  return newDoc;
}
