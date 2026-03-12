# Meridian

A school quality assessment platform that operationalizes Bellwether's [School Quality Framework](https://bellwether.org/blog/reimagining-excellence-introducing-bellwethers-school-quality-framework/) (SQF). Meridian helps consulting teams and schools move through diagnostic assessments faster using structured workflows, evidence traceability, and multi-level AI.

This is not a generic dashboard or a single chatbot. It is a **workflow + ontology + evidence system** for school quality engagements — grounded in Bellwether's public 9 dimensions and 43 components, with every finding traceable back to source documents.

**The one-line product thesis:** Watershed-grade traceability + TurboTax-grade guided intake + Better-grade shared workflow, all wrapped around a Bellwether-native school quality ontology and accelerated by multi-level AI orchestration.

See [CLAUDE.md](CLAUDE.md) for developer conventions.

---

## Table of Contents

- [Product Vision](#product-vision)
- [Getting Started](#getting-started)
- [Architecture](#architecture)
- [Feature Tour](TOUR.md)
- [The AI System](#the-ai-system)
- [Data Model](#data-model)
- [API Reference](#api-reference)
- [Frontend Structure](#frontend-structure)
- [Design Principles and Guardrails](#design-principles-and-guardrails)
- [What is Public vs. Hypothesized About the SQF](#what-is-public-vs-hypothesized-about-the-sqf)
- [Current Status and Limitations](#current-status-and-limitations)
- [Reference Materials](#reference-materials)

---

## Product Vision

We are not building an AI that judges schools. We are building a **framework-native workflow platform** that helps consultants and schools move through Bellwether-style school quality assessment faster, with stronger evidence coverage, clearer traceability, better collaboration, and better draft action plans.

The system is modeled after three product patterns:

- **[Watershed](https://watershed.com/)** — traceability, source-of-truth design, and expert-mediated data workflows. Every claim answers "Why are you saying that?" with linked evidence, excerpts, metrics, provenance, and confidence.
- **[TurboTax](https://ttlc.intuit.com/turbotax-support/en-us/help-article/product-setup/upload-documents-full-service-tax-expert/L4cgjPYQI_US_en_US)** — guided intake, adaptive evidence collection, and structured expert-ready preparation. The platform walks users through what's needed and adapts based on what's been provided.
- **[Better](https://better.com/)** — shared requests, document collection, in-product follow-up, and replacing email-heavy workflows with a two-sided workspace where both parties see progress.

### Strategic Context

These insights shape product decisions:

- **The moat is not AI summarization.** The moat is the combination of workflow, ontology, evidence graph, traceability, and human review. Any LLM can summarize a document; very few products can structure evidence against a 43-component diagnostic framework with full provenance.
- **The initial buyer is the consulting team, not the school.** Start as an internal accelerator for Bellwether's assessment work, then expand into a joint workspace, then potentially lighter self-serve use.
- **The best wedge is assessment acceleration.** Not "continuous school operating system." The expensive, labor-intensive front end of an engagement — evidence collection, synthesis, and diagnosis — is where software can compress the most time.
- **Build the workflow before overbuilding the scoring model.** The first source of value is faster, more organized evidence collection and synthesis, not a perfect rating algorithm.
- **The highest-value on-site time is trust-building and strategy work.** The software should reduce collection and synthesis burden so consultants' live time with schools is spent on leadership alignment and decision-making, not chasing documents.
- **This should feel like consulting software, not generic edtech.** The product operationalizes a high-stakes expert workflow — that's why the Watershed/TurboTax/Better analogies matter more than typical edtech comparisons.

---

## Getting Started

### Quick Start (Docker)

```bash
# 1. Create .env in the project root with your OpenAI key
echo "OPENAI_API_KEY=sk-your-key-here" > .env

# 2. Start everything
docker compose up --build -d

# 3. Open http://localhost:3000
```

This starts PostgreSQL, the FastAPI backend, and the Next.js frontend. The backend auto-creates tables and seeds a demo engagement on first startup (Lincoln Innovation Academy, a fictional K-8 charter school with 420 students in Metro City Public Schools, MN).

### Without Docker

**Prerequisites:** PostgreSQL running locally, Python 3.11+, Node.js 20+, OpenAI API key.

```bash
# 1. Create the database
createdb meridian

# 2. Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # Edit and set OPENAI_API_KEY
uvicorn app.main:app --port 8000 --reload

# 3. Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes | — | OpenAI API key for all AI agents |
| `DATABASE_URL` | No | `postgresql+asyncpg://meridian:meridian@localhost:5432/meridian` | PostgreSQL connection string |
| `BACKEND_URL` | No | `http://localhost:8000` | Backend URL for the frontend proxy (set automatically in Docker) |

### Resetting the Database

There are no migrations yet. To reset:

```bash
# Docker
docker compose exec db psql -U meridian -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
docker compose restart backend

# Without Docker
dropdb meridian && createdb meridian
# Restart the backend — tables and seed data recreate automatically
```

### Demo Documents

The `demo_uploads/` folder contains 29 realistic school documents (CSVs, reports, transcripts) that are not pre-loaded into the platform. Upload them through the Evidence tab to demonstrate the full processing pipeline.

---

## Architecture

### Overview

Monorepo with two services:

```
bellwaither/
├── backend/           Python FastAPI + PostgreSQL (async via SQLAlchemy + asyncpg)
│   ├── app/
│   │   ├── ai/        AI agents, model router, and system prompts
│   │   ├── api/       API routes (single file currently)
│   │   ├── models/    SQLAlchemy ORM models
│   │   ├── services/  Document processing pipeline
│   │   ├── config.py  Settings via pydantic-settings
│   │   ├── main.py    FastAPI app, lifespan, CORS
│   │   └── seed.py    Framework + demo data seeding
│   └── requirements.txt
├── frontend/          Next.js 16 + React 19 + Tailwind CSS 4
│   ├── app/           Next.js App Router pages
│   ├── components/    React components (views/, CopilotPanel, etc.)
│   └── lib/           API client, types, utilities
└── screenshots/       Feature tour screenshots
```

### How the services connect

The frontend runs on port 3000 and proxies all `/api/*` requests to the backend on port 8000 via a Next.js rewrite rule in `next.config.ts`. Client code uses relative URLs (`/api/...`) — no CORS issues in development.

The backend uses FastAPI's async lifespan to initialize the database, create tables, and seed data on startup. CORS is configured to allow `http://localhost:3000`.

### Tech Stack

**Backend:**
- FastAPI 0.115 — async web framework
- SQLAlchemy 2.0 (async mode) + asyncpg — ORM and PostgreSQL driver
- Pydantic v2 — request/response validation
- OpenAI SDK 1.51 — AI agent calls
- pdfplumber, python-docx, openpyxl — document parsing
- Pillow — image support
- Alembic 1.13 — installed but not yet configured for migrations

**Frontend:**
- Next.js 16 — App Router, server components (though most are client-side `"use client"`)
- React 19 — latest features
- Tailwind CSS 4 — utility-first styling
- Lucide React — icon library
- TypeScript 5.9 — strict typing

---

## Feature Tour

See **[TOUR.md](TOUR.md)** for the full visual walkthrough with 22 annotated screenshots covering both the consultant and school admin views.

Quick highlights:
- **Consultant dashboard** with SQF heatmap, KPI cards, and cross-linked findings
- **Framework browser** — 9 dimensions, 43 components, Core Actions and Progress Indicators
- **Evidence repository** with AI extraction, document preview, and download
- **Data requests** with inline conversations synced to the Messages tab
- **4-layer diagnostic workspace** — component assessment, dimension synthesis, global summary, with batch generation, approve/lock, and "insufficient evidence" handling
- **Action planning** with evidence-based rationale and component cross-links
- **Slack-style messaging** with channels, @mentions, @Meridian AI for inline AI actions, and data request thread sync
- **AI copilot** with tool calling (creates data requests from chat)
- **Activity log** tracking all engagement events with multiple actors and action types
- **@Meridian AI mentions** in chat — invoke the AI copilot inline from any conversation
- **Two-sided role switching** — consultant view (editing, AI controls, feedback) vs. school admin view (progress-oriented, read-only, no AI terminology)

---

## The AI System

Meridian's AI is not a single chat interface. It is a **4-layer hierarchy** where each layer operates within bounded reasoning units, uses structured JSON output, and cites specific evidence for every claim.

### Layer Architecture

```
Layer 4: Global Agent          ← Executive summary across all dimensions
    ↑
Layer 3: Dimension Agent       ← Synthesize patterns across components in one dimension
    ↑
Layer 2: Component Agent       ← Assess one of 43 components against its criteria
    ↑
Layer 1: Extraction Agent      ← Per-document summarization and fact extraction

Cross-cutting: Copilot Agent   ← Interactive Q&A anywhere in the app
```

Each layer consumes the output of the layer below it. This means the system never tries to reason over the entire evidence base in a single LLM call — it decomposes the problem along the same lines as Bellwether's own framework.

### Layer 1: Extraction Agent

**Purpose:** Process individual uploaded documents into structured findings.

**Input:** Raw document text or spreadsheet data (after parsing by the document processor).

**Output:** JSON with `summary`, `key_findings` (list), `structured_data` (metrics), and `suggested_components` (SQF component codes the document likely maps to).

**Model:** gpt-4.1-mini (cheaper model — extraction is high-volume, lower-complexity).

**Details:**
- Handles both text documents and spreadsheets with separate extraction paths
- Truncates large datasets (>100 rows, >50K characters) before sending to the model
- Distinguishes facts from inferences and cites page numbers/sections
- References all 9 SQF dimensions to suggest component mappings
- Temperature: 0.2 (deterministic)

### Layer 2: Component Agent

**Purpose:** Assess one of the 43 SQF components against its specific success criteria using mapped evidence.

**Input:** Component code/name, dimension context, Core Actions, Progress Indicators, and all evidence items mapped to this component (with relevance scores and excerpts).

**Output:** JSON with `rating` (4-point scale), `confidence` (low/medium/high), `strengths`, `gaps`, `contradictions`, `missing_evidence`, `rationale`, `suggested_actions`, and `follow_up_requests`.

**Model:** gpt-4.1 (stronger model — scoring requires nuanced judgment).

**Critical rules enforced by the system prompt:**
- Every finding must cite specific evidence
- If evidence is insufficient, the agent must rate as `not_rated` rather than guess
- Must distinguish AI inference from direct evidence
- Temperature: 0.3 (controlled creativity)

### Layer 3: Dimension Agent

**Purpose:** Synthesize patterns across all scored components within one of the 9 SQF dimensions.

**Input:** Dimension name and all component scores within that dimension.

**Output:** JSON with `overall_assessment` (narrative), `patterns` (cross-component themes), `compounding_risks`, `top_opportunities`, and `leadership_attention` items.

**Model:** gpt-4.1 (synthesis task). Temperature: 0.3.

### Layer 4: Global Agent

**Purpose:** Produce an executive-level summary across all 9 dimensions for school leaders and consultants.

**Input:** School name, engagement stage, and all dimension summaries.

**Output:** JSON with `executive_summary` (3-5 paragraphs), `top_strengths`, `critical_gaps`, `strategic_priorities`, `resource_implications`, and `recommended_next_steps`.

**Model:** gpt-4.1 (highest-stakes synthesis). Temperature: 0.3.

**Details:** Writes for a sophisticated education audience. Direct about challenges while acknowledging strengths. Grounds all claims in evidence from lower layers.

### Copilot Agent

**Purpose:** Interactive Q&A anywhere in the app — finding evidence, explaining ratings, identifying gaps, drafting follow-up requests, suggesting actions.

**Input:** School name, current screen context, user role, message, evidence context, and last 10 messages of conversation history.

**Output:** Freeform chat response with `model_used` metadata.

**Model:** gpt-4.1-mini (retrieval/chat task). Temperature: 0.4 (more creative for conversational flow).

**Details:** Context-aware — it knows which screen the user is on and adapts its responses. Always cites specific evidence, is honest about uncertainty, and keeps responses concise and actionable.

### Model Router

All AI calls go through the **model router** (`ai/model_router.py`), which maps task types to models:

| Task Type | Model | Use Case |
|-----------|-------|----------|
| `EXTRACTION` | gpt-4.1-mini | Document summarization, fact extraction |
| `COMPONENT_SCORING` | gpt-4.1 | Component-level assessment |
| `DIMENSION_SYNTHESIS` | gpt-4.1 | Cross-component pattern analysis |
| `GLOBAL_ORCHESTRATION` | gpt-4.1 | Executive summary generation |
| `EVIDENCE_TAGGING` | gpt-4.1-mini | Mapping evidence to components |
| `COPILOT_CHAT` | gpt-4.1-mini | Interactive Q&A |
| `REPORT_GENERATION` | gpt-4.1 | Action plan drafting |
| `EVIDENCE_RETRIEVAL` | gpt-4.1-mini | Evidence search and lookup |

The router is the abstraction layer for future eval-based routing — change the routing table, not the agents.

### Document Processing Pipeline

When a document is uploaded, the processing pipeline (`services/document_processor.py`) handles parsing before the AI sees anything:

| Format | Library | Notes |
|--------|---------|-------|
| PDF | pdfplumber | Extracts text per page with page markers |
| Word (.docx) | python-docx | Extracts paragraphs and table rows |
| Excel (.xlsx) | openpyxl (read-only mode) | Returns list of dicts with sheet tracking; samples first 100 rows for AI |
| Images (.png, .jpg, .gif, .webp) | OpenAI Vision API (gpt-4.1-mini) | Describes text, tables, and charts; 4000 max tokens |
| Text (.txt, .csv, .md) | Raw file read | Preserves content as-is |

After parsing, the extraction agent generates findings, and the system automatically maps evidence to relevant SQF components with relevance scores.

### Evidence Traceability Chain

Every score in Meridian must trace back to source documents:

```
Evidence (uploaded document)
  → EvidenceExtraction (AI-generated summary + key findings)
    → EvidenceMapping (links evidence to components with relevance score 0.0-1.0)
      → ComponentScore (rating with cited strengths, gaps, contradictions)
        → DimensionSummary (cross-component patterns)
          → GlobalSummary (executive overview)
```

This is a core design principle, not optional. The system prompt for the component agent enforces citation requirements — if the model can't cite evidence, it must rate the component as `not_rated`.

---

## Data Model

### Framework (SQF Ontology)

The SQF structure is seeded on startup from `app/seed.py`:

- **Dimension** — 9 dimensions (e.g., "Organizational Purpose", "Academic Program", "Finance"), each with a number (1-9), description, and display color
- **Component** — 43 components (e.g., "1A: Mission, Vision, and Values"), each belonging to one dimension, with a code, name, description, and evidence guidance
- **SuccessCriterion** — Core Actions and Progress Indicators for each component, defining what each rating level looks like

Dimension and component names match Bellwether's public materials. The detailed success criteria are **hypothesized for prototype purposes** — if Bellwether shares their actual rubric, replace the seed data.

### Engagement Models

- **Engagement** — A school assessment workspace (school name, type, district, grade levels, enrollment, stage: Setup → Assessment → Plan Development → Implementation)
- **EngagementMember** — Team members with roles: Lead Consultant, Analyst, School Leader, Data Steward

### Evidence Models

- **Evidence** — Uploaded documents with metadata (file type, evidence type, processing status, uploader)
- **EvidenceExtraction** — AI-generated summary, key findings, structured data, and model used
- **EvidenceMapping** — Links evidence to components with relevance score (0.0-1.0), relevant excerpts, rationale, and a consultant confirmation flag

### Scoring Models

- **ComponentScore** — Rating (4-point scale + not_rated), status (Draft → In Review → Confirmed), confidence level, strengths, gaps, contradictions, missing evidence, AI rationale, consultant notes, and suggested actions
- **DimensionSummary** — Cross-component patterns, compounding risks, opportunities, and leadership attention items
- **GlobalSummary** — Executive summary, top strengths, critical gaps, strategic priorities, resource implications, and next steps

### Collaboration Models

- **DataRequest** — Structured requests for evidence (priority, status, assignee, rationale, due date)
- **DataRequestComment** — Threaded comments on data requests
- **ActionPlan** — Improvement plans with status tracking (Draft → In Review → Approved → In Progress)
- **ActionItem** — Individual actions with owner, priority, target date, evidence-based rationale, and linked milestones
- **Milestone** — Sub-tasks within action items
- **MessageThread** — Conversation channels (general, per-data-request, per-component, per-action-item)
- **Message** — Individual messages with author, role, content, and attachments

All models use PostgreSQL UUIDs as primary keys.

---

## API Reference

All endpoints are in `app/api/routes.py` under the `/api` prefix. The main groups:

### Framework
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/framework` | Full SQF structure (dimensions, components, criteria) |
| GET | `/api/framework/components/{id}` | Single component with all criteria |

### Engagements
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/engagements` | List all engagements |
| POST | `/api/engagements` | Create new engagement |
| GET | `/api/engagements/{id}` | Single engagement with members and stats |

### Evidence
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/engagements/{id}/evidence` | List all evidence for engagement |
| POST | `/api/engagements/{id}/evidence` | Upload document (triggers extraction + mapping) |
| GET | `/api/engagements/{id}/evidence/{eid}/extractions` | AI-extracted findings |
| PATCH | `/api/engagements/{id}/evidence/{eid}/extractions/{ext_id}` | Edit extraction summary/findings |
| GET | `/api/engagements/{id}/evidence/{eid}/download` | Download original file |
| GET | `/api/engagements/{id}/evidence/{eid}/mappings` | Component mappings for an evidence item |
| GET | `/api/engagements/{id}/evidence-counts` | Evidence count per component |
| GET | `/api/engagements/{id}/components/{comp_id}/evidence-ids` | Evidence IDs mapped to a component |

### Scoring
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/engagements/{id}/scores` | All component scores for engagement |
| POST | `/api/engagements/{id}/scores/{component_id}/assess` | Trigger AI assessment for a component |
| PATCH | `/api/engagements/{id}/scores/{score_id}` | Edit score fields (strengths, gaps, rationale, etc.) |
| PATCH | `/api/engagements/{id}/scores/{score_id}/approve` | Toggle approval/lock on a score |

### Dimension and Global Synthesis
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/engagements/{id}/dimensions/{dim_id}/synthesize` | Trigger dimension synthesis |
| GET | `/api/engagements/{id}/dimension-summaries` | List dimension summaries |
| PATCH | `/api/engagements/{id}/dimension-summaries/{sid}` | Edit dimension summary |
| PATCH | `/api/engagements/{id}/dimension-summaries/{sid}/approve` | Toggle approval/lock |
| POST | `/api/engagements/{id}/global-summary` | Generate executive summary |
| GET | `/api/engagements/{id}/global-summary` | Retrieve most recent global summary |
| PATCH | `/api/engagements/{id}/global-summary/{sid}` | Edit global summary |
| PATCH | `/api/engagements/{id}/global-summary/{sid}/approve` | Toggle approval/lock |

### Batch Generation
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/engagements/{id}/batch/assess-components` | Generate all component assessments |
| POST | `/api/engagements/{id}/batch/synthesize-dimensions` | Generate all dimension summaries |
| POST | `/api/engagements/{id}/batch/generate-global` | Generate global summary |

### Data Requests
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/engagements/{id}/data-requests` | List all data requests |
| POST | `/api/engagements/{id}/data-requests` | Create new request |
| PATCH | `/api/engagements/{id}/data-requests/{rid}` | Update status |
| GET | `/api/engagements/{id}/data-requests/{rid}/comments` | List comments |
| POST | `/api/engagements/{id}/data-requests/{rid}/comments` | Add comment |

### Action Plans
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/engagements/{id}/action-plans` | List action plans |
| GET | `/api/engagements/{id}/action-plans/{pid}/items` | List items in a plan |

### Messaging
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/engagements/{id}/threads` | List threads (includes data request conversations) |
| POST | `/api/engagements/{id}/threads` | Create new channel |
| GET | `/api/engagements/{id}/threads/{tid}/messages` | List messages (syncs DR comments for DR threads) |
| POST | `/api/engagements/{id}/threads/{tid}/messages` | Send message (creates DR comment for DR threads) |

### Copilot
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/engagements/{id}/copilot` | Chat with AI copilot (context-aware, with tool calling) |

### Activity
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/engagements/{id}/activity` | Activity log entries |

### Export
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/engagements/{id}/export` | Export assessment as PDF |

### Feedback
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/engagements/{id}/feedback` | Submit thumbs up/down on AI output |
| GET | `/api/engagements/{id}/feedback` | Get feedback (filter by target_type/target_id) |

---

## Frontend Structure

```
frontend/
├── app/                          Next.js App Router
│   ├── layout.tsx                Root layout
│   └── page.tsx                  Entry point (loads EngagementWorkspace)
├── components/
│   ├── EngagementWorkspace.tsx   Main layout: tab nav, role switcher, cross-navigation
│   ├── CopilotPanel.tsx          AI copilot slide-over panel with tool calling
│   ├── EditableText.tsx          Reusable in-place text editing (consultant-only)
│   ├── AIFeedback.tsx            Thumbs up/down feedback widget (consultant-only)
│   ├── DocumentPreviewModal.tsx  Full-screen document preview overlay
│   ├── AIMarkdown.tsx            Shared markdown renderer for AI content
│   └── views/                    One component per tab:
│       ├── DashboardView.tsx     KPIs, SQF heatmap, key findings, recent evidence
│       ├── FrameworkView.tsx     3-column SQF browser
│       ├── EvidenceView.tsx      Document list + AI extraction detail
│       ├── DataRequestsView.tsx  Request list + detail + inline messaging
│       ├── ScoringView.tsx       Diagnostic workspace (Layer 2/3/4 tabs)
│       ├── ActionPlanView.tsx    Action items with evidence rationale
│       ├── MessagingView.tsx     Team messaging channels
│       └── ActivityView.tsx     Activity log
├── lib/
│   ├── api.ts                    API client functions (fetch wrappers)
│   └── types.ts                  TypeScript types + rating/status display config
└── public/                       Static assets
```

**Conventions:**
- All view components are client-side (`"use client"`) — data fetching via `useEffect` + `useState`
- Tailwind utility classes for all styling — clean enterprise SaaS aesthetic with neutral palette, white space, and subtle accent colors
- Lucide icons throughout
- No component library (custom UI built with Tailwind)

---

## Design Principles and Guardrails

### Principles

- **Evidence traceability** — Every score traces back to source documents through a verifiable chain. The AI system prompt enforces citation requirements: if evidence is insufficient, the model must say so rather than guess.
- **Framework-native** — Use Bellwether's public SQF skeleton exactly. Do not invent a new top-level framework. The SQF ontology (9 dimensions, 43 components, Core Actions, Progress Indicators) is the backbone of every screen, every AI call, and every data structure. AI reasons within the framework, not outside it.
- **Multi-level AI** — Not one giant LLM pass. The information load across a full school assessment is too large and too heterogeneous for a single context window. Each layer operates within bounded reasoning units sized to the framework's natural decomposition — documents, components, dimensions, global.
- **Human-in-the-loop** — AI generates draft assessments; consultants review, edit, and confirm. Scores have an explicit status workflow (Draft → In Review → Confirmed). The product accelerates expert judgment, it doesn't replace it.
- **Two-sided collaboration** — The consultant-school back-and-forth is central, not a phase-2 add-on. Data requests, messaging, evidence uploads, and action plans are all designed for both roles from day one.
- **The score is an output, not the product** — The product is the evidence-backed diagnostic and planning system. Ratings are one artifact of a broader improvement process.

### Guardrails

These are things to actively avoid:

- **Do not build a black-box school score.** Bellwether's framework is multi-dimensional and designed for reflection, planning, and improvement — not simplistic ranking.
- **Do not lead with "replace consultants."** Lead with "make consultants faster, more consistent, and more evidence-backed." Bellwether's process depends on meetings, focus groups, site visits, and shared ownership.
- **Do not confuse evidence ingestion with decision quality.** The hard problem is not uploading files. It is structuring evidence, preserving provenance, resolving contradictions, and helping people make decisions. A product that ingests a lot of documents but doesn't help people reason about them is not useful.
- **Do not overclaim Bellwether alignment.** Be explicit about what is public Bellwether structure versus what is prototype logic or placeholder criteria. See the [SQF section below](#what-is-public-vs-hypothesized-about-the-sqf) for specifics.
- **Do not optimize for one giant LLM pass.** Structure the system around bounded reasoning units — Bellwether's own framework gives you the right decomposition.

---

## What is Public vs. Hypothesized About the SQF

Meridian is anchored in Bellwether's publicly available School Quality Framework materials. It is important to be clear about what comes from Bellwether and what is prototype assumption.

### What is public (safe to use)

- The 9 SQF dimensions and their names
- The 43 component names within those dimensions
- The concept of Core Actions and Progress Indicators as the structure for success criteria
- Bellwether's description of using the SQF in assessments and strategic planning
- The 4-point rating scale: Excelling, Meeting Expectations, Developing, Needs Improvement

### What is hypothesized (needs replacement if Bellwether shares actual materials)

- **Full detailed criteria for most components** — the Core Actions and Progress Indicators in `seed.py` are educated guesses based on component names and public descriptions
- **Exact evidence requirements by component** — which document types and data points are needed to score each component
- **Exact weighting or scoring logic** — how individual criteria roll up into a component rating
- **Bellwether's proprietary implementation details** — internal processes, templates, report formats
- **Report formatting and priority-generation logic** — how findings translate into action plan structure

If Bellwether provides their actual rubric, replace the seed data in `app/seed.py`. The dimension and component names should remain stable; the success criteria content is what would change.

---

## Current Status and Limitations

This is a working prototype. It demonstrates the full workflow from evidence upload through AI-powered diagnosis to action planning, but several things are not production-ready:

| Area | Status | Next Step |
|------|--------|-----------|
| **Authentication** | No real auth — role switcher is UI-only | Add proper auth with separate consultant/school logins |
| **Database migrations** | Alembic installed but not configured; schema changes require dropping and recreating the DB | Set up Alembic migration scripts |
| **API organization** | All routes in a single file (`routes.py`) | Split into separate routers (framework, evidence, scoring, etc.) |
| **SQF criteria** | Dimension/component names are real (Bellwether public); Core Actions and Progress Indicators are hypothesized | Replace seed data if Bellwether shares actual rubric |
| **File storage** | Uploads stored locally in `uploads/` directory | Move to S3 or equivalent |
| **Testing** | No automated tests | Add pytest for backend, Jest/Playwright for frontend |
| **Error handling** | Basic — AI failures surface as 500s | Add retry logic, graceful degradation, user-facing error states |
| **Seed data** | Runs on every startup (idempotent) | Separate seeding from app startup |

### The 4-Point Rating Scale

Meridian uses Bellwether's 2025 SQF rating scale:

| Rating | Color | Description |
|--------|-------|-------------|
| Excelling | Green | Consistently demonstrates all success criteria |
| Meeting Expectations | Blue | Demonstrates most success criteria with minor gaps |
| Developing | Orange/Yellow | Partially demonstrates criteria with significant gaps |
| Needs Improvement | Red | Does not yet demonstrate most criteria |

This is the 2025 scale, not the older 5-point SHA scale.

---

## Reference Materials

### In this repo

- **[CLAUDE.md](CLAUDE.md)** — Developer guide with codebase conventions, run commands, and file-level architecture details

### Bellwether background reading

These are the key external references for understanding the SQF and the consulting workflow this product accelerates:

- **[Bellwether SQF launch post](https://bellwether.org/blog/reimagining-excellence-introducing-bellwethers-school-quality-framework/)** — The single most important public document. Explains what the SQF is, why Bellwether created it, how it is structured, and how they use it.
- **[SQF framework image](https://bellwether.org/wp-content/uploads/2025/08/2025-08-27-BDC-SQF-2.0-Blog-0_Framework-scaled.jpg)** — The cleanest public source for the 9 dimensions and 43 components. Useful for verifying that Meridian's seed data matches.
- **[SQF example component image](https://bellwether.org/wp-content/uploads/2025/08/image2.png)** — Shows how one component is expressed via Core Actions and Progress Indicators. This informed the component-level schema design.
- **[Shared Strategies: An Examination of Bellwether's School Cohort Program](https://bellwether.org/wp-content/uploads/2023/09/SharedStrategies_Bellwether_September2023.pdf)** — Critical for understanding Bellwether's diagnostic-to-plan-to-monitor operating model and the labor-intensive workflow Meridian should accelerate.
- **[SchoolPerformanceFrameworks.org](https://bellwether.org/publications/schoolperformanceframeworksorg/)** — How performance frameworks are used for accountability, continuous improvement, and communication. Good conceptual context.
- **[Intentional Alignment: Strategic Resource Management](https://bellwether.org/publications/intentional-alignment/)** — Key Bellwether thought leadership for the finance and resource-allocation dimensions.
- **[Beyond the Bottom Line: K-12 Fiscal Accountability](https://bellwether.org/publications/beyond-the-bottom-line/)** — Useful if the finance module needs to sound natively Bellwether rather than generic budgeting software.

### Product pattern references

These are not about education — they're about the product patterns Meridian draws from:

- **[Watershed](https://watershed.com/)** — Traceability, source-of-truth design, expert-mediated data workflows
- **[Better](https://better.com/)** — Shared requests, document collection, in-product follow-up, replacing email-heavy workflows
- **[TurboTax document upload flow](https://ttlc.intuit.com/turbotax-support/en-us/help-article/product-setup/upload-documents-full-service-tax-expert/L4cgjPYQI_US_en_US)** — Guided intake, adaptive evidence collection, structured expert-ready preparation
