import sys
from PIL import Image
from latex2mathml.converter import convert as latex_to_mathml
from pix2tex.cli import LatexOCR

# Safe Liblouis loading for Windows environment
HAS_LIBLOUIS = False
try:
    import louis  # type: ignore
    HAS_LIBLOUIS = True
except Exception:
    HAS_LIBLOUIS = False


class MathEngine:

    def __init__(self):
        """Initialize pix2tex ViT model."""
        self.ocr_model = LatexOCR()

    def _translate_to_nemeth(self, latex_code: str) -> str:
        """Translates LaTeX to Nemeth Braille code with safe fallbacks."""
        if not HAS_LIBLOUIS:
            return f"[Braille: {latex_code}]"

        try:
            tables = ["unicode-to-nemeth.ctb", "en-us-comp8.ctb"]
            translated = louis.translateString(tables, latex_code)
            return translated if translated else latex_code
        except Exception:
            return f"[Braille: {latex_code}]"

    def process_math_crop(self, image_input) -> dict:
        """
        Processes a cropped equation image and returns LaTeX, MathML, 
        and Nemeth Braille representations.
        """
        if isinstance(image_input, str):
            img = Image.open(image_input)
        else:
            img = image_input

        # 1. OCR equation image to LaTeX
        latex_code = self.ocr_model(img)

        # 2. Convert LaTeX to MathML for web screen readers
        try:
            mathml_code = latex_to_mathml(latex_code)
        except Exception:
            mathml_code = f"<math><mrow><mtext>{latex_code}</mtext></mrow></math>"

        # 3. Translate to Nemeth Braille code
        nemeth_braille = self._translate_to_nemeth(latex_code)

        return {
            "latex": latex_code,
            "mathml": mathml_code,
            "nemeth": nemeth_braille,
        }


# This block ONLY runs when you explicitly execute this file (python math_engine.py)
if __name__ == "__main__":
    print(">>> Initializing MathEngine instance...", flush=True)
    engine = MathEngine()
    print(">>> MathEngine is ready!", flush=True)
    print(f">>> Liblouis Status: {HAS_LIBLOUIS}", flush=True)