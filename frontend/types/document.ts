export type ProcessingStatus =
  | "uploaded"
  | "queued"
  | "processing"
  | "parsed"
  | "published"
  | "awaiting_review"
  | "approved"
  | "failed";

export type VerificationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "edited";

export type BlockType =
  | "heading"
  | "text"
  | "equation"
  | "table"
  | "diagram";

export type HeadingLevel = "H1" | "H2" | "H3";

/**
 * Bounding box in page pixel coordinates { x, y, width, height }.
 * Mapped from backend [x0, y0, x1, y1] in api-client.ts.
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TableContent {
  caption: string;
  headers: string[];
  rows: string[][];
}

export interface DiagramContent {
  title: string;
  description: string;
  spiceNetlist?: string;
  nodesSummary?: string[];
}

export interface MathContent {
  latex: string;
  spokenText: string;
  mathml?: string;
  nemeth?: string;
}

export interface ExtractedBlock {
  id: string;
  pageNumber: number;
  order: number;
  type: BlockType;
  rawType?: string;
  headingLevel?: HeadingLevel;
  content: string;
  math?: MathContent;
  table?: TableContent;
  diagram?: DiagramContent;
  bbox: BoundingBox;
  confidence: number;
  layoutConfidence?: number;
  ocrConfidence?: number | null;
  needsReview?: boolean;
  cropUrl?: string | null;
  extra?: Record<string, unknown> | null;
  verificationStatus: VerificationStatus;
  reviewerNote?: string;
}

export interface PageMetadata {
  pageNumber: number;
  width: number;
  height: number;
  dpi: number;
  title: string;
  imageUrl?: string;
}

export interface DocumentRecord {
  id: string;
  filename: string;
  title: string;
  subject: string;
  uploadedAt: string;
  processingStatus: ProcessingStatus;
  totalPages: number;
  totalBlocks?: number;
  flaggedBlocks?: number;
  errorMessage?: string | null;
  lowConfidenceThreshold: number;
  pages: PageMetadata[];
  blocks: ExtractedBlock[];
}

export interface BlockVerificationUpdate {
  verificationStatus: VerificationStatus;
  content?: string;
  correctedNetlist?: string;
  reviewerNote?: string;
  verifiedBy?: string;
}

export interface HealthCheckResult {
  status: "healthy" | "unhealthy";
  database: Record<string, unknown>;
  storage: Record<string, unknown>;
}
