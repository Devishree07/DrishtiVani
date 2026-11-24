"""Lightweight math formula detection and accessible representation helpers.

Generates spoken English audio text, LaTeX, MathML, and Nemeth-style Braille
for extracted PDF equation expressions when external pix2tex/liblouis binaries
are unavailable.
"""

from __future__ import annotations

import html
import re
from typing import Dict

# Pattern matching an algebraic/physics assignment or formula with operators
_EQUATION_EXPR_RE = re.compile(
    r"(?:^|\s)([A-Za-z0-9_/\(\)\[\]]+\s*=\s*[^.;\n]{2,120})"
)

_MATH_OP_CHARS = set("=+-−×÷*/²³√∑∫≈≤≥")


def is_equation_block(text: str) -> bool:
    """Return True if a short text block represents a mathematical equation or worked calculation."""
    stripped = text.strip()
    if not stripped or len(stripped) > 180 or "=" not in stripped:
        return False
    # Exclude bullet checklist items or metadata labels
    if stripped.startswith(("•", "-", "▪")):
        return False
    # Must contain an equation assignment and at least one mathematical operator/symbol
    has_op = any(ch in stripped for ch in ("+", "-", "−", "×", "÷", "*", "/", "²", "³", "≈"))
    return bool(_EQUATION_EXPR_RE.search(stripped) and has_op)


def extract_formula_fragment(text: str) -> str:
    """Extract the primary mathematical equation portion from a sentence or return full text."""
    stripped = " ".join(text.split())
    # Match equation assignment without cutting off decimal points like 0.05 or 4.8
    m = re.search(r"([A-Za-z0-9_]+\s*(?:/\s*[A-Za-z0-9_]+)?\s*=\s*(?:[^.\n]|\.\d)+)", stripped)
    if m and len(stripped) > len(m.group(1)) + 15:
        return m.group(1).strip().rstrip(".")
    return stripped.rstrip(".")


def to_spoken_math(expr: str) -> str:
    """Convert mathematical symbols into clear spoken English for Web Speech TTS."""
    spoken = " ".join(expr.split())
    replacements = [
        ("≈", " approximately equals "),
        ("≤", " is less than or equal to "),
        ("≥", " is greater than or equal to "),
        ("=", " equals "),
        ("×", " times "),
        ("÷", " divided by "),
        ("−", " minus "),
        ("+", " plus "),
        ("/", " divided by "),
        ("²", " squared "),
        ("³", " cubed "),
        ("Ω", " ohms "),
        ("Ω", " ohms "),
        ("µ", " micro "),
        ("μ", " micro "),
    ]
    for src, dst in replacements:
        spoken = spoken.replace(src, dst)
    # Collapse excess spaces
    return " ".join(spoken.split())


def to_latex_math(expr: str) -> str:
    """Convert plain Unicode equation text into clean LaTeX."""
    latex = " ".join(expr.split())
    latex = latex.replace("×", r" \times ")
    latex = latex.replace("÷", r" \div ")
    latex = latex.replace("−", " - ")
    latex = latex.replace("≈", r" \approx ")
    latex = latex.replace("²", "^2")
    latex = latex.replace("³", "^3")
    latex = latex.replace("Ω", r"\,\Omega")
    latex = latex.replace("Ω", r"\,\Omega")
    return " ".join(latex.split())


def to_mathml(expr: str) -> str:
    """Build accessible MathML markup from an equation expression."""
    tokens = re.findall(r"[A-Za-z0-9_.]+|[=+\-−×÷*/()²³≈]", expr)
    parts = []
    for tok in tokens:
        escaped = html.escape(tok)
        if tok in _MATH_OP_CHARS or tok in ("(", ")"):
            parts.append(f"<mo>{escaped}</mo>")
        elif tok.replace(".", "", 1).isdigit():
            parts.append(f"<mn>{escaped}</mn>")
        else:
            parts.append(f"<mi>{escaped}</mi>")
    inner = "".join(parts) or f"<mtext>{html.escape(expr)}</mtext>"
    return f'<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow>{inner}</mrow></math>'


def to_nemeth_braille(expr: str) -> str:
    """Generate a basic Nemeth ASCII Braille representation with Liblouis if present."""
    try:
        import louis  # type: ignore
        translated = louis.translateString(["unicode-to-nemeth.ctb", "en-us-comp8.ctb"], expr)
        if translated:
            return translated
    except Exception:
        pass

    # Standard Nemeth ASCII fallbacks for common symbols
    nem = expr
    for src, dst in (
        ("=", " .k "),
        ("+", "+"),
        ("−", "-"),
        ("-", "-"),
        ("×", "*"),
        ("/", "/"),
        ("²", "^2"),
        ("Ω", " .w"),
        ("Ω", " .w"),
    ):
        nem = nem.replace(src, dst)
    return " ".join(nem.split())


def build_math_payload(text: str) -> Dict[str, str]:
    """Produce structured LaTeX, spokenText, MathML, and Nemeth fields for an equation block."""
    formula = extract_formula_fragment(text)
    return {
        "latex": to_latex_math(formula),
        "spoken_text": to_spoken_math(text),
        "mathml": to_mathml(formula),
        "nemeth": to_nemeth_braille(formula),
    }
