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

## Búsqueda (RAG)

Requiere `VOYAGE_API_KEY` en `.env` (modelo `voyage-4`, 1024 dimensiones; configurable con `EMBEDDING_MODEL`).

```bash
.venv/bin/atlas-index            # trocea data/ (experimentos, search/sources.json, CSV crudos), embebe y guarda en pgvector
# primera corrida: 89 new, 0 unchanged, 0 removed; la segunda: 0 new, 89 unchanged, 0 removed
curl -X POST localhost:8000/search -H 'content-type: application/json' \
  -d '{"query": "smoke point in microgravity", "k": 5}'
```

- `atlas-index` es idempotente: cada chunk se identifica por el hash de su contenido, solo se embeben los nuevos y se borran los que ya no existen. Volver a ejecutarlo tras agregar archivos a `data/` es seguro; una segunda corrida seguida embebe 0.
- `POST /search` devuelve `[{experiment_id, source_file, section, content, score}]` ordenado por similitud coseno (`k` entre 1 y 20, por defecto 5). Responde 503 si falta la clave.
- Sin método de pago, Voyage limita a 3 RPM y 10K TPM: el indexado espera y reintenta solo, así que la primera corrida puede tardar unos minutos.

## Pruebas

```bash
.venv/bin/pytest
ATLAS_TEST_DATABASE_URL=postgresql://atlas:atlas@localhost:5433/atlas .venv/bin/pytest
```

La segunda corrida incluye las pruebas contra Postgres; requiere haber ejecutado `atlas-load`. Las pruebas de búsqueda usan un embedder falso (sin red) y vacían `document_chunks` al terminar.

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
- `data/search/sources.json`: investigaciones que solo alimentan la búsqueda con citas (no son puntos del mapa).
- `data/schema/experiment.schema.json`: JSON Schema generado para el front; no se edita a mano.
- `docs/data-extraction.md`: formato, reglas del equipo y prompt de extracción.

Las credenciales (`VOYAGE_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`) van solo en `.env`, que nunca se sube a Git.
