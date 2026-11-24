"use client";

import { useState } from "react";
import { analyzeDiagramCrop, transcribeMathCrop } from "@/lib/api-client";
import { CONFIDENCE_REVIEW_THRESHOLD } from "@/lib/mock-data";
import type {
  BlockVerificationUpdate,
  ExtractedBlock,
} from "@/types/document";

interface BlockEditorControlsProps {
  block: ExtractedBlock | null;
  onUpdateBlock: (
    blockId: string,
    update: BlockVerificationUpdate,
  ) => Promise<void>;
}

export default function BlockEditorControls({
  block,
  onUpdateBlock,
}: BlockEditorControlsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftContent, setDraftContent] = useState("");
  const [draftNetlist, setDraftNetlist] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!block) {
    return (
      <div className="paper-card p-5 text-sm font-semibold text-[#3b362f]">
        Select a block or bounding box to inspect, edit, approve, or reject.
      </div>
    );
  }

  const isFlagged =
    block.needsReview === true ||
    block.confidence < CONFIDENCE_REVIEW_THRESHOLD;

  function startEditing() {
    if (!block) return;
    setDraftContent(block.content);
    setDraftNetlist(block.diagram?.spiceNetlist ?? "");
    setDraftNote(block.reviewerNote ?? "");
    setSaveError(null);
    setIsEditing(true);
  }

  async function handleAction(update: BlockVerificationUpdate) {
    if (!block || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onUpdateBlock(block.id, update);
      setIsEditing(false);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save verification.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRunDiagramEngine() {
    if (!block?.cropUrl || enriching) return;
    setEnriching(true);
    setSaveError(null);
    try {
      const res = await analyzeDiagramCrop(block.cropUrl);
      setDraftContent(res.summary);
      setDraftNetlist(res.spiceNetlist);
      setIsEditing(true);
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : "Diagram Engine (port 8001) unavailable.",
      );
    } finally {
      setEnriching(false);
    }
  }

  async function handleRunMathOcr() {
    if (!block?.cropUrl || enriching) return;
    setEnriching(true);
    setSaveError(null);
    try {
      const res = await transcribeMathCrop(block.cropUrl);
      setDraftContent(res.latex);
      setDraftNote(`Nemeth: ${res.nemeth}`);
      setIsEditing(true);
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : "Transcription Engine (port 8002) unavailable.",
      );
    } finally {
      setEnriching(false);
    }
  }

  return (
    <div className="paper-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e4dccf] pb-3">
        <div>
          <h3 className="text-base font-extrabold text-[#211f1b]">
            Block #{block.order} ·{" "}
            {block.headingLevel
              ? `Heading ${block.headingLevel}`
              : (block.rawType ?? block.type).toUpperCase()}
          </h3>
          <p className="text-xs text-[#3b362f]">
            BBox: ({Math.round(block.bbox.x)}, {Math.round(block.bbox.y)}) ·{" "}
            {Math.round(block.bbox.width)}×{Math.round(block.bbox.height)}px
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            isFlagged
              ? "bg-[#fde2e1] text-[#991b1b]"
              : "bg-[#e3f2d9] text-[#213a18]"
          }`}
        >
          Layout: {(block.layoutConfidence ?? block.confidence).toFixed(2)}
          {typeof block.ocrConfidence === "number"
            ? ` · OCR: ${block.ocrConfidence.toFixed(2)}`
            : ""}
        </span>
      </div>

      {saveError && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-[#fde2e1] px-3 py-2 text-xs font-bold text-[#7f1d1d]"
        >
          {saveError}
        </p>
      )}

      {block.reviewerNote && !isEditing && (
        <p className="mt-3 rounded-xl bg-[#ffe08a]/40 px-3 py-2 text-xs font-semibold text-[#211f1b]">
          Note: {block.reviewerNote}
        </p>
      )}

      {isEditing ? (
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wide text-[#3b362f]">
            Corrected block text
            <textarea
              rows={4}
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              placeholder="Enter corrected text for this region..."
              className="paper-input mt-1.5 w-full p-3 text-sm"
            />
          </label>
          {block.type === "diagram" && (
            <label className="block text-xs font-bold uppercase tracking-wide text-[#3b362f]">
              SPICE Netlist (.cir)
              <textarea
                rows={4}
                value={draftNetlist}
                onChange={(e) => setDraftNetlist(e.target.value)}
                placeholder="* Optional SPICE netlist..."
                className="paper-input mt-1.5 w-full p-3 font-mono text-xs"
              />
            </label>
          )}
          <label className="block text-xs font-bold uppercase tracking-wide text-[#3b362f]">
            Reviewer note (optional)
            <input
              type="text"
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
              placeholder="e.g. Manually transcribed equation"
              className="paper-input mt-1.5 w-full px-3 py-2 text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                handleAction({
                  verificationStatus: "edited",
                  content: draftContent,
                  correctedNetlist:
                    block.type === "diagram" && draftNetlist.trim()
                      ? draftNetlist
                      : undefined,
                  reviewerNote: draftNote,
                })
              }
              className="sketch-button px-4 py-2 text-xs"
            >
              {saving ? "Saving..." : "Save edit"}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="sketch-button-secondary px-4 py-2 text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {block.content ? (
            <div className="rounded-xl border border-[#e4dccf] bg-[#faf7f0] p-3 text-sm leading-relaxed text-[#211f1b]">
              {block.content}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#d97706] bg-[#fffbeb] p-3 text-xs font-semibold text-[#92400e]">
              No OCR text extracted for this block (OCR engine unavailable or
              pending). Use <strong>Edit</strong> to enter text manually.
            </div>
          )}

          {block.math && (
            <div className="rounded-xl border border-[#d9d0c3] bg-[#f5f0ff]/60 p-3 text-xs">
              <p className="font-bold text-[#4c1d95]">LaTeX: {block.math.latex}</p>
              <p className="mt-1 text-[#3b362f]">
                Spoken: &ldquo;{block.math.spokenText}&rdquo;
              </p>
            </div>
          )}

          {block.diagram?.spiceNetlist && (
            <pre className="overflow-x-auto rounded-xl border border-[#d9d0c3] bg-[#211f1b] p-3 font-mono text-xs text-[#ffe08a]">
              {block.diagram.spiceNetlist}
            </pre>
          )}

          <div className="flex flex-wrap gap-2.5 pt-1">
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                handleAction({ verificationStatus: "approved" })
              }
              className="rounded-full border-2 border-[#211f1b] bg-[#d4f2c4] px-4 py-2 text-xs font-extrabold text-[#16330c] transition-colors hover:bg-[#bfe8a9]"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={startEditing}
              className="rounded-full border-2 border-[#211f1b] bg-[#ffe08a] px-4 py-2 text-xs font-extrabold text-[#211f1b] transition-colors hover:bg-[#ffd35c]"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                handleAction({ verificationStatus: "rejected" })
              }
              className="rounded-full border-2 border-[#211f1b] bg-[#fde2e1] px-4 py-2 text-xs font-extrabold text-[#7f1d1d] transition-colors hover:bg-[#fbc5c3]"
            >
              Reject
            </button>
            {block.type === "diagram" && block.cropUrl && (
              <button
                type="button"
                disabled={enriching}
                onClick={() => void handleRunDiagramEngine()}
                className="sketch-button-secondary px-3.5 py-2 text-xs"
              >
                {enriching ? "Analyzing..." : "Run Diagram Engine"}
              </button>
            )}
            {block.type === "equation" && block.cropUrl && (
              <button
                type="button"
                disabled={enriching}
                onClick={() => void handleRunMathOcr()}
                className="sketch-button-secondary px-3.5 py-2 text-xs"
              >
                {enriching ? "Transcribing..." : "Run Math OCR"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
