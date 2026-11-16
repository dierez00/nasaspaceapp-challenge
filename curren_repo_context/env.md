# Variables de entorno

Se leen en `src/atlas/shared/config.py` (`Settings`, desde `.env` o el entorno; los nombres no distinguen mayúsculas). La plantilla está en `.env.example`.

| Variable | Por defecto | Uso |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://atlas:atlas@localhost:5433/atlas` | Postgres con pgvector |
| `DATA_DIR` | `data` | Raíz de `experiments/` (también la usa `AGENTS_MOCK`) |
| `CORS_ORIGINS` | `["http://localhost:3000"]` | Orígenes del front |
| `CLAUDE_CODE_OAUTH_TOKEN` | — | Credencial de Claude; solo pasa al `env` del subproceso del SDK |
| `VOYAGE_API_KEY` | — | Embeddings y reranker (búsqueda del rol 2, usada por el investigador) |
| `EMBEDDING_MODEL` | `voyage-4` | Rol 2: modelo de embeddings, el mismo para indexar y para consultar |
| `EMBEDDING_DIMENSION` | `1024` | Rol 2 |
| `RERANK_MODEL` | `rerank-2.5` | Rol 2: reranker de Voyage |
| `RERANK_CANDIDATES` | `30` | Rol 2: candidatos por coseno antes de reordenar |
| `AGENTS_MOCK` | `0` | `1`: `/query` sin Claude, Voyage ni Postgres (agentes deterministas, compositor por reglas, sin caché) |
| `COMPOSITOR_MODE` | `agent` | `rules`: recorte 1, la UI sale de reglas fijas |
| `INVESTIGADOR_MODE` | `agent` | `direct`: recorte 2, la búsqueda vectorial va directo a citas |
| `LLM_PROVIDER` | `claude` | `azure_openai`: los agentes corren en un despliegue GPT de Azure OpenAI en vez de Claude |
| `AZURE_OPENAI_ENDPOINT` | — | Con `azure_openai`: URL del recurso, por ejemplo `https://<recurso>.openai.azure.com` (obligatoria) |
| `AZURE_OPENAI_API_KEY` | — | Con `azure_openai`: clave del recurso (obligatoria) |
| `AZURE_OPENAI_API_VERSION` | — | Con `azure_openai`: versión de la API de Azure OpenAI, sin valor por defecto (obligatoria) |
| `AZURE_OPENAI_REASONING_EFFORT` | — | `low`, `medium` o `high`; solo se envía si se define, y solo lo aceptan los despliegues de razonamiento |
| `CLASSIFIER_MODEL` | `claude-haiku-5-5` | Modelo del clasificador; con `azure_openai`, nombre del despliegue |
| `AGENT_MODEL` | `claude-opus-5-5` | Modelo del analista, el investigador y el compositor; con `azure_openai`, nombre del despliegue |
| `AGENT_EFFORT` | `low` | `low`, `medium` o `high`, para todos los agentes (solo Claude) |
| `QUERY_CACHE_ENABLED` | `1` | Caché de respuestas en archivo |
| `QUERY_CACHE_FILE` | `data/query_cache.json` | Ruta de la caché; súbelo a Git para llevar al demo respuestas ya generadas |

Con `LLM_PROVIDER=azure_openai` la API se niega a arrancar si falta el endpoint, la clave o la versión, o si `CLASSIFIER_MODEL` / `AGENT_MODEL` siguen con nombres de Claude (el error nombra las variables, nunca sus valores). La caché de respuestas no distingue proveedor: vacía `QUERY_CACHE_FILE` o desactívala (`QUERY_CACHE_ENABLED=0`) al cambiar de proveedor si no quieres servir respuestas del anterior.
