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
  - Filtros opcionales de `GET /experiments`, con límites inclusivos: `min_o2_percent`, `max_o2_percent`, `min_pressure_kpa`, `max_pressure_kpa` y `exclude_assumed=true` (descarta puntos con O₂ o presión supuestos). Cada experimento conserva solo sus `tests` que cumplen y se omiten los que quedan sin ninguno; un rango invertido responde 422.
  - Ejemplo, hábitat lunar (34 % O₂, 56.5 kPa en `data/reference/conditions.json`): `GET /experiments?min_o2_percent=30&max_pressure_kpa=70.3` devuelve PSI-159 (45 puntos) y PSI-20 (13 puntos a 34 % y 56.5 kPa, presión supuesta según su objetivo 1); con `exclude_assumed=true` queda solo PSI-159. En las llamas inversas de PSI-159, `o2_percent` es la corriente que sale del quemador, no el aire de la cámara.
- `GET /coverage`: cobertura del mapa y brechas frente a condiciones de misión

## Búsqueda (RAG)

Requiere `VOYAGE_API_KEY` en `.env` (modelo `voyage-4`, 1024 dimensiones; configurable con `EMBEDDING_MODEL`).

```bash
.venv/bin/atlas-index            # trocea data/ (experimentos, search/sources.json, CSV crudos), embebe y guarda en pgvector
# primera corrida: 89 new, 0 unchanged, 0 removed; la segunda: 0 new, 89 unchanged, 0 removed
curl -X POST localhost:8000/search -H 'content-type: application/json' \
  -d '{"query": "smoke point in microgravity", "k": 5}'
```

- `atlas-index` es idempotente: cada chunk se identifica por el hash de su contenido, solo se embeben los nuevos y se borran los que ya no existen. Volver a ejecutarlo tras agregar archivos a `data/` es seguro; una segunda corrida seguida embebe 0.
- `POST /search` devuelve `[{experiment_id, source_file, section, content, score, rerank_score}]` (`k` entre 1 y 20, por defecto 5). Responde 503 si falta la clave.
- Reranking: se traen `RERANK_CANDIDATES` candidatos (30 por defecto) por similitud coseno y Voyage (`RERANK_MODEL`, `rerank-2.5` por defecto) los reordena; se devuelven los `k` mejores con su `rerank_score`. `"rerank": false` en el cuerpo lo desactiva (orden por coseno, `rerank_score` nulo). Si falta la clave o el reranker falla, se responde igual con el orden por coseno. `search_documents(..., reranker=None, candidates=30)` ofrece lo mismo en proceso.
- Sin método de pago, Voyage limita a 3 RPM y 10K TPM: el indexado espera y reintenta solo, así que la primera corrida puede tardar unos minutos.

## Mapa de cobertura y brechas

`GET /coverage` resume cómo cubren los puntos de PSI el espacio O₂ × presión × gravedad y qué condiciones de misión no tienen evidencia. Filtro opcional: `?material_class=polymer`.

- `regimes`: una entrada por régimen de gravedad (`microgravity` < 0.01 g, `lunar` < 0.25 g, `martian` < 0.6 g, `normal`), siempre las cuatro aunque estén vacías. Cada celda es de 5 % de O₂ × 10 kPa y trae conteos por resultado y por `point_type` (`test`/`limit`), `experiment_ids`, `needs_review_count` y puntos con O₂ o presión `assumed`. El régimen sale de `gravity_g`, no de la etiqueta `gravity_environment`.
- `reference_conditions`: cada condición de [`data/reference/conditions.json`](data/reference/conditions.json) con sus fuentes y la evidencia cercana (±3 % de O₂ y ±10 kPa, en cualquier gravedad), cuántos puntos están en la gravedad de la condición y cuántos son medidos. `gap` es `true` con un `gap_reason`: `no_points`, `no_matching_gravity` (hay puntos cercanos, pero solo en otra gravedad) u `only_assumed_conditions`.
- `totals`: puntos, experimentos, resultados, `needs_review` y valores asumidos.
- Las constantes (tamaño de celda, tolerancias, umbrales de gravedad) viven en `src/atlas/coverage/domain/coverage.py`.

`data/reference/conditions.json` (gravedad lunar y marciana, atmósfera de exploración de NASA, traje EVA, cabina de la ISS) cita una fuente con URL para cada valor numérico y se valida con Pydantic al responder. Para agregar una condición, copia una existente y cita la fuente; no se aceptan valores sin ella.

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
| `coverage` | 1 | Mapa de cobertura y brechas (`GET /coverage`) con condiciones de referencia de misión |
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
