# Flujo de `/query`

El orquestador es **código Python** (`agents/application/run_query.py`), no un LLM, y no usa subagentes del SDK. Cada agente es un `ClaudeSDKClient` independiente con sus propias `ClaudeAgentOptions`.

```
pregunta
  │
  ├─ caché en archivo ── acierto ──► status{cache} ► ui
  │
  ▼
status{clasificando}
1. Clasificador (Haiku, max_turns=1, json_schema)        límite 4 s
   falla o tarda → {tipo: general, necesita_datos: true, necesita_fuentes: true}
  │
status{consultando_datos} si necesita_datos · status{buscando_fuentes} si necesita_fuentes
2. asyncio.gather(
     analista     (filtros en Python)       wait_for 12 s
     investigador (RAG con citas)           wait_for 12 s
   )  un fallo o tiempo agotado → {"error": "..."}; el otro sigue
  │
status{componiendo}
3. Compositor (json_schema = UIPayload)                  límite 20 s por intento
   salida → validación Pydantic directa (sin otro LLM)
   inválida → 1 reintento con el error en el prompt
   inválida otra vez, tiempo agotado o error → reglas fijas (tipo → componente)
  │
ui{summary, components, ms}
```

- Si algo inesperado rompe el flujo, se emite un solo `error{message}` genérico; el detalle va al log.
- Solo se guardan en caché las respuestas armadas por el compositor LLM sin errores de agentes.

## Recortes (sin cambiar código)

| Recorte | Variable | Efecto |
| --- | --- | --- |
| 1 | `COMPOSITOR_MODE=rules` | Sin LLM compositor: la UI sale de `ui_rules.build_rules_ui` |
| 2 | `INVESTIGADOR_MODE=direct` | Sin LLM investigador: los fragmentos de la búsqueda vectorial pasan directo como citas |
| — | `AGENTS_MOCK=1` | Sin Claude, Voyage ni Postgres: agentes deterministas sobre `data/experiments` y compositor por reglas |

## Tiempos

Peor caso sin caché ≈ 4 s + 12 s + 2 × 20 s. El `ms` del evento `ui` mide el total del lado del servidor. Los límites están en `Timeouts` (`run_query.py`).
