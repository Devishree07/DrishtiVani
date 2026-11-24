"use client";

import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";
import { analyzeDiagramCrop, transcribeMathCrop } from "@/lib/api-client";
import { CONFIDENCE_REVIEW_THRESHOLD } from "@/lib/mock-data";
import { getSpeakableText } from "@/lib/speech";
import type {
  BlockVerificationUpdate,
  ExtractedBlock,
} from "@/types/document";

const emptySubscribe = () => () => {};
const getSpeechSupported = () =>
  typeof window !== "undefined" && "speechSynthesis" in window;
const getServerSnapshot = () => false;

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
  const [speaking, setSpeaking] = useState(false);
  const speechSupported = useSyncExternalStore(
    emptySubscribe,
    getSpeechSupported,
    getServerSnapshot,
  );

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!block) {
    return (
      <div className="paper-card p-5 text-sm font-medium text-slate-600">
        Select a block or bounding box to inspect, edit, preview audio, approve,
        or reject.
      </div>
    );
  }

  const spokenPreview = isEditing
    ? draftContent.trim() || getSpeakableText(block)
    : getSpeakableText(block);

  function toggleAudioPreview() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(spokenPreview);
    utterance.rate = 0.95;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(utterance);
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
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Block #{block.order} ·{" "}
            {block.headingLevel
              ? `Heading ${block.headingLevel}`
              : (block.rawType ?? block.type).toUpperCase()}
          </h3>
          <p className="text-xs text-slate-500">
            BBox: ({Math.round(block.bbox.x)}, {Math.round(block.bbox.y)}) ·{" "}
            {Math.round(block.bbox.width)}×{Math.round(block.bbox.height)}px
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            isFlagged
              ? "bg-rose-100 text-rose-800"
              : "bg-emerald-100 text-emerald-800"
          }`}
        >
          Layout: {(block.layoutConfidence ?? block.confidence).toFixed(2)}
          {typeof block.ocrConfidence === "number"
            ? ` · OCR: ${block.ocrConfidence.toFixed(2)}`
            : ""}
        </span>
      </div>

      {/* Student Audio Preview */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-3.5 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-blue-700">
            Student audio preview
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-700" title={spokenPreview}>
            &ldquo;{spokenPreview}&rdquo;
          </p>
        </div>
        {speechSupported && (
          <button
            type="button"
            onClick={toggleAudioPreview}
            aria-pressed={speaking}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              speaking
                ? "bg-slate-900 text-white"
                : "border border-blue-200 bg-white text-blue-700 hover:bg-blue-100/70"
            }`}
          >
            <Image
              src={
                speaking
                  ? "/icons/alerts-stop-sign.svg"
                  : "/icons/volume-control-up-1.svg"
              }
              alt=""
              width={15}
              height={15}
              aria-hidden="true"
              draggable={false}
            />
            <span>{speaking ? "Stop audio" : "Preview audio"}</span>
          </button>
        )}
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

          {block.diagram?.nodesSummary && block.diagram.nodesSummary.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
                Circuit Node Breakdown ({block.diagram.nodesSummary.length} nodes)
              </p>
              <ul className="mt-1.5 space-y-1 text-xs text-slate-700">
                {block.diagram.nodesSummary.map((nodeDesc, idx) => (
                  <li key={`${block.id}-node-${idx}`}>{nodeDesc}</li>
                ))}
              </ul>
            </div>
          )}

          {block.diagram?.spiceNetlist && (
            <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-900 p-3 font-mono text-xs text-amber-200">
              {block.diagram.spiceNetlist}
            </pre>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                handleAction({ verificationStatus: "approved" })
              }
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700 active:scale-95"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={startEditing}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 active:scale-95"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                handleAction({ verificationStatus: "rejected" })
              }
              className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 active:scale-95"
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
