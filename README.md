# Atlas del Fuego Lunar · Backend

Backend en Python del Atlas: datos de investigaciones de NASA PSI, búsqueda y agentes. El front vive en la rama `main`.

## Arranque

```bash
python3 -m venv .venv
.venv/bin/pip install -e '.[dev]'
cp .env.example .env
docker compose up -d db          # Postgres 17 + pgvector en localhost:5433
.venv/bin/atlas-validate         # valida data/experiments y regenera el JSON Schema
.venv/bin/atlas-load             # aplica db/schema.sql y carga los experimentos
.venv/bin/uvicorn atlas.main:app --reload
```

- API: <http://localhost:8000> · documentación interactiva en `/docs`
- `GET /health`: estado de la API y de la base de datos
- `GET /experiments` y `GET /experiments/{id}`: experimentos validados para el mapa

## Pruebas

```bash
.venv/bin/pytest
ATLAS_TEST_DATABASE_URL=postgresql://atlas:atlas@localhost:5433/atlas .venv/bin/pytest
```

La segunda corrida incluye las pruebas contra Postgres; requiere haber ejecutado `atlas-load`.

## Estructura

Cada módulo de `src/atlas/` es un área del producto con sus capas `domain`, `application`, `infrastructure` y `api`.

| Módulo | Rol | Responsabilidad |
| --- | --- | --- |
| `experiments` | 1 | Contrato de datos, validación, carga a Postgres y endpoints del mapa |
| `search` | 2 | Ingesta de documentos, embeddings con Voyage, pgvector, reranker y citas |
| `agents` | 3 | Orquestador, analista, investigador, compositor y extractor (offline) |
| `query` | 3 y 5 | `POST /query` con streaming por SSE del JSON de UI (contrato pendiente) |
| `shared` | 3 | Configuración, conexión a la base y dependencias de FastAPI |

Otros directorios:

- `db/schema.sql`: esquema idempotente (`experiments`, `experiment_tests`, `document_chunks`).
- `data/experiments/PSI-<n>.json`: un archivo por investigación.
- `data/raw/PSI-<n>/`: copia sin cambios de la tabla experimental de PSI.
- `data/schema/experiment.schema.json`: JSON Schema generado para el front; no se edita a mano.
- `docs/data-extraction.md`: formato, reglas del equipo y prompt de extracción.

Las credenciales (`VOYAGE_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`) van solo en `.env`, que nunca se sube a Git.
