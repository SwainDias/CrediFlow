# CrediFlow — Autonomous Loan Processing System

## AutoLendX Prototype

An AI-powered, multi-agent loan processing pipeline with a React frontend.

---

## Architecture

```
Upload (PDF/Image)
      │
      ▼
┌─────────────────┐   OCR + spaCy NER + regex
│  Intake Agent   │ ─────────────────────────────► structured JSON
└─────────────────┘
      │
      ▼
┌─────────────────┐   RandomForestClassifier
│  Risk Agent     │ ─────────────────────────────► risk score + feature importance
└─────────────────┘
      │
      ▼
┌─────────────────┐   Rule-based engine
│ Negotiation     │ ─────────────────────────────► interest rate, tenor, collateral
│ Agent           │
└─────────────────┘
      │
      ▼
┌─────────────────┐   JSONL append
│  Audit Agent    │ ─────────────────────────────► logs/audit_log.json
└─────────────────┘
      │
      ▼
   React UI
```

---

## Project Structure

```
CrediFlowAi/
├── backend/
│   ├── main.py                    ← FastAPI app (entry point)
│   ├── requirements.txt
│   ├── agents/
│   │   ├── intake_agent.py        ← OCR + field extraction
│   │   ├── risk_agent.py          ← ML risk model
│   │   ├── negotiation_agent.py   ← rule-based loan terms
│   │   └── audit_agent.py         ← event logging
│   ├── models/
│   │   └── risk_model.pkl         ← auto-generated on first run
│   ├── utils/
│   │   ├── ocr_utils.py           ← pdf2image + pytesseract
│   │   └── extraction_utils.py    ← regex + spaCy helpers
│   ├── logs/
│   │   └── audit_log.json         ← JSONL audit trail
│   └── data/
│       └── synthetic_training_data.csv  ← auto-generated on first run
│
└── frontend/
    ├── package.json
    ├── public/
    │   └── index.html
    └── src/
        ├── index.js
        ├── App.js
        ├── api.js
        └── components/
            ├── UploadForm.js      ← drag-and-drop file upload
            ├── ParsedData.js      ← extracted fields + confidence
            ├── RiskResult.js      ← risk score + Chart.js bar chart
            ├── LoanTerms.js       ← proposed terms
            └── AuditLog.js        ← full audit JSON viewer
```

---

## Prerequisites

| Tool       | Version  | Install |
|------------|----------|---------|
| Python     | ≥ 3.9    | [python.org](https://python.org) |
| Node.js    | ≥ 18     | [nodejs.org](https://nodejs.org) |
| Tesseract  | any      | `brew install tesseract` (macOS) / `apt install tesseract-ocr` |
| Poppler    | any      | `brew install poppler` (macOS) / `apt install poppler-utils` |

---

## Backend Setup

```bash
# 1 — Navigate to the backend folder
cd CrediFlowAi/backend

# 2 — Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate      # macOS / Linux
# .venv\Scripts\activate       # Windows

# 3 — Install Python dependencies
pip install -r requirements.txt

# 4 — Download the spaCy English model
python -m spacy download en_core_web_sm

# 5 — Start the API server
#   (the risk model + synthetic data are auto-generated on first request)
uvicorn main:app --reload --port 8000
```

The API will be available at **http://localhost:8000**

Interactive docs: **http://localhost:8000/docs**

---

## Frontend Setup

```bash
# 1 — Navigate to the frontend folder
cd CrediFlowAi/frontend

# 2 — Install Node dependencies
npm install

# 3 — Start the React dev server
npm start
```

The UI will open at **http://localhost:3000**

---

## Demo Flow

1. Open **http://localhost:3000**
2. Upload any **PDF, JPEG or PNG** containing text (a salary slip, loan form, etc.)
3. Click **Analyse Document**
4. Watch the pipeline execute in ~2-5 seconds:
   - Fields extracted by the Intake Agent are shown in the card grid
   - Risk probability and feature-importance chart appear
   - Proposed interest rate, tenor and collateral are displayed
   - Full audit record is available in the expandable JSON viewer

### Quick Test Document

Create a plain `.txt` file, copy the block below into it, save as a JPEG
(screenshot it or use any text-to-image tool), then upload:

```
Loan Application Form

Name:           Priya Sharma
Date of Birth:  15/06/1990
PAN Number:     ABCDE1234F
Aadhaar:        9876 5432 1098

Annual Income:  Rs. 1,200,000
Loan Amount:    Rs. 500,000
Purpose:        Home Renovation

Employment Years: 8
```

---

## API Reference

### `POST /process-loan`

Upload a document and run the full pipeline.

| Field  | Type   | Description         |
|--------|--------|---------------------|
| `file` | File   | PDF / JPEG / PNG    |

**Response:**
```json
{
  "status": "success",
  "parsed_application": { ... },
  "risk_assessment": {
    "risk_probability": 0.23,
    "risk_label": "Low Risk",
    "feature_importance": { ... }
  },
  "loan_terms": {
    "recommended_interest_rate": 11.0,
    "tenor_months": 60,
    "collateral_required": "None",
    "decision": "Pre-Approved"
  },
  "audit_record": { ... }
}
```

### `GET /audit-logs`

Returns all historical audit records (newest first).

### `GET /health`

Liveness probe — returns `{"status": "ok"}`.

---

## Future Extension Points

| Area | Current | Future |
|------|---------|--------|
| OCR  | Tesseract | Cloud Vision API, LayoutLM |
| Risk Model | RandomForest | GNN fraud detection, XGBoost |
| Explanations | Gini importance | SHAP TreeExplainer (per-applicant) |
| Negotiation | Rule-based | Reinforcement Learning agent |
| Audit | JSONL file | Kafka stream, hash-chained ledger |
| Auth | None | JWT + RBAC |

---

## License

MIT — prototype only. Not for production lending decisions.
