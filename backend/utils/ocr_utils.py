"""
OCR Utilities — CrediFlow
=========================
Handles conversion of uploaded PDF or image files into raw text
using pdf2image (Poppler) + pytesseract (Tesseract OCR).

Future extension point:
  - Swap pytesseract for a cloud Vision API (GCP / AWS Textract) for
    higher accuracy on low-quality scans.
"""

import io
import pytesseract
from PIL import Image

# ---------------------------------------------------------------------------
# PDF → text
# ---------------------------------------------------------------------------

def convert_pdf_to_text(file_bytes: bytes) -> str:
    """
    Convert every page of a PDF file to text via OCR.

    Parameters
    ----------
    file_bytes : bytes
        Raw bytes of the uploaded PDF.

    Returns
    -------
    str
        Concatenated OCR text from all pages.
    """
    try:
        from pdf2image import convert_from_bytes  # imported here to keep
                                                   # dependency optional

        pages = convert_from_bytes(file_bytes, dpi=200)
        full_text = ""
        for page in pages:
            full_text += pytesseract.image_to_string(page) + "\n"
        return full_text.strip()
    except Exception as e:
        # Return empty string so downstream agents can still handle gracefully
        return f"[OCR_ERROR: {str(e)}]"


# ---------------------------------------------------------------------------
# Image → text
# ---------------------------------------------------------------------------

def convert_image_to_text(file_bytes: bytes) -> str:
    """
    Run Tesseract OCR on a single image (JPEG / PNG / TIFF etc.).

    Parameters
    ----------
    file_bytes : bytes
        Raw bytes of the uploaded image.

    Returns
    -------
    str
        Extracted text from the image.
    """
    try:
        image = Image.open(io.BytesIO(file_bytes))
        # Convert to RGB to avoid colour-mode issues with Tesseract
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")
        text = pytesseract.image_to_string(image)
        return text.strip()
    except Exception as e:
        return f"[OCR_ERROR: {str(e)}]"
