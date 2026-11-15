# Supuestos y pendientes

## Supuestos de la implementación actual

1. **Modelos.** El clasificador usa `claude-haiku-5-5`. El analista, el investigador y el compositor usan `claude-opus-5-5` con `effort=low`. Todos se pueden cambiar en `.env`.
2. **Tiempo de los agentes.** Los 12 s incluyen el arranque del subproceso del CLI del SDK, que puede tardar 1-2 s, y las llamadas a herramientas. Si el analista se pasa seguido, prueba con `AGENT_MODEL=claude-sonnet-5-5` o sube el límite en `Timeouts`.
3. **Clasificador con `max_turns=1` y `output_format`.** Si el CLI necesita más de un turno para la salida estructurada, termina en error y se usa el valor por defecto (correr ambos agentes). Falta verificarlo con una llamada real.
4. **Compositor:**
   - límite de 20 s por intento, que no venía en la especificación;
   - un timeout o un error del SDK va directo a reglas, sin reintento; solo un JSON inválido se reintenta.
5. **Datos del analista.** Se cargan en Python solo desde Postgres (`PostgresExperimentRepository.list_all()`, la columna `record`). Sin Postgres o sin `atlas-load`, el analista responde con error y el compositor lo muestra como aviso. Con 13 experimentos y unos 1100 puntos no hay problema de memoria.
6. **Cálculos del analista.** Puede filtrar, agrupar, sacar promedio, mínimo y máximo, y calcular la correlación de Pearson entre dos campos. Otros cálculos, como regresiones o percentiles, habría que agregarlos a `FiltroEnsayos`.
7. **Búsqueda.** El investigador usa `search_documents` del rol 2 con reranker cuando hay `VOYAGE_API_KEY`. Como los resultados no traen id, la herramienta les asigna un `ref` para las citas.
8. **Caché:**
   - la clave es la pregunta normalizada (minúsculas, sin acentos ni puntuación);
   - no expira;
   - solo guarda respuestas del compositor LLM sin errores de agentes.
9. **Contrato de UI.** Los componentes `text`, `table`, `gap_map`, `citations` y `notice` son una propuesta, no el contrato congelado.
10. **Evento `error`.** Comparte nombre con el evento `error` nativo de `EventSource`. El front distingue los dos por la presencia de `data`.

## Lo que falta de otras personas

| De | Qué | Bloquea |
| --- | --- | --- |
| Rol 2 (search) | ~~Búsqueda y reranker~~: ya integrados (`search_documents` con `rerank_score`). Falta correr `atlas-index` en la máquina del demo | Investigador real |
| Rol 5 (front) | Congelar `UIPayload`. El front (rama `main`) ya lo consume con un traductor; cambiar un componente o campo rompe ese traductor | Compositor y reglas |
| Equipo | Dar `CLAUDE_CODE_OAUTH_TOKEN` en la máquina del demo para usar `ATLAS_QUERY_MODE=remote`; sin token, el front responde con `guided` | Copiloto con agentes en vivo |

## Cómo lo consume el front (rama `main`)

El navegador nunca llama a FastAPI: habla con rutas de Next.js, que llaman al backend en el servidor (`ATLAS_API_URL`). Detalle en `docs/atlas-frontend.md` de `main`, sección "Conectar FastAPI".

- **`GET /experiments`** (`ATLAS_DATA_MODE=remote`): cada `ExperimentTest` se vuelve un punto del mapa con id `PSI-n/<test_id>`, presión en psi y la fuente. Los puntos fuera del dominio del mapa (0–16 psi, 18–50 % O₂) se omiten: hoy 407 de 1,115.
- **`POST /query`** (`ATLAS_QUERY_MODE=remote`): se envía `{"q": pregunta + punto del mapa}` (máximo 500 caracteres). No se usa `EventSource`; se lee el stream con `fetch` y se traduce:
  - `status.step`: `clasificando` y `consultando_datos` → analista; `buscando_fuentes` → física; `componiendo` → sintetizador. `cache` no se muestra.
  - `ui`: `summary` y cada `text` van al texto. `table` → tarjeta con lista (máximo 8 filas). `gap_map` → límites de gravedad y hasta 3 tarjetas de experimento. `citations` → lista de fuentes. `notice` → tarjeta de aviso. Un componente desconocido se ignora.
  - `error` → error del copiloto. Si el stream termina sin `ui` ni `error`, el front muestra un error.
- Si cambian los nombres de eventos, de pasos o de componentes, hay que actualizar `src/modules/copilot/infra/backend-query.ts` en `main`.
| Equipo | Lista de preguntas del demo para precalentar `data/query_cache.json` | Demo sin depender de la latencia |
| Equipo | `CLAUDE_CODE_OAUTH_TOKEN` y `VOYAGE_API_KEY` en el `.env` de quien haga la demo, y Postgres con `atlas-load` y `atlas-index` ya ejecutados | Modo real |
| Rol 1 (experiments) | Avisar si cambian los campos de `ExperimentTest` (ya se incluyen `point_type` y `limit_type` del contrato 1.1): el prompt del analista los lista a mano | Calidad de las consultas |
| Rol 3 | Agente extractor (offline): no se tocó | — |

## Sin verificar todavía

Ninguna prueba llama a Claude, Voyage ni Postgres real. Antes del demo:

1. Correr una consulta real con el token.
2. Revisar la latencia de punta a punta.
3. Revisar los filtros que elige el analista.
