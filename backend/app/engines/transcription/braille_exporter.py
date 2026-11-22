import os
from typing import Dict, List


class BrailleExporter:

  @staticmethod
  def export_to_brf(parsed_blocks: List[Dict], output_filepath: str) -> str:
    """Compiles transcribed document blocks (paragraphs, MathML, Nemeth math)

    into a standard ASCII-formatted .brf file for physical Braille displays.
    """
    brf_lines = []

    for block in parsed_blocks:
      block_type = block.get("type", "text")
      data = block.get("data", {})

      if block_type == "heading":
        # Double comma denotes uppercase heading in ASCII Braille
        brf_lines.append(f"\n,, {data.get('text', '').upper()}\n")
      elif block_type == "equation":
        # Indent Nemeth equations
        brf_lines.append(f"  {data.get('nemeth', '')}")
      elif block_type == "table":
        brf_lines.append(f"\n[Table Data: {data.get('summary', '')}]")
      else:
        brf_lines.append(data.get("text", ""))

    content = "\n".join(brf_lines)

    # Ensure target output directory exists
    os.makedirs(os.path.dirname(output_filepath), exist_ok=True)

    with open(output_filepath, "w", encoding="utf-8") as f:
      f.write(content)

    return output_filepath


if __name__ == "__main__":
  sample_blocks = [
      {"type": "heading", "data": {"text": "Circuit Analysis Overview"}},
      {
          "type": "text",
          "data": {
              "text": (
                  "The output voltage across the operational amplifier is"
                  " calculated as follows:"
              )
          },
      },
      {"type": "equation", "data": {"nemeth": "⠧⠍⠕⠥⠞⠀⠐⠤⠹⠠⠗⠍⠋⠌⠠⠗⠍⠊⠝⠼⠀⠧⠍⠊⠝"}},
  ]

  out_path = "output/test_document.brf"
  result_path = BrailleExporter.export_to_brf(sample_blocks, out_path)
  print(f">>> Braille export successful! Saved to: {result_path}")