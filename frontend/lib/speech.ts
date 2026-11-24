import type { ExtractedBlock } from "@/types/document";

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
