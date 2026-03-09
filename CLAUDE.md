# Meridian — Developer Guide

## What this is

A school quality assessment platform that operationalizes Bellwether's School Quality Framework (SQF). It helps consulting teams and schools move through diagnostic assessments faster using structured workflows and multi-level AI. See the README for the full product vision, feature tour, and design rationale.

## Architecture

**Monorepo with two services:**
- `backend/` — Python FastAPI + PostgreSQL (async via SQLAlchemy + asyncpg)
- `frontend/` — Next.js 16 + React 19 + Tailwind CSS 4

Frontend proxies `/api/*` to the backend via `next.config.ts` rewrites. No auth yet — a role switcher toggle simulates consultant vs school admin views.

## Running locally

```
# Prerequisites: PostgreSQL running, database "meridian" created
# Backend .env must have OPENAI_API_KEY set (see backend/.env.example)

cd backend && source .venv/bin/activate && uvicorn app.main:app --port 8000 --reload
cd frontend && npm run dev
```

The backend auto-creates tables and seeds demo data on startup (see `app/seed.py`). To reset, drop and recreate the `meridian` database.

## Key concepts

**SQF Framework** — 9 dimensions, 43 components, each with Core Actions and Progress Indicators. This is the ontology everything maps to. The framework is seeded from `app/seed.py` — Bellwether's public dimension/component names are real; the detailed success criteria are hypothesized for prototype purposes.

**4-Layer AI** — The AI is not a single chat. It's a hierarchy:
1. **Extraction** (`ai/agents/extraction_agent.py`) — per-document summarization and fact extraction
2. **Component** (`ai/agents/component_agent.py`) — assesses one of 43 components against its criteria using mapped evidence
3. **Dimension** (`ai/agents/dimension_agent.py`) — synthesizes patterns across components within a dimension
4. **Global** (`ai/agents/global_agent.py`) — executive summary across all dimensions

Plus a **Copilot** (`ai/agents/copilot_agent.py`) for interactive Q&A anywhere in the app.

**Model Router** (`ai/model_router.py`) — Routes each AI task type to the appropriate model. Synthesis tasks use the stronger model; extraction uses the cheaper one. This is the abstraction layer for future eval-based routing — change the routing table, not the agents.

**Evidence traceability** — Every score must trace back to evidence. The chain is: `Evidence` → `EvidenceExtraction` (AI summary) → `EvidenceMapping` (links evidence to components with relevance score) → `ComponentScore` (rating with cited strengths/gaps). This is a core design principle, not optional.

## Backend structure

- `app/models/` — SQLAlchemy models. `framework.py` is the SQF ontology; others are engagement-scoped.
- `app/api/routes.py` — All API endpoints in one file. Will need splitting as it grows.
- `app/ai/prompts/system_prompts.py` — All LLM system prompts. Edit here to tune AI behavior.
- `app/services/document_processor.py` — File parsing (PDF via pdfplumber, DOCX via python-docx, XLSX via openpyxl, images via OpenAI vision).
- `app/seed.py` — Framework data + demo engagement for Lincoln Innovation Academy. This file is large because it contains all 43 components' criteria.

## Frontend structure

- `components/EngagementWorkspace.tsx` — Main layout with tab nav and role switcher
- `components/views/` — One file per tab (Dashboard, Framework, Evidence, DataRequests, Scoring, ActionPlan, Messaging)
- `components/CopilotPanel.tsx` — AI copilot slide-over panel
- `lib/api.ts` — API client functions
- `lib/types.ts` — TypeScript types + rating/status display config

## Things to know

- **No migrations yet.** Schema changes require dropping and recreating the database. Adding Alembic is a natural next step.
- **No real auth.** The role switcher is UI-only. Adding proper auth with separate logins is planned for phase 2.
- **All API routes are in one file.** Split into separate routers (`framework.py`, `evidence.py`, etc.) when it gets unwieldy.
- **The SQF criteria are hypothesized.** Dimensions and component names match Bellwether's public materials. The detailed Core Actions and Progress Indicators are prototype assumptions. If Bellwether shares their actual rubric, replace the seed data.
- **Seed data runs every startup** but is idempotent (checks if data exists first).
- **The 4-point rating scale** (Excelling / Meeting Expectations / Developing / Needs Improvement) matches Bellwether's 2025 SQF, not the older 5-point SHA scale.

## Style and conventions

- Backend: standard Python/FastAPI patterns, async throughout, Pydantic v2 schemas
- Frontend: Next.js App Router, client components (`"use client"`), Tailwind utility classes, Lucide icons
- Design: clean enterprise SaaS aesthetic — neutral palette, lots of white space, subtle accent colors. No emojis in UI.
- AI outputs are always JSON-structured with explicit confidence levels and citations
