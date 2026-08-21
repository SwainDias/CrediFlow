"""
Field Extraction Utilities — CrediFlow
=======================================
Regex-based and spaCy-assisted extraction of structured fields
from raw OCR text.

Future extension point:
  - Replace regex patterns with a fine-tuned NER model (e.g. spaCy
    custom pipeline) trained on loan-document corpora.
  - Add confidence scoring per field for downstream trust calibration.
"""

import re
from typing import Optional

# ---------------------------------------------------------------------------
# spaCy model — loaded lazily so the module can be imported even when
# en_core_web_sm is not yet installed (unit-testing, CI, etc.)
# ---------------------------------------------------------------------------

_nlp = None

def _get_nlp():
    global _nlp
    if _nlp is None:
        try:
            import spacy
            _nlp = spacy.load("en_core_web_sm")
        except Exception:
            _nlp = None
    return _nlp


# ---------------------------------------------------------------------------
# Name extraction — spaCy PERSON entity with regex fallback
# ---------------------------------------------------------------------------

def extract_name(text: str) -> Optional[str]:
    """
    Extract applicant name using spaCy Named Entity Recognition.
    Falls back to a 'Name:' keyword line search if spaCy is unavailable.
    """
    # ── spaCy NER path ─────────────────────────────────────────────────
    # Filter out entities that bleed into adjacent field labels.
    _non_name_words = {"date", "birth", "dob", "income", "pan", "aadhaar",
                       "loan", "amount", "purpose", "number", "address",
                       "employment", "financial", "information", "applicant"}
    nlp = _get_nlp()
    if nlp:
        doc = nlp(text[:2000])  # limit to first 2 000 chars for speed
        for ent in doc.ents:
            if ent.label_ == "PERSON":
                words_lower = {w.lower() for w in ent.text.split()}
                if not words_lower & _non_name_words:
                    return ent.text

    # Keyword fallback — search line by line so we don't bleed into the next field
    for line in text.splitlines():
        if re.search(r'(?:full\s+name|applicant\s+name|name)[:\s]', line, re.IGNORECASE):
            m = re.search(r'(?:full\s+name|applicant\s+name|name)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})', line, re.IGNORECASE)
            if m:
                return m.group(1).strip()
    return None


# ---------------------------------------------------------------------------
# Date of Birth
# ---------------------------------------------------------------------------

def extract_dob(text: str) -> Optional[str]:
    """
    Extract date of birth.  Supports common Indian and international formats:
      DD/MM/YYYY  |  DD-MM-YYYY  |  YYYY-MM-DD  |  Month DD, YYYY
    """
    patterns = [
        r"\b(\d{2}[/-]\d{2}[/-]\d{4})\b",
        r"\b(\d{4}[/-]\d{2}[/-]\d{2})\b",
        r"\b([A-Z][a-z]+ \d{1,2},? \d{4})\b",
    ]
    # Prefer lines that contain 'dob' or 'birth'
    for line in text.splitlines():
        if re.search(r"dob|date of birth|birth", line, re.IGNORECASE):
            for pat in patterns:
                m = re.search(pat, line)
                if m:
                    return m.group(1)
    # Fallback: first date-like string anywhere
    for pat in patterns:
        m = re.search(pat, text)
        if m:
            return m.group(1)
    return None


# ---------------------------------------------------------------------------
# Annual Income
# ---------------------------------------------------------------------------

def extract_income(text: str) -> Optional[str]:
    """
    Extract annual income figure.
    Looks for lines containing 'income / salary / annual' followed by a
    currency amount.  Supports ₹, Rs, INR prefixes and comma formatting.
    """
    pattern = r"(?:annual\s+income|income|salary)[^\d₹Rs]*(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d+)?)"
    m = re.search(pattern, text, re.IGNORECASE)
    if m:
        return m.group(1).replace(",", "")
    # Fallback: any large number near keyword
    m = re.search(r"(?:income|salary)[^\d]*(\d{5,})", text, re.IGNORECASE)
    return m.group(1) if m else None


# ---------------------------------------------------------------------------
# Loan Amount
# ---------------------------------------------------------------------------

def extract_loan_amount(text: str) -> Optional[str]:
    """
    Extract requested loan amount.
    """
    pattern = r"(?:loan\s+amount|amount\s+requested|loan)[^\d₹Rs]*(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d+)?)"
    m = re.search(pattern, text, re.IGNORECASE)
    if m:
        return m.group(1).replace(",", "")
    m = re.search(r"loan[^\d]*(\d{4,})", text, re.IGNORECASE)
    return m.group(1) if m else None


# ---------------------------------------------------------------------------
# Loan Purpose
# ---------------------------------------------------------------------------

def extract_loan_purpose(text: str) -> Optional[str]:
    """
    Extract the stated purpose of the loan. Looks for keyword lines.
    """
    m = re.search(r"(?:purpose|reason)[:\s]+([A-Za-z\s]+?)(?:\n|,|\.)", text, re.IGNORECASE)
    return m.group(1).strip() if m else None


# ---------------------------------------------------------------------------
# PAN number  (India) — AAAAA9999A format
# ---------------------------------------------------------------------------

def extract_pan(text: str) -> Optional[str]:
    """
    Extract PAN card number.
    Pattern: 5 uppercase letters + 4 digits + 1 uppercase letter.
    """
    m = re.search(r"\b([A-Z]{5}[0-9]{4}[A-Z])\b", text)
    return m.group(1) if m else None


# ---------------------------------------------------------------------------
# Aadhaar number (India) — 12-digit number printed as XXXX XXXX XXXX
# ---------------------------------------------------------------------------

def extract_aadhaar(text: str) -> Optional[str]:
    """
    Extract Aadhaar number.
    Accepts formats:  XXXX XXXX XXXX  |  XXXXXXXXXXXX  |  XXXX-XXXX-XXXX
    """
    m = re.search(r"\b(\d{4}[\s\-]?\d{4}[\s\-]?\d{4})\b", text)
    return m.group(1) if m else None


# ---------------------------------------------------------------------------
# Existing Debt
# ---------------------------------------------------------------------------

def extract_existing_debt(text: str) -> Optional[str]:
    """
    Extract existing / outstanding debt amount.
    Looks for lines containing 'existing debt', 'outstanding debt', or 'current debt'.
    """
    pattern = r"(?:existing\s+debt|outstanding\s+debt|current\s+debt)[^\d₹Rs]*(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d+)?)"
    m = re.search(pattern, text, re.IGNORECASE)
    if m:
        return m.group(1).replace(",", "")
    return None


# ---------------------------------------------------------------------------
# Employment Years
# ---------------------------------------------------------------------------

def extract_employment_years(text: str) -> Optional[str]:
    """
    Extract years of employment from the text.
    Looks for lines containing 'employment years', 'years employed', 'work experience'.
    """
    pattern = r"(?:employment\s+years?|years?\s+employed|work\s+experience)[:\s]*(\d+(?:\.\d+)?)"
    m = re.search(pattern, text, re.IGNORECASE)
    return m.group(1) if m else None
