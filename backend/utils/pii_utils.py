"""
PII Utilities — CrediFlow
==========================

Helpers that hide sensitive identifiers before text is sent to an
external LLM (Groq).

* ``redact_text``    — replaces Aadhaar / PAN / phone / email inside free text
* ``mask_aadhaar``   — "9876 5432 1098"  ->  "XXXX XXXX 1098"
* ``mask_pan``       — "ABCDE1234F"      ->  "******234F"

The deterministic code (regex, Verhoeff checksum, database) always uses the
real values.  Only the *LLM prompts* use the masked versions.
"""

from __future__ import annotations

import re
from typing import Optional

_AADHAAR_RE = re.compile(r"(?<!\d)\d{4}[\s\-]?\d{4}[\s\-]?\d{4}(?!\d)")
_PAN_RE = re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b")
_PHONE_RE = re.compile(r"(?<!\d)(?:\+?91[\s\-]?)?[6-9]\d{9}(?!\d)")
_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")


def redact_text(text: str) -> str:
    """Replace Aadhaar, PAN, phone numbers and e-mails with placeholder tokens."""
    if not text:
        return text
    out = _AADHAAR_RE.sub("[AADHAAR_REDACTED]", text)   # Aadhaar first (12 digits)
    out = _PAN_RE.sub("[PAN_REDACTED]", out)
    out = _PHONE_RE.sub("[PHONE_REDACTED]", out)
    out = _EMAIL_RE.sub("[EMAIL_REDACTED]", out)
    return out


def mask_aadhaar(value: Optional[str]) -> str:
    """'9876 5432 1098' -> 'XXXX XXXX 1098' (only last 4 digits are visible)."""
    if not value or value == "Not found":
        return "not provided"
    digits = re.sub(r"\D", "", str(value))
    if len(digits) < 4:
        return "XXXX XXXX XXXX"
    return f"XXXX XXXX {digits[-4:]}"


def mask_pan(value: Optional[str]) -> str:
    """'ABCDE1234F' -> '******234F' (only last 4 characters are visible)."""
    if not value or value == "Not found":
        return "not provided"
    v = str(value).strip().upper()
    if len(v) < 5:
        return "*" * len(v)
    return "*" * (len(v) - 4) + v[-4:]
