"use client";

import { CONFIDENCE_REVIEW_THRESHOLD } from "@/lib/mock-data";
import type { ExtractedBlock, VerificationStatus } from "@/types/document";

interface ExtractedBlocksPanelProps {
  blocks: ExtractedBlock[];
  selectedBlockId: string | null;
  onSelectBlock: (blockId: string) => void;
}

const VERIFICATION_BADGE: Record<
  VerificationStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className: "bg-[#ffe08a] text-[#211f1b]",
  },
  approved: {
    label: "Approved",
    className: "bg-[#e3f2d9] text-[#213a18]",
  },
  rejected: {
    label: "Rejected",
    className: "bg-[#fde2e1] text-[#7f1d1d]",
  },
  edited: {
    label: "Edited",
    className: "bg-[#e2ecff] text-[#1d3b75]",
  },
};

export default function ExtractedBlocksPanel({
  blocks,
  selectedBlockId,
  onSelectBlock,
}: ExtractedBlocksPanelProps) {
  return (
    <div className="paper-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold text-[#211f1b]">
          Extracted blocks ({blocks.length})
        </h2>
        <span className="text-xs font-semibold text-[#3b362f]">
          Threshold: {CONFIDENCE_REVIEW_THRESHOLD.toFixed(2)}
        </span>
      </div>

      {blocks.length === 0 ? (
        <p className="rounded-xl bg-[#faf7f0] p-4 text-xs font-semibold text-[#3b362f]">
          No layout blocks returned for this page.
        </p>
      ) : (
        <div className="max-h-[460px] space-y-2.5 overflow-y-auto pr-1">
          {blocks.map((block) => {
            const isSelected = block.id === selectedBlockId;
            const isFlagged =
              block.needsReview === true ||
              block.confidence < CONFIDENCE_REVIEW_THRESHOLD;
            const badge = VERIFICATION_BADGE[block.verificationStatus];

            return (
              <button
                key={block.id}
                type="button"
                onClick={() => onSelectBlock(block.id)}
                aria-pressed={isSelected}
                className={`w-full rounded-2xl border-2 p-3.5 text-left transition-all ${
                  isSelected
                    ? "border-[#211f1b] bg-[#ffe08a]/35 shadow-[2px_3px_0_#211f1b]"
                    : isFlagged && block.verificationStatus === "pending"
                      ? "border-[#dc2626]/60 bg-[#fff5f5] hover:border-[#211f1b]"
                      : "border-[#d9d0c3] bg-[#fffcf6] hover:border-[#211f1b]"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-[#211f1b] px-2 py-0.5 text-xs font-bold text-[#fffcf6]">
                      #{block.order}
                    </span>
                    <span className="text-xs font-extrabold uppercase tracking-wide text-[#211f1b]">
                      {block.headingLevel
                        ? `Heading (${block.headingLevel})`
                        : block.rawType ?? block.type}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        isFlagged
                          ? "bg-[#fde2e1] text-[#991b1b]"
                          : "bg-[#f2ece0] text-[#3b362f]"
                      }`}
                    >
                      {block.confidence.toFixed(2)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                </div>

                {isFlagged && block.verificationStatus === "pending" && (
                  <p className="mt-1.5 text-xs font-bold text-[#991b1b]">
                    Flagged for review (layout:{" "}
                    {(block.layoutConfidence ?? block.confidence).toFixed(2)}
                    {typeof block.ocrConfidence === "number"
                      ? `, ocr: ${block.ocrConfidence.toFixed(2)}`
                      : ""}
                    )
                  </p>
                )}

                {block.content ? (
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[#3b362f]">
                    {block.content}
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs italic text-[#7c2d12]">
                    No OCR text extracted (OCR unavailable or pending manual
                    entry)
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
