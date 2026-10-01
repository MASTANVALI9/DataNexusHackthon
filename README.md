# DataNexusHackthon

# TruthLens: AI-Powered Misinformation & Evidence Verification Platform

TruthLens is an evidence-search and claim-assessment application. It retrieves candidate articles through configured providers and applies deterministic lexical rules; it does not directly search every official registry or use an AI inference model.

> **Visual & Architectural Principle:**  
> *"Evidence first, explanation second."*

---

## 🎯 Verification Engine & System Capabilities

- **🎤 Microphone Speech-to-Text Input**: Real-time voice-to-text conversion powered by the browser Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) with pulsing recording indicators, stop/cancel controls, and pre-submission text editing.
- **📷 Camera Live Preview & Image OCR**: Real-time camera capture using `getUserMedia()`, canvas snapshot compression, and client-side **Tesseract.js OCR** text scanning to extract printed headlines and text from document photos or screenshots.
- **🔍 Deterministic Evidence Matching**: Rule-based stance classification (`SUPPORTS`, `CONTRADICTS`, `CONTEXT`, `INSUFFICIENT`) across article titles, descriptions, and available full text. This is lexical evidence matching, not an AI/NLI model.
- **🛡 High-Stakes Person Rumor Safeguard**: Name-only mentions do not verify a claim about death, arrest, or resignation; missing evidence remains unverified rather than being treated as proof of falsity.
- **🏛 Regional Jurisdiction Selection**: The interface carries jurisdiction context for six Indian regions. The included source-registry JSON files are not currently queried as providers.
- **📰 Evidence Retrieval**: Free News API article search and optional Google Fact Check Tools API (`ClaimReview`) lookup. News publishers and official domains are classified from returned records; TruthLens does not directly query each named publisher or government registry.
- **🎨 Existing Results UI**: Translucent header, backend status, circular score meter, and source-attributed evidence excerpts when available.

---

## 📋 Competition & Evaluation Compliance Checklist

The table below records project implementation status only; it does not certify external submission, originality, or judging requirements:

| # | Disqualification Condition | Compliance Status | Implementation Notes |
|---|---|---|---|
| **1** | *Missing mandatory files from ZIP* | **PASS** | Complete codebase included (`frontend/`, `backend/`, `tests/`, configurations, dependencies). |
| **2** | *Code doesn't run / crashes during execution* | **VALIDATE LOCALLY** | Run the backend tests and frontend build using the commands below; no live provider health is implied. |
| **3** | *Incomplete or non-functional project* | **PARTIAL** | Claim input, provider retrieval, heuristic analysis, and results UI exist. Database persistence and direct article-URL retrieval are not implemented. |
| **4** | *Plagiarism / copied solution* | **NOT ASSESSED** | Originality requires an external review. |
| **5** | *Fake or misleading demo results* | **LIMITED** | Search uses configured external providers. Verdict matching is deterministic and heuristic, not NLI or an AI model; provider availability depends on configuration. |
| **6** | *Does not address problem statement* | **PARTIAL** | Provides evidence retrieval and heuristic claim assessment; it does not establish truth when relevant evidence is absent. |
| **7** | *Team / member information missing* | **INCOMPLETE** | Team name, member, and contact fields below are placeholders. |
| **8** | *Submission after deadline* | **NOT ASSESSED** | Submission timing is external to the codebase. |
| **9** | *Multiple submissions* | **NOT ASSESSED** | Submission count is external to the codebase. |
| **10**| *Judges cannot verify solution* | **CONFIGURATION-DEPENDENT** | Free News API is configured as keyless; Google Fact Check lookup is optional and requires `GOOGLE_FACTCHECK_API_KEY`. Live provider behavior is not guaranteed. |

---

## 👥 Team & Member Information

- **Project Name**: TruthLens AI
- **Tagline**: *"Evidence before belief."*
- **Problem Statement**: AI-Powered Fake News Detection & Multi-Source Evidence Verification
- **Team Name**: *[Insert Team Name]*
- **Lead Developer**: *[Insert Member Name]*
- **Contact Email**: *[Insert Email Address]*

---

## 🏗 Directory Layout

```
truthlens/
├── frontend/                     # React 18 + Vite + Tailwind CSS SPA
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx        # Glassmorphic header & live backend status
│   │   │   ├── EvidenceScoreGauge.jsx # Donut score meter & breakdown modal
│   │   │   ├── CameraCaptureModal.jsx # Live camera preview & OCR text extraction
│   │   │   ├── VerificationPipelineModal.jsx # Animated pipeline progress modal
│   │   │   ├── EvidenceCard.jsx  # Normalized evidence presentation card
│   │   │   └── Footer.jsx        # Footer & research disclosures
│   │   ├── pages/
│   │   │   ├── HomePage.jsx      # Multimodal input console (Text | Speak | Camera)
│   │   │   ├── ResultsPage.jsx   # Verdict banner, key facts, sources, matrix
│   │   │   └── HistoryPage.jsx   # Audit history page
│   │   ├── services/
│   │   │   └── api.js            # Axios client connecting to backend
│   │   ├── App.jsx               # Main React layout & routing
│   │   ├── index.css             # Vibrant design CSS system & Tailwind rules
│   │   └── main.jsx              # React DOM entry point
│   ├── index.html                # Tesseract.js CDN script & HTML entry
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
│
├── backend/                      # Python FastAPI application
│   ├── app/
│   │   ├── main.py               # FastAPI entry, CORS, and endpoint routers
│   │   ├── api/
│   │   │   ├── health.py         # GET /api/health implementation
│   │   │   └── evidence.py       # POST /api/evidence/search endpoint
│   │   ├── schemas/
│   │   │   └── evidence.py       # Pydantic models (EvidenceSearchRequest, Response, etc.)
│   │   ├── services/
│   │   │   ├── evidence_orchestrator.py # Multi-provider orchestrator & deduplication
│   │   │   ├── verification_engine.py   # Deterministic evidence stance and scoring
│   │   │   └── providers/
│   │   │       ├── free_news_api.py     # Free News API search provider
│   │   │       └── google_fact_check.py # Google Fact Check Tools API provider
│   │   └── sources/
│   │       └── registry.py       # Official government gazette registries
│   ├── tests/
│   │   └── test_verification.py  # Python automated test suite
│   └── requirements.txt          # Backend Python dependencies
│
└── README.md                     # Complete project documentation
```

### Evidence Support Score

The 0–100 score estimates how strongly retrieved, relevant evidence supports the submitted claim; it is not a probability that the claim is true. A low score may accompany reliable contradictory evidence, while `N/A` means the available evidence does not justify a numeric score. Source reliability, report completeness, and distinct report text contribute; repeated copies of the same article do not count as independent corroboration. The stance engine uses deterministic lexical rules and does not perform semantic NLI.

---

## ⚡️ Quick Start: How to Run the Application

> [!NOTE]
> The backend server runs automatically on **`http://127.0.0.1:8000`**. If you attempt to start a second instance on port 8000 while another process is active, Windows will return `[WinError 10013]` because the socket port is already bound.

### 1. Backend Server (FastAPI)

1. Open PowerShell in `truthlens/backend`:
   ```powershell
   cd truthlens/backend
   ```
2. Activate virtual environment:
   ```powershell
   .\.venv\Scripts\Activate.ps1
   ```
3. Run Uvicorn server:
   ```powershell
   python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```
   *The backend will start at `http://127.0.0.1:8000`.*

   Optional: copy `backend/.env.example` to `backend/.env` and set
   `GOOGLE_FACTCHECK_API_KEY` to enable Google Fact Check lookups. Never commit
   a real API key. The Free News API base URL can be overridden with
   `FREE_NEWS_API_BASE_URL`.

4. Run Backend Automated Test Suite:
   ```powershell
   python -m unittest tests/test_verification.py
   ```

---

### 2. Frontend Application (React + Vite)

1. Open terminal in `truthlens/frontend`:
   ```powershell
   cd truthlens/frontend
   ```
2. Run Vite development server:
   ```powershell
   npm run dev
   ```
3. Open `http://localhost:5173` in your browser.

---

## 📊 Verification Pipeline Workflow

1. **Input Stage**: The user submits a statement by typing, speaking via **🎤 Microphone**, or capturing an image/document via **📷 Camera & OCR**.
2. **Entity & Claim Decomposition**: The backend extracts key entities, dates, and clause breakdowns.
3. **Multi-Source Retrieval**: Queries Free News API and Google Fact Check Tools API simultaneously.
4. **Deduplication & Authority Scoring**: Deduplicates syndicated articles and weights official government gazettes over general news.
5. **High-Stakes Person Protection Protocol**: Ensures rumors regarding death or arrest are verified against explicit event reporting before outputting a verdict.
6. **Verdict & Evidence Output**: Displays status (`✓ SUPPORTED`, `✕ CONTRADICTED`, `⚠️ MISLEADING`, `? UNVERIFIED`), an evidence support score when justifiable, and excerpts traceable to retrieved records.

