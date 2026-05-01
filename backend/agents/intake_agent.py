"""
Intake Agent — CrediFlow
=========================
The first agent in the pipeline.

Responsibilities
----------------
1. Accept an uploaded PDF or image (as raw bytes + MIME type).
2. Route file to the correct OCR utility (pdf2image vs PIL/pytesseract).
3. Parse structured fields from raw OCR text using regex + spaCy.
4. Return a standardised JSON payload with a confidence score.

Agent interaction
-----------------
  UI → [ Intake Agent ] → Risk Agent → Negotiation Agent → Audit Agent

Future extension points
------------------------
- Replace Tesseract with a cloud Vision API for higher accuracy.
- Add a document-classification step (bank statement vs. salary slip etc.)
  using a fine-tuned BERT/LayoutLM model.
- Stream partial results back to the UI for faster perceived response time.
"""

from utils.ocr_utils import convert_pdf_to_text, convert_image_to_text
from utils.extraction_utils import (
    extract_name,
    extract_dob,
    extract_income,
    extract_loan_amount,
    extract_loan_purpose,
    extract_pan,
    extract_aadhaar,
)


def process_document(file_bytes: bytes, content_type: str) -> dict:
    """
    Process an uploaded loan document.

    Parameters
    ----------
    file_bytes : bytes
        Raw bytes of the uploaded file.
    content_type : str
        MIME type, e.g. 'application/pdf', 'image/jpeg', 'image/png'.

    Returns
    -------
    dict
        Structured application data with confidence score.
    """

    # ------------------------------------------------------------------
    # Step 1 — OCR: convert file to plain text
    # ------------------------------------------------------------------
    if content_type == "application/pdf":
        raw_text = convert_pdf_to_text(file_bytes)
    else:
        # image/jpeg, image/png, etc.
        raw_text = convert_image_to_text(file_bytes)

    # ------------------------------------------------------------------
    # Step 2 — Field extraction
    # ------------------------------------------------------------------
    name          = extract_name(raw_text)
    dob           = extract_dob(raw_text)
    annual_income = extract_income(raw_text)
    loan_amount   = extract_loan_amount(raw_text)
    loan_purpose  = extract_loan_purpose(raw_text)
    pan_number    = extract_pan(raw_text)
    aadhaar_number = extract_aadhaar(raw_text)

    # ------------------------------------------------------------------
    # Step 3 — Confidence score
    # Simple heuristic: fraction of fields that were successfully extracted.
    # Replace with a calibrated probability model in production.
    # ------------------------------------------------------------------
    fields = [name, dob, annual_income, loan_amount, loan_purpose,
              pan_number, aadhaar_number]
    extracted_count = sum(1 for f in fields if f is not None)
    confidence = round(extracted_count / len(fields), 2)

    return {
        "name":           name           or "Not found",
        "dob":            dob            or "Not found",
        "annual_income":  annual_income  or "Not found",
        "loan_amount":    loan_amount    or "Not found",
        "loan_purpose":   loan_purpose   or "Not found",
        "pan_number":     pan_number     or "Not found",
        "aadhaar_number": aadhaar_number or "Not found",
        "confidence":     confidence,
        "raw_text":       raw_text,       # passed to risk agent / audit
    }
