# Agentes

Todos comparten estas opciones (`agents/application/options.py::_base`):

- `tools=[]`: sin herramientas integradas (Bash, Read, Write, etc.).
- `setting_sources=[]`: no lee `~/.claude` ni `.claude/` del proyecto.
- `strict_mcp_config=True`: solo los servidores MCP que pasamos.
- `allowed_tools`: únicamente las herramientas MCP propias del agente.
- `CLAUDE_CODE_OAUTH_TOKEN`: viaja solo en el `env` del subproceso.
- `effort`: viene de `AGENT_EFFORT`.

Los nombres se verificaron contra `claude_agent_sdk/types.py` de `claude-agent-sdk` 0.2.182.

| Agente | Nombre en el equipo | Modelo | Herramientas | `max_turns` | Salida |
| --- | --- | --- | --- | --- | --- |
| Clasificador | — | `CLASSIFIER_MODEL` (Haiku) | ninguna | 1 | `Classification` por `output_format` json_schema |
| Analista | "el que consulta" | `AGENT_MODEL` | `mcp__analista__consultar_ensayos` | 6 | `{"respuesta", "consultas": [{filtros, columns, rows, total, truncated}]}` |
| Investigador | "el que responde" | `AGENT_MODEL` | `mcp__investigador__buscar_documentos` | 4 | `{"respuesta", "fuentes": [{ref, experiment_id, source_file, section, content, score, rerank_score}]}` |
| Compositor | "el front" | `AGENT_MODEL` | ninguna | 3 | `UIPayload` por `output_format` json_schema |

`consultas` y `fuentes` no las escribe el LLM: las registran las propias herramientas mientras el agente trabaja. El compositor las reescribe en el `UIPayload`, y después `agents/domain/grounding.py` comprueba esa salida contra lo registrado (ver [`flujo.md`](flujo.md#4-anclaje-a-los-datos)). Así, las filas de las tablas, las citas y los experimentos del mapa siempre son datos reales. El texto libre lo redacta la IA, pero cualquier cifra, id `PSI-…` o `[n]` que contenga también tiene que estar en los datos.

Los prompts están en `agents/application/prompts/*.md`.

## Herramienta del analista: `consultar_ensayos`

El analista **no escribe SQL ni llama a la API**: carga los experimentos en Python y los filtra con parámetros estructurados.

1. **Carga, solo desde Postgres.** La primera llamada de cada ejecución trae los experimentos con `experiment_source.load_from_postgres`, que usa `PostgresExperimentRepository.list_all()` (el mismo repositorio de `GET /experiments`) con 2 s de espera por la conexión. Las llamadas siguientes reutilizan la lista.
   - Si Postgres falla, el agente recibe el error como texto y no hay respaldo con archivos.
   - Si la tabla está vacía, recibe "falta ejecutar atlas-load".
   - Solo `AGENTS_MOCK=1` lee `data/experiments/*.json`.
2. **Validación.** Los argumentos se validan con `FiltroEnsayos` (`agents/domain/ensayos.py`), que usa `extra="forbid"`. Los valores permitidos son los `Literal` del contrato de experimentos.
3. **Filtros:**
   - `experiment_ids`, `point_type` (`test` o `limit`, contrato 1.1), `limit_type`, `material` (texto contenido, sin distinguir mayúsculas), `material_class`, `gravity_environment`, `outcome`, `flow_direction`;
   - rangos `o2_min`/`o2_max` y `presion_min_kpa`/`presion_max_kpa`;
   - `solo_revisados`.
4. **Agrupación.** `agrupar_por` acepta hasta 3 campos y devuelve `ensayos` y `experimentos` por grupo.
   - **Métricas:** `metricas` acepta hasta 4 campos numéricos y agrega `<campo>_promedio`, `<campo>_min` y `<campo>_max`, ignorando los vacíos. Sin `agrupar_por`, da una fila con el resumen total.
   - **Correlación:** `correlacion` recibe dos campos numéricos y agrega `{"x", "y", "n", "pearson"}` al resultado. Con `n < 3`, o si un campo no varía, `pearson` es `null` y viene una `nota` explicándolo.
5. **Salida.** Se devuelven como máximo 50 filas, junto con `total` y `truncated`.
6. **Errores.** Los parámetros inválidos y los fallos de carga vuelven como texto con `is_error: true`.

El esquema de la herramienta es `FiltroEnsayos.model_json_schema()`, así que si el contrato de experimentos agrega valores, la herramienta los acepta sin cambios.

## Herramienta del investigador: `buscar_documentos`

- Recibe `consulta` y `k` (de 1 a 8).
- **Búsqueda.** `agents/infrastructure/document_search.py` llama a `search_documents` del rol 2 con `PostgresChunkRepository`, el embedder y el reranker de Voyage que crea `main.py`, y `RERANK_CANDIDATES`:
  - con reranker, trae `RERANK_CANDIDATES` candidatos por similitud coseno y devuelve los `k` mejores, ordenados por el reranker;
  - sin reranker, o si el reranker falla, devuelve el orden por coseno y `rerank_score` queda en `null`.
- **Resultados.** Cada fragmento trae `experiment_id`, `source_file`, `section`, `content`, `score` y `rerank_score`.
  - Como `search_documents` no devuelve un id, la herramienta numera cada fragmento con un `ref` (1, 2, …) estable durante toda la ejecución, sin duplicados.
  - El agente cita con `[ref]`. Al agente le llega cada fragmento recortado a 1200 caracteres.
- **Sin clave.** Si falta `VOYAGE_API_KEY`, la búsqueda falla y el agente recibe el error como texto.
- **Modo `direct`.** Con `INVESTIGADOR_MODE=direct`, se llama a la búsqueda con `k=5` sin LLM, y los fragmentos también reciben su `ref`.

## Pruebas

`tests/test_query.py` usa `FakeAgents`, `RecordingRunner` y `AGENTS_MOCK`, así que nunca llama a Claude, Voyage ni Postgres.
