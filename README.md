# Lunar Fire Atlas · Backend

API for the **Lunar Fire Atlas** (NASA Space Apps Challenge 2026). It turns the combustion experiments in the **NASA Physical Sciences Informatics (PSI)** repository into queryable data, makes them searchable with citations, and answers natural-language questions with a multi-agent system that cannot make up figures.

The full project overview and the interface (3D laboratory, evidence map and copilot) live on the [`main`](../../tree/main) branch.

## What it does

| Capability | Endpoint | Uses AI? |
| --- | --- | --- |
| Trial catalog with O₂ and pressure filters | `GET /experiments` | No |
| Evidence coverage and gaps against mission conditions | `GET /coverage` | No |
| Semantic search with citations | `POST /search` | Embeddings and reranking |
| Streaming answers to questions | `POST /query` | Claude agents |
| Service and database status | `GET /health` | No |

Interactive documentation at `/docs` (OpenAPI).

## From NASA documents to a verifiable answer

1. **Extraction.** The experimental tables and reports of 13 PSI investigations (ACME, FLEX, CFI, SAME, BASS, SAFFIRE…) were converted with Claude into a common JSON contract, validated with Pydantic and reviewed by the team. Result: **1,115 observations**, each with material, O₂, pressure, gravity, outcome and its exact location in the source. The original tables are kept unchanged in `data/raw/`.
2. **Loading.** `atlas-load` validates the whole batch and stores it in PostgreSQL; if any file is invalid, nothing is loaded.
3. **Indexing.** `atlas-index` splits the reports into **1,283 chunks**, embeds them with Voyage AI (`voyage-4`) and stores them in pgvector. It is incremental: only new content is embedded.
4. **Querying.** A Python orchestrator coordinates four agents:

   | Agent | Role |
   | --- | --- |
   | Classifier (Claude Haiku) | Reads the question type and decides whether data, sources or both are needed |
   | Analyst (Claude) | Chooses filters; Python does the computation over the trials |
   | Researcher (Claude + Voyage) | Retrieves chunks, reranks them with `rerank-2.5` and cites experiment, file and section |
   | Composer (Claude) | Builds the answer the interface renders |

   The analyst and researcher run in parallel, and progress streams over SSE.
5. **Verification without AI.** Before answering, every table, citation, experiment and figure is checked against what the tools actually returned. Anything that does not match is dropped, and if the agents fail or time out, the answer is built from fixed rules.

**In one sentence:** the AI understands the question, decides what to look up and explains it; the numbers and sources always come from NASA PSI data.

*Source of the figures: counts come from `data/experiments/` and `build_chunks(data/)`; details in [`curren_repo_context/uso-ia.md`](curren_repo_context/uso-ia.md) (Spanish).*

## Key finding

All 1,115 observations were made in microgravity (ISS and Cygnus spacecraft); **none in lunar gravity**. `GET /coverage` compares the evidence with mission reference conditions, each sourced in [`data/reference/conditions.json`](data/reference/conditions.json) (lunar and Martian habitats, lunar EVA suit, ISS cabin), and flags as a gap any condition that only has trials in a different gravity.

## Architecture

Each module in `src/atlas/` is a product area with `domain`, `application`, `infrastructure` and `api` layers (Clean Architecture):

| Module | Responsibility |
| --- | --- |
| `experiments` | Data contract, validation, loading and catalog |
| `coverage` | Evidence coverage and gaps against mission conditions |
| `search` | Ingestion, embeddings, pgvector, reranking and citations |
| `agents` | Orchestrator, agents and answer verification |
| `query` | `/query` endpoint with SSE streaming and cache |
| `shared` | Configuration and database connection |

**Technologies:** Python 3.12, FastAPI, Pydantic, PostgreSQL 17 + pgvector, Claude Agent SDK, Voyage AI, Pytest and Docker.

## Run it locally

```bash
python3 -m venv .venv
.venv/bin/pip install -e '.[dev]'
cp .env.example .env
docker compose up -d db
.venv/bin/atlas-load
AGENTS_MOCK=1 .venv/bin/uvicorn atlas.main:app --reload
```

With `AGENTS_MOCK=1`, `/query` answers without AI keys. Open <http://localhost:8000/docs>.

## Documentation

- [Deployment (Railway, pgvector database and Vercel)](docs/deploy.md)
- [Technical reference: endpoints, search, tests and operations](docs/referencia.md) (Spanish)
- [PSI data extraction format and rules](docs/data-extraction.md) (Spanish)
- [Agent flow, UI contract and SSE events](curren_repo_context/README.md) (Spanish)

## Team

- Diego Daher Diaz
- Karen Vazquez
- Mario Lira
- Emiliano Holguin
- Diego Antunez
- Alejandro De Busk
