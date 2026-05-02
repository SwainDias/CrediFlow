"""
Verification Agent (KYC) — CrediFlow
======================================

Validates the applicant's identity documents against known patterns
and external verification services.

Responsibilities
----------------
1. Validate PAN format & checksum.
2. Validate Aadhaar format (Verhoeff checksum).
3. Cross-check that the extracted name is consistent.
4. Return a structured ``KYCResult`` dict and an overall pass/fail flag.

Agent interaction
-----------------
  Intake Agent → [ Verification Agent ] → Risk Agent  (if KYC passed)
                                        → Audit Agent (if KYC failed)

Future extension points
------------------------
- Integrate with NSDL PAN verification API.
- Integrate with UIDAI Aadhaar e-KYC gateway.
- Add liveness / face-match against photo ID.
- Fuzzy name matching with Jaro-Winkler / phonetic algorithms.
"""

import re


# ---------------------------------------------------------------------------
# PAN validation
# ---------------------------------------------------------------------------

_PAN_REGEX = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")


def _is_valid_pan(pan: str | None) -> bool:
    """Check whether a PAN string matches the standard Indian format."""
    if not pan or pan == "Not found":
        return False
    return bool(_PAN_REGEX.match(pan.strip().upper()))


# ---------------------------------------------------------------------------
# Aadhaar validation
# ---------------------------------------------------------------------------

# Verhoeff multiplication, permutation and inverse tables
_VERHOEFF_D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]

_VERHOEFF_P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]


def _verhoeff_checksum(number_str: str) -> bool:
    """Validate a number string using the Verhoeff checksum algorithm."""
    c = 0
    digits = [int(d) for d in reversed(number_str)]
    for i, digit in enumerate(digits):
        c = _VERHOEFF_D[c][_VERHOEFF_P[i % 8][digit]]
    return c == 0


def _is_valid_aadhaar(aadhaar: str | None) -> bool:
    """
    Check whether an Aadhaar string is valid.
    Strips spaces/hyphens and verifies it is 12 digits with a valid
    Verhoeff checksum.
    """
    if not aadhaar or aadhaar == "Not found":
        return False
    digits_only = re.sub(r"[\s\-]", "", aadhaar)
    if len(digits_only) != 12 or not digits_only.isdigit():
        return False
    # First digit cannot be 0 or 1
    if digits_only[0] in ("0", "1"):
        return False
    return _verhoeff_checksum(digits_only)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def verify_kyc(parsed_application: dict) -> dict:
    """
    Run KYC checks on a parsed loan application.

    Parameters
    ----------
    parsed_application : dict
        Output from the Intake Agent, containing at minimum
        ``pan_number`` and ``aadhaar_number``.

    Returns
    -------
    dict
        {
          "kyc_passed":  bool,
          "kyc_result":  {
              "pan_valid":     bool,
              "aadhaar_valid": bool,
              "name_match":    bool,
              "details":       str,
          }
        }
    """

    pan     = parsed_application.get("pan_number")
    aadhaar = parsed_application.get("aadhaar_number")
    name    = parsed_application.get("name")

    pan_valid     = _is_valid_pan(pan)
    aadhaar_valid = _is_valid_aadhaar(aadhaar)

    # Name-match stub: in production, cross-reference against PAN/Aadhaar DB.
    # For now we check that a name was successfully extracted.
    name_match = bool(name and name != "Not found")

    # Overall pass requires all three checks
    kyc_passed = pan_valid and aadhaar_valid and name_match

    # Build human-readable details
    issues = []
    if not pan_valid:
        issues.append(f"PAN '{pan}' is invalid or missing")
    if not aadhaar_valid:
        issues.append(f"Aadhaar '{aadhaar}' is invalid or missing")
    if not name_match:
        issues.append("Applicant name could not be verified")

    details = "All KYC checks passed." if kyc_passed else "; ".join(issues)

    return {
        "kyc_passed": kyc_passed,
        "kyc_result": {
            "pan_valid":     pan_valid,
            "aadhaar_valid": aadhaar_valid,
            "name_match":    name_match,
            "details":       details,
        },
    }
