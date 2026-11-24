"use client";

import { CONFIDENCE_REVIEW_THRESHOLD } from "@/lib/mock-data";
import type { ExtractedBlock, PageMetadata } from "@/types/document";

interface PagePreviewCanvasProps {
  page: PageMetadata;
  blocks: ExtractedBlock[];
  selectedBlockId: string | null;
  onSelectBlock: (blockId: string) => void;
}

const TYPE_STROKE: Record<ExtractedBlock["type"], string> = {
  heading: "#2563eb",
  text: "#4b5563",
  equation: "#7c3aed",
  table: "#0d9488",
  diagram: "#d97706",
};

export default function PagePreviewCanvas({
  page,
  blocks,
  selectedBlockId,
  onSelectBlock,
}: PagePreviewCanvasProps) {
  const hasRealImage = Boolean(page.imageUrl);

  return (
    <div className="paper-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-extrabold text-[#211f1b]">
            {page.title}
          </h2>
          <p className="text-xs text-[#3b362f]">
            {page.width}×{page.height}px · {page.dpi} DPI · Click any bounding
            box to inspect
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#fde8cc] px-2.5 py-0.5 text-[#7c2d12]">
            <span className="h-2 w-2 rounded-full bg-[#dc2626]" />
            Flagged (&lt; 0.88 / needs review)
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#e3f2d9] px-2.5 py-0.5 text-[#213a18]">
            <span className="h-2 w-2 rounded-full bg-[#16a34a]" />
            Approved
          </span>
        </div>
      </div>

      {/* Real backend page image OR simulated Demo Mode page + interactive SVG bounding-box overlay */}
      <div
        className="relative w-full overflow-hidden rounded-xl border-2 border-[#211f1b] bg-[#fffefb] shadow-inner"
        style={{ aspectRatio: `${page.width} / ${page.height}` }}
      >
        {hasRealImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={page.imageUrl}
            alt={`Scanned page ${page.pageNumber}`}
            className="h-full w-full object-contain"
          />
        ) : (
          <>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#e5dfd3_1px,transparent_1px)] [background-size:18px_18px] opacity-45" />
            {blocks.map((block) => {
              const leftPct = (block.bbox.x / page.width) * 100;
              const topPct = (block.bbox.y / page.height) * 100;
              const widthPct = (block.bbox.width / page.width) * 100;
              const heightPct = (block.bbox.height / page.height) * 100;

              return (
                <div
                  key={`preview-${block.id}`}
                  aria-hidden="true"
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    width: `${widthPct}%`,
                    height: `${heightPct}%`,
                  }}
                  className="pointer-events-none absolute overflow-hidden p-1.5 text-[#211f1b]"
                >
                  {block.type === "heading" && (
                    <p
                      className={`font-extrabold leading-tight ${
                        block.headingLevel === "H1"
                          ? "text-sm sm:text-base"
                          : "text-xs sm:text-sm"
                      }`}
                    >
                      {block.content}
                    </p>
                  )}
                  {block.type === "text" && (
                    <p className="line-clamp-4 text-[10px] leading-snug text-[#3b362f] sm:text-xs">
                      {block.content}
                    </p>
                  )}
                  {block.type === "equation" && (
                    <div className="flex h-full items-center justify-center rounded bg-[#f5f0ff]/80 px-2 font-mono text-[10px] font-bold text-[#4c1d95] sm:text-xs">
                      {block.content}
                    </div>
                  )}
                  {block.type === "table" && block.table && (
                    <div className="h-full overflow-hidden rounded border border-[#cbd5e1] bg-white/90 p-1 text-[9px] sm:text-[10px]">
                      <div className="font-bold text-[#0f766e]">
                        {block.table.caption}
                      </div>
                      <div className="mt-1 grid grid-cols-4 gap-1 border-b border-[#e2e8f0] pb-0.5 font-semibold">
                        {block.table.headers.slice(0, 4).map((h) => (
                          <span key={h} className="truncate">
                            {h}
                          </span>
                        ))}
                      </div>
                      {block.table.rows.slice(0, 3).map((row, idx) => (
                        <div key={idx} className="grid grid-cols-4 gap-1 py-0.5">
                          {row.slice(0, 4).map((cell, cIdx) => (
                            <span key={cIdx} className="truncate">
                              {cell}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                  {block.type === "diagram" && (
                    <div className="flex h-full flex-col items-center justify-center rounded border border-dashed border-[#d97706] bg-[#fffbeb]/85 p-2 text-center">
                      <span className="text-[10px] font-extrabold uppercase tracking-wide text-[#92400e] sm:text-xs">
                        [Diagram] {block.diagram?.title ?? "Circuit Schematic"}
                      </span>
                      <span className="mt-1 line-clamp-3 text-[9px] text-[#78350f] sm:text-[11px]">
                        {block.diagram?.description ?? block.content}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* Interactive SVG Bounding Box Overlay */}
        <svg
          viewBox={`0 0 ${page.width} ${page.height}`}
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label={`Document page ${page.pageNumber} with ${blocks.length} interactive bounding boxes`}
        >
          {blocks.map((block) => {
            const isSelected = block.id === selectedBlockId;
            const isFlagged =
              block.needsReview === true ||
              block.confidence < CONFIDENCE_REVIEW_THRESHOLD;
            const strokeColor =
              block.verificationStatus === "approved"
                ? "#16a34a"
                : isFlagged
                  ? "#dc2626"
                  : TYPE_STROKE[block.type];

            const fillColor = isSelected
              ? "rgba(255, 224, 138, 0.36)"
              : isFlagged
                ? "rgba(220, 38, 38, 0.08)"
                : "rgba(37, 99, 235, 0.04)";

            return (
              <g
                key={block.id}
                onClick={() => onSelectBlock(block.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectBlock(block.id);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Select block ${block.order}: ${block.type}${
                  block.headingLevel ? ` ${block.headingLevel}` : ""
                }, confidence ${Math.round(block.confidence * 100)}%`}
                className="cursor-pointer focus:outline-none"
              >
                <rect
                  x={block.bbox.x}
                  y={block.bbox.y}
                  width={block.bbox.width}
                  height={block.bbox.height}
                  rx={8}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={isSelected ? 6 : isFlagged ? 4 : 2.5}
                  strokeDasharray={
                    isFlagged && !isSelected ? "10 6" : undefined
                  }
                />
                <rect
                  x={block.bbox.x}
                  y={Math.max(0, block.bbox.y - 26)}
                  width={165}
                  height={24}
                  rx={5}
                  fill={isSelected ? "#211f1b" : strokeColor}
                />
                <text
                  x={block.bbox.x + 8}
                  y={Math.max(16, block.bbox.y - 9)}
                  fill="#ffffff"
                  fontSize="14"
                  fontWeight="700"
                  fontFamily="sans-serif"
                >
                  #{block.order} {block.headingLevel ?? block.type} (
                  {block.confidence.toFixed(2)})
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
