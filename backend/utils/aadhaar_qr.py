"""
Aadhaar QR Reader (optional) — CrediFlow
=========================================

Uses the ``pyaadhaar`` library to read the QR code printed on an Aadhaar
card / e-Aadhaar PDF, if the uploaded document contains one.

What ``pyaadhaar`` can and cannot do
------------------------------------
* It CAN decode the QR code and give back name, date of birth, gender and the
  last 4 digits of the Aadhaar number.
* It CANNOT validate a typed 12-digit number.  (That is what the Verhoeff
  checksum in ``verification_agent.py`` does.)
* It does NOT verify UIDAI's digital signature.  So a decoded QR is useful for
  CROSS-CHECKING the form against the card, but it is not proof the card is real.

If ``pyaadhaar`` / ``pyzbar`` / the zbar system library are missing, every
function here quietly returns ``None`` and the pipeline carries on.
Turn the feature off with  AADHAAR_QR_CHECK=false  in your .env file.
"""

from __future__ import annotations

import io
import os
import re
from typing import Any, Dict, List, Optional


def qr_check_enabled() -> bool:
    return (os.getenv("AADHAAR_QR_CHECK", "true").strip().lower() in ("1", "true", "yes", "on"))


# ---------------------------------------------------------------------------
# Decode one QR string
# ---------------------------------------------------------------------------

def decode_qr_payload(data: str) -> Optional[Dict[str, Any]]:
    """
    Decode the text of one QR code.  Returns a normalised dict or ``None``
    if it is not an Aadhaar QR.

        {"qr_type": "secure"|"old_xml", "name", "dob", "gender", "last4"}
    """
    if not data:
        return None
    try:
        from pyaadhaar.decode import AadhaarSecureQr, AadhaarOldQr
    except Exception:
        return None

    data = data.strip()
    try:
        if data.isdigit():                                   # new "secure" QR (big number)
            d = AadhaarSecureQr(int(data)).decodeddata()
            return {
                "qr_type": "secure",
                "name":    (d.get("name") or "").strip(),
                "dob":     (d.get("dob") or "").strip(),
                "gender":  (d.get("gender") or "").strip(),
                "last4":   (d.get("aadhaar_last_4_digit") or "").strip(),
            }
        if data.startswith("<"):                             # old XML QR
            d = AadhaarOldQr(data).decodeddata()
            uid = re.sub(r"\D", "", d.get("uid", ""))
            return {
                "qr_type": "old_xml",
                "name":    (d.get("name") or "").strip(),
                "dob":     (d.get("dob") or d.get("yob") or "").strip(),
                "gender":  (d.get("gender") or "").strip(),
                "last4":   uid[-4:] if len(uid) >= 4 else "",
            }
    except Exception:
        return None
    return None


# ---------------------------------------------------------------------------
# Find QR codes inside an uploaded file
# ---------------------------------------------------------------------------

def _page_images(file_bytes: bytes, content_type: str):
    from PIL import Image
    if content_type == "application/pdf":
        from pdf2image import convert_from_bytes
        return convert_from_bytes(file_bytes, dpi=200, first_page=1, last_page=3)
    return [Image.open(io.BytesIO(file_bytes))]


def read_aadhaar_qr(file_bytes: bytes, content_type: str) -> Optional[Dict[str, Any]]:
    """Scan the document for an Aadhaar QR.  Returns decoded data or ``None``."""
    if not qr_check_enabled() or not file_bytes:
        return None
    try:
        from pyzbar.pyzbar import decode as zbar_decode
    except Exception:
        return None

    try:
        for img in _page_images(file_bytes, content_type):
            candidates: List[Any] = [img.convert("L")]
            # Try a 2x enlarged copy too — small QR codes are hard to read
            big = img.convert("L").resize((img.width * 2, img.height * 2))
            candidates.append(big)
            for im in candidates:
                for code in zbar_decode(im):
                    try:
                        text = code.data.decode("utf-8", errors="ignore")
                    except Exception:
                        continue
                    result = decode_qr_payload(text)
                    if result:
                        return result
    except Exception:
        return None
    return None
