import type { DocumentRecord, ExtractedBlock } from "@/types/document";

function normalizeMathSpeech(text: string): string {
  return text
    .replaceAll("≈", " approximately equals ")
    .replaceAll("≤", " is less than or equal to ")
    .replaceAll("≥", " is greater than or equal to ")
    .replaceAll("=", " equals ")
    .replaceAll("×", " times ")
    .replaceAll("÷", " divided by ")
    .replaceAll("−", " minus ")
    .replaceAll("²", " squared ")
    .replaceAll("³", " cubed ")
    .replaceAll("Ω", " ohms ")
    .replaceAll("Ω", " ohms ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Converts a structured layout block into plain-English spoken text
 * matching what screen readers and Web Speech TTS read to students.
 */
export function getSpeakableText(block: ExtractedBlock): string {
  if (block.type === "heading") {
    return `${block.headingLevel ?? "Heading"}: ${block.content || "Empty heading"}`;
  }
  if (block.type === "equation") {
    if (block.math?.spokenText) {
      return `Equation. ${block.math.spokenText}`;
    }
    return `Equation. ${normalizeMathSpeech(block.content || "No equation text extracted yet.")}`;
  }
  if (block.type === "table" && block.table) {
    const rowText = block.table.rows
      .map((r) =>
        r
          .map(
            (cell, i) =>
              `${block.table?.headers[i] ?? "Col"}: ${normalizeMathSpeech(cell)}`,
          )
          .join(", "),
      )
      .join(". ");
    return `Table: ${block.table.caption}. ${rowText}`;
  }
  if (block.type === "diagram" && block.diagram) {
    const nodeText = block.diagram.nodesSummary?.length
      ? ` Nodes: ${block.diagram.nodesSummary.join(". ")}`
      : "";
    return `Diagram: ${block.diagram.title}. ${block.diagram.description}${nodeText}`;
  }
  return normalizeMathSpeech(
    block.content || "No extracted text available for this block.",
  );
}

/** Returns non-rejected blocks sorted in natural page/reading order. */
export function getOrderedReadableBlocks(
  doc: DocumentRecord,
): ExtractedBlock[] {
  return [...doc.blocks]
    .filter((b) => b.verificationStatus !== "rejected")
    .sort((a, b) =>
      a.pageNumber !== b.pageNumber
        ? a.pageNumber - b.pageNumber
        : a.order - b.order,
    );
}

export interface SequenceCallbacks {
  onBlockStart?: (index: number, block: ExtractedBlock) => void;
  onComplete?: () => void;
  onError?: () => void;
}

/**
 * Speaks an ordered list of blocks continuously as one full document audio stream.
 * Uses chained utterances to avoid browser Web Speech length cutoffs.
 * Returns a cancel function.
 */
export function speakBlockSequence(
  blocks: ExtractedBlock[],
  startIndex = 0,
  callbacks?: SequenceCallbacks,
): () => void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    callbacks?.onError?.();
    return () => {};
  }

  const synth = window.speechSynthesis;
  synth.cancel();

  if (blocks.length === 0 || startIndex >= blocks.length) {
    callbacks?.onComplete?.();
    return () => {};
  }

  let cancelled = false;

  const speakAt = (idx: number) => {
    if (cancelled) return;
    if (idx >= blocks.length) {
      callbacks?.onComplete?.();
      return;
    }

    const blk = blocks[idx];
    const text = getSpeakableText(blk).trim();
    if (!text) {
      speakAt(idx + 1);
      return;
    }

    callbacks?.onBlockStart?.(idx, blk);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.96;
    utterance.onend = () => {
      if (!cancelled) {
        speakAt(idx + 1);
      }
    };
    utterance.onerror = () => {
      if (!cancelled) {
        cancelled = true;
        callbacks?.onError?.();
      }
    };
    synth.speak(utterance);
  };

  speakAt(startIndex);

  return () => {
    cancelled = true;
    synth.cancel();
  };
}
