# Contexto vigente del repo

Estado actual del backend del Atlas del Fuego Lunar. **Actualiza estos archivos en el mismo commit que cambie lo que describen.**

| Archivo | Qué contiene |
| --- | --- |
| [`uso-ia.md`](uso-ia.md) | Dónde se usa IA y dónde no, explicado para el equipo |
| [`flujo.md`](flujo.md) | Cómo se responde una pregunta en `/query`: pasos, tiempos límite y recortes |
| [`agentes.md`](agentes.md) | Los cuatro agentes: rol, modelo, herramientas, entrada y salida |
| [`contrato-ui.md`](contrato-ui.md) | JSON de UI que recibe el front (`UIPayload`) y reglas fijas por tipo |
| [`eventos-sse.md`](eventos-sse.md) | Endpoints, eventos SSE y ejemplos para `fetch` y `EventSource` |
| [`env.md`](env.md) | Variables de entorno |
| [`pendientes.md`](pendientes.md) | Supuestos, lo que falta de otros roles y cómo consume el front `/experiments` y `/query` |

## Mapa del código

```
src/atlas/agents/
  domain/          classification.py · ensayos.py (filtros del analista) · ui.py (contrato)
                   ui_rules.py · grounding.py (anclaje de la UI a los datos) · events.py
  application/     run_query.py (orquestador) · options.py (una función por agente)
                   claude_agents.py · mock_agents.py · prompts/*.md
  infrastructure/  claude_runner.py (ClaudeSDKClient) · experiment_source.py (Postgres; JSON solo en mock)
                   document_search.py (adaptador a search_documents del rol 2)
                   analyst_tools.py · researcher_tools.py (herramientas MCP en proceso)
src/atlas/query/
  api/router.py               POST /query y GET /query?q= (SSE)
  application/answer.py       caché → orquestador → eventos
  infrastructure/file_cache.py
src/atlas/search/          rol 2: search_documents, embedder y reranker de Voyage, POST /search
data/schema/ui.schema.json  JSON Schema de UIPayload, generado
tests/test_query.py         todo con mocks
```

## Regenerar el esquema de UI

```bash
.venv/bin/python -c "import json; from atlas.agents.domain.ui import UIPayload; \
open('data/schema/ui.schema.json','w').write(json.dumps(UIPayload.model_json_schema(), indent=2, ensure_ascii=False)+'\n')"
```

`test_committed_ui_schema_matches_the_contract` falla si se te olvida.
