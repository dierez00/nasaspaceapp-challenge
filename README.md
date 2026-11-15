# Atlas del Fuego Lunar · Backend

API del **Atlas del Fuego Lunar** (NASA Space Apps Challenge 2026). Convierte los experimentos de combustión del repositorio **NASA Physical Sciences Informatics (PSI)** en datos consultables, los hace buscables con citas y responde preguntas en lenguaje natural con un sistema multiagente que no puede inventar cifras.

La presentación completa del proyecto y la interfaz (laboratorio 3D, mapa de evidencias y copiloto) están en la rama [`main`](../../tree/main).

## Qué hace

| Capacidad | Endpoint | ¿Usa IA? |
| --- | --- | --- |
| Catálogo de ensayos con filtros de O₂ y presión | `GET /experiments` | No |
| Cobertura de la evidencia y huecos frente a condiciones de misión | `GET /coverage` | No |
| Búsqueda semántica con citas | `POST /search` | Embeddings y reranking |
| Respuestas a preguntas, en streaming | `POST /query` | Agentes Claude |
| Estado del servicio y de la base | `GET /health` | No |

Documentación interactiva en `/docs` (OpenAPI).

## De los documentos de NASA a una respuesta verificable

1. **Extracción.** Las tablas experimentales y reportes de 13 investigaciones de PSI (ACME, FLEX, CFI, SAME, BASS, SAFFIRE…) se pasaron con Claude a un contrato JSON común, validado con Pydantic y revisado por el equipo. Resultado: **1,115 observaciones**, cada una con material, O₂, presión, gravedad, resultado y la ubicación exacta en su fuente. Las tablas originales se guardan sin cambios en `data/raw/`.
2. **Carga.** `atlas-load` valida el lote completo y lo guarda en PostgreSQL; si un archivo es inválido, no carga nada.
3. **Indexación.** `atlas-index` trocea los reportes en **1,283 fragmentos**, los vectoriza con Voyage AI (`voyage-4`) y los guarda en pgvector. Es incremental: solo vectoriza lo nuevo.
4. **Consulta.** Un orquestador en Python coordina cuatro agentes:

   | Agente | Rol |
   | --- | --- |
   | Clasificador (Claude Haiku) | Entiende el tipo de pregunta y decide si hacen falta datos, fuentes o ambos |
   | Analista (Claude) | Elige filtros; el cálculo sobre los ensayos lo hace Python |
   | Investigador (Claude + Voyage) | Busca fragmentos, los reordena con `rerank-2.5` y cita experimento, archivo y sección |
   | Compositor (Claude) | Arma la respuesta que dibuja la interfaz |

   Analista e investigador trabajan en paralelo, y el progreso se transmite por SSE.
5. **Verificación sin IA.** Antes de responder, cada tabla, cita, experimento y cifra se compara con lo que realmente devolvieron las herramientas. Lo que no coincide se descarta, y si los agentes fallan o tardan, la respuesta se arma con reglas fijas.

**En una frase:** la IA entiende la pregunta, decide qué consultar y lo explica; los números y las fuentes siempre salen de los datos de NASA PSI.

*Fuente de las cifras: los conteos salen de `data/experiments/` y de `build_chunks(data/)`; el detalle está en [`curren_repo_context/uso-ia.md`](curren_repo_context/uso-ia.md).*

## Hallazgo principal

Las 1,115 observaciones se hicieron en microgravedad (ISS y naves Cygnus); **ninguna en gravedad lunar**. `GET /coverage` compara la evidencia con condiciones de referencia de misión, cada una con su fuente en [`data/reference/conditions.json`](data/reference/conditions.json) (hábitat lunar y marciano, traje EVA lunar, cabina de la ISS), y marca como hueco las condiciones que solo tienen ensayos en otra gravedad.

## Arquitectura

Cada módulo de `src/atlas/` es un área del producto con capas `domain`, `application`, `infrastructure` y `api` (Clean Architecture):

| Módulo | Responsabilidad |
| --- | --- |
| `experiments` | Contrato de datos, validación, carga y catálogo |
| `coverage` | Cobertura de la evidencia y huecos frente a condiciones de misión |
| `search` | Ingesta, embeddings, pgvector, reranking y citas |
| `agents` | Orquestador, agentes y verificación de la respuesta |
| `query` | Endpoint `/query` con streaming SSE y caché |
| `shared` | Configuración y conexión a la base |

**Tecnologías:** Python 3.12, FastAPI, Pydantic, PostgreSQL 17 + pgvector, Claude Agent SDK, Voyage AI, Pytest y Docker.

## Probarlo localmente

```bash
python3 -m venv .venv
.venv/bin/pip install -e '.[dev]'
cp .env.example .env
docker compose up -d db
.venv/bin/atlas-load
AGENTS_MOCK=1 .venv/bin/uvicorn atlas.main:app --reload
```

Con `AGENTS_MOCK=1`, `/query` responde sin claves de IA. Abre <http://localhost:8000/docs>.

## Documentación

- [Referencia técnica: endpoints, búsqueda, pruebas y operación](docs/referencia.md)
- [Despliegue (Railway, base con pgvector y Vercel)](docs/deploy.md)
- [Formato y reglas de extracción de datos PSI](docs/data-extraction.md)
- [Flujo de los agentes, contrato de UI y eventos SSE](curren_repo_context/README.md)
