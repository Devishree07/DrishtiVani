"use client";

import { useEffect, useRef, useState } from "react";
import type { DocumentRecord, ExtractedBlock } from "@/types/document";

interface AccessibleDocumentReaderProps {
  documentRecord: DocumentRecord;
}

function getSpeakableText(block: ExtractedBlock): string {
  if (block.type === "heading") {
    return `${block.headingLevel ?? "Heading"}: ${block.content}`;
  }
  if (block.type === "equation" && block.math) {
    return `Equation. ${block.math.spokenText}`;
  }
  if (block.type === "table" && block.table) {
    const rowText = block.table.rows
      .map((r) =>
        r.map((cell, i) => `${block.table?.headers[i] ?? "Col"}: ${cell}`).join(", "),
      )
      .join(". ");
    return `Table: ${block.table.caption}. ${rowText}`;
  }
  if (block.type === "diagram" && block.diagram) {
    return `Diagram: ${block.diagram.title}. ${block.diagram.description}`;
  }
  return block.content;
}

export default function AccessibleDocumentReader({
  documentRecord,
}: AccessibleDocumentReaderProps) {
  const orderedBlocks = [...documentRecord.blocks]
    .filter((b) => b.verificationStatus !== "rejected")
    .sort((a, b) =>
      a.pageNumber !== b.pageNumber
        ? a.pageNumber - b.pageNumber
        : a.order - b.order,
    );

  const [focusedIndex, setFocusedIndex] = useState(0);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const blockRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function focusBlockAt(index: number) {
    const clamped = Math.max(0, Math.min(orderedBlocks.length - 1, index));
    setFocusedIndex(clamped);
    const el = blockRefs.current[clamped];
    el?.focus();
    const blk = orderedBlocks[clamped];
    if (blk) {
      setLiveAnnouncement(
        `Block ${clamped + 1} of ${orderedBlocks.length}: ${
          blk.headingLevel ?? blk.type
        }`,
      );
    }
  }

  function speakBlock(block: ExtractedBlock) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }
    window.speechSynthesis.cancel();
    if (speakingId === block.id) {
      setSpeakingId(null);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(getSpeakableText(block));
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(block.id);
    window.speechSynthesis.speak(utterance);
  }

  function handleContainerKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    if (e.key === "ArrowDown" || e.key.toLowerCase() === "j") {
      e.preventDefault();
      focusBlockAt(focusedIndex + 1);
    } else if (e.key === "ArrowUp" || e.key.toLowerCase() === "k") {
      e.preventDefault();
      focusBlockAt(focusedIndex - 1);
    } else if (e.key.toLowerCase() === "h") {
      e.preventDefault();
      const nextHeadingIdx = orderedBlocks.findIndex(
        (b, idx) => idx > focusedIndex && b.type === "heading",
      );
      if (nextHeadingIdx !== -1) {
        focusBlockAt(nextHeadingIdx);
      } else {
        const firstHeading = orderedBlocks.findIndex(
          (b) => b.type === "heading",
        );
        if (firstHeading !== -1) focusBlockAt(firstHeading);
      }
    } else if (e.key.toLowerCase() === "r") {
      e.preventDefault();
      const current = orderedBlocks[focusedIndex];
      if (current) speakBlock(current);
    } else if (e.key === "Escape") {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setSpeakingId(null);
    }
  }

  return (
    <div onKeyDown={handleContainerKeyDown} className="space-y-5">
      {/* Screen-reader live announcement */}
      <div className="sr-only" aria-live="polite">
        {liveAnnouncement}
      </div>

      {/* Keyboard Navigation Guide */}
      <section
        aria-label="Keyboard navigation shortcuts"
        className="paper-card flex flex-wrap items-center justify-between gap-3 bg-[#f2ece0] px-5 py-3 text-xs font-semibold text-[#211f1b]"
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-extrabold uppercase tracking-wide">
            Keyboard navigation:
          </span>
          <span>
            <kbd className="rounded border border-[#211f1b] bg-[#fffcf6] px-1.5 py-0.5 font-mono">
              ↑ / ↓
            </kbd>{" "}
            or{" "}
            <kbd className="rounded border border-[#211f1b] bg-[#fffcf6] px-1.5 py-0.5 font-mono">
              J / K
            </kbd>{" "}
            Move between blocks
          </span>
          <span>
            <kbd className="rounded border border-[#211f1b] bg-[#fffcf6] px-1.5 py-0.5 font-mono">
              H
            </kbd>{" "}
            Next heading
          </span>
          <span>
            <kbd className="rounded border border-[#211f1b] bg-[#fffcf6] px-1.5 py-0.5 font-mono">
              R
            </kbd>{" "}
            Read aloud
          </span>
          <span>
            <kbd className="rounded border border-[#211f1b] bg-[#fffcf6] px-1.5 py-0.5 font-mono">
              Esc
            </kbd>{" "}
            Stop audio
          </span>
        </div>

        <span className="rounded-full bg-[#fffcf6] px-3 py-1 font-bold">
          Block {focusedIndex + 1} of {orderedBlocks.length}
        </span>
      </section>

      {/* Document Content Blocks */}
      <div className="space-y-4">
        {orderedBlocks.map((block, index) => {
          const isFocused = index === focusedIndex;
          const isSpeaking = speakingId === block.id;

          return (
            <article
              key={block.id}
              ref={(el) => {
                blockRefs.current[index] = el;
              }}
              tabIndex={0}
              onFocus={() => setFocusedIndex(index)}
              className={`paper-card p-5 transition-all focus:outline-none ${
                isFocused
                  ? "border-[#5b46b8] bg-[#fffcf6] ring-3 ring-[#5b46b8]/30"
                  : ""
              }`}
            >
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#3b362f]">
                  <span className="rounded-full bg-[#f2ece0] px-2.5 py-0.5 text-[#211f1b]">
                    Page {block.pageNumber}
                  </span>
                  <span>
                    {block.headingLevel
                      ? `Heading ${block.headingLevel}`
                      : block.type}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => speakBlock(block)}
                  className={`rounded-full border border-[#211f1b] px-3 py-1 text-xs font-bold transition-colors ${
                    isSpeaking
                      ? "bg-[#211f1b] text-[#ffe08a]"
                      : "bg-[#ffe08a] text-[#211f1b] hover:bg-[#ffd35c]"
                  }`}
                >
                  {isSpeaking ? "Stop audio" : "Read aloud"}
                </button>
              </div>

              {block.type === "heading" && block.headingLevel === "H1" && (
                <h2 className="ink-heading text-2xl sm:text-3xl text-[#211f1b]">
                  {block.content}
                </h2>
              )}
              {block.type === "heading" && block.headingLevel === "H2" && (
                <h3 className="text-xl font-extrabold text-[#211f1b]">
                  {block.content}
                </h3>
              )}
              {block.type === "heading" && block.headingLevel === "H3" && (
                <h4 className="text-lg font-bold text-[#211f1b]">
                  {block.content}
                </h4>
              )}

              {block.type === "text" && (
                <p className="text-base leading-relaxed text-[#211f1b]">
                  {block.content || (
                    <span className="italic text-[#7c2d12]">
                      No OCR text extracted for this block yet.
                    </span>
                  )}
                </p>
              )}

              {block.type === "equation" && (
                <div className="space-y-2 rounded-2xl border border-[#d9d0c3] bg-[#f5f0ff]/60 p-4">
                  <p className="font-mono text-base font-bold text-[#4c1d95]">
                    {block.math?.latex ?? block.content}
                  </p>
                  {block.math?.spokenText && (
                    <p className="text-sm text-[#3b362f]">
                      <span className="font-bold">Spoken form:</span>{" "}
                      {block.math.spokenText}
                    </p>
                  )}
                </div>
              )}

              {block.type === "table" && block.table && (
                <div className="overflow-x-auto rounded-xl border border-[#d9d0c3]">
                  <table className="w-full border-collapse text-left text-sm">
                    <caption className="bg-[#f2ece0] px-4 py-2 text-left font-bold text-[#211f1b]">
                      {block.table.caption}
                    </caption>
                    <thead>
                      <tr className="border-b-2 border-[#211f1b] bg-[#faf7f0]">
                        {block.table.headers.map((header) => (
                          <th
                            key={header}
                            scope="col"
                            className="px-4 py-2.5 font-extrabold text-[#211f1b]"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e4dccf]">
                      {block.table.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="bg-[#fffcf6]">
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="px-4 py-2.5 text-[#211f1b]">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {block.type === "diagram" && (
                <div className="space-y-3 rounded-2xl border-2 border-[#d9d0c3] bg-[#fffbeb]/80 p-4">
                  <p className="text-base font-extrabold text-[#78350f]">
                    {block.diagram?.title ?? "Diagram Description"}
                  </p>
                  <p className="text-sm leading-relaxed text-[#211f1b]">
                    {block.diagram?.description ?? block.content}
                  </p>
                  {block.diagram?.nodesSummary &&
                    block.diagram.nodesSummary.length > 0 && (
                      <ul className="list-disc space-y-1 pl-5 text-sm text-[#3b362f]">
                        {block.diagram.nodesSummary.map((nodeDesc) => (
                          <li key={nodeDesc}>{nodeDesc}</li>
                        ))}
                      </ul>
                    )}
                  {block.diagram?.spiceNetlist && (
                    <details className="rounded-xl border border-[#d9d0c3] bg-[#fffcf6] p-3">
                      <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-[#211f1b]">
                        View SPICE Netlist (.cir)
                      </summary>
                      <pre className="mt-2 overflow-x-auto rounded-lg bg-[#211f1b] p-3 font-mono text-xs text-[#ffe08a]">
                        {block.diagram.spiceNetlist}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
