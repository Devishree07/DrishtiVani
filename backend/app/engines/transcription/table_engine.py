from typing import List


class TableEngine:

  @staticmethod
  def generate_accessible_table(
      grid_data: List[List[str]], title: str = "Extracted Table"
  ) -> str:
    """Converts a 2D matrix of cell text (from Member 1's Table Transformer output)

    into a fully accessible HTML5 table with proper column/row headers for
    screen readers.
    """
    if not grid_data:
      return "<p>Empty Table</p>"

    html = [f'<table aria-label="{title}" border="1">']

    # Header Row
    html.append("  <thead>\n    <tr>")
    for col_header in grid_data[0]:
      html.append(f'      <th scope="col">{col_header.strip()}</th>')
    html.append("    </tr>\n  </thead>")

    # Data Rows
    html.append("  <tbody>")
    for row in grid_data[1:]:
      html.append("    <tr>")
      for idx, cell in enumerate(row):
        if idx == 0:
          # First cell in a row acts as row header for screen readers
          html.append(f'      <th scope="row">{cell.strip()}</th>')
        else:
          html.append(f"      <td>{cell.strip()}</td>")
      html.append("    </tr>")
    html.append("  </tbody>\n</table>")

    return "\n".join(html)


if __name__ == "__main__":
  # Quick test with sample structured table matrix
  sample_matrix = [
      ["Component", "Symbol", "Value"],
      ["Resistor 1", "R1", "10k ohm"],
      ["Capacitor 1", "C1", "100uF"],
  ]
  engine = TableEngine()
  accessible_html = engine.generate_accessible_table(
      sample_matrix, "Circuit Components"
  )
  print(">>> Accessible Table Output:")
  print(accessible_html)