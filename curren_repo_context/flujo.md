# Flujo de `/query`

El orquestador es **código Python** (`agents/application/run_query.py`), no un LLM, y no usa subagentes del SDK. Cada agente es un `ClaudeSDKClient` independiente con sus propias `ClaudeAgentOptions`.

```
pregunta
  │
  ├─ caché en archivo ── acierto ──► status{cache} ► ui
  │
  ▼
status{clasificando}
1. Clasificador (Haiku, max_turns=1, json_schema)        límite 8 s
   falla o tarda → {tipo: general, necesita_datos: true, necesita_fuentes: true}
  │
status{consultando_datos} si necesita_datos · status{buscando_fuentes} si necesita_fuentes
2. asyncio.gather(
     analista     (filtros en Python)       wait_for 20 s
     investigador (RAG con citas)           wait_for 20 s
   )  un fallo o tiempo agotado → {"error": "..."}; el otro sigue
  │
status{componiendo}
3. Compositor (json_schema = UIPayload)                  límite 40 s por intento
   salida → validación Pydantic directa (sin otro LLM)
   inválida → 1 reintento con el error en el prompt
   inválida otra vez, tiempo agotado o error → reglas fijas (tipo → componente)
  │
4. Anclaje (grounding.py, sin LLM)
   tablas, citas, experiment_ids del gap_map y cifras del texto contra lo registrado
   si no queda nada fuera de avisos → reglas fijas (que también filtran las cifras)
  │
ui{summary, components, ms}
```

- Si algo inesperado rompe el flujo, se emite un solo `error{message}` genérico; el detalle va al log.
- Solo se guardan en caché las respuestas armadas por el compositor LLM sin errores de agentes. La caché separa los idiomas (`lang`).

## 4. Anclaje a los datos

El compositor es un LLM y Pydantic solo revisa la forma del JSON, así que `ground_ui` (`agents/domain/grounding.py`) compara su salida con los `consultas` y `fuentes` que registraron las herramientas:

| Componente | Regla | Si no cumple |
| --- | --- | --- |
| `table` | `columns` iguales a las de una consulta registrada y cada fila presente en esa consulta (puede ser un subconjunto) | Se reemplaza por la tabla registrada (la última con esas columnas, o la última en general); si no hay ninguna, se descarta |
| `citations` | `experiment_id` y `source_file` de un fragmento registrado, y `quote` es texto literal de él (sin distinguir mayúsculas ni espacios) | La cita se descarta; `section` siempre se copia del fragmento |
| `gap_map` | Cada `experiment_id` aparece en las filas o en los fragmentos | Se quita el id. Si no queda ninguno, se usan los experimentos de la tabla registrada; si tampoco hay, la lista queda vacía (el front muestra todos) y `note` dice "Sin experimentos concretos para resaltar." |
| `summary`, `text`, `notice`, `title`, `note` | Cada cifra aparece en los datos (celdas, `total`, `correlacion`, texto de los fragmentos) o en la pregunta; cada `PSI-…` y cada `[n]` existen en los datos | `summary` se cambia por el resumen fijo del tipo; `text` y `notice` se descartan; `title` pasa a "Ensayos consultados"; `note` se borra |

- Las cifras se comparan por valor: `12,5` = `12.5`, `1,283` = `1283`, `21` = `21.0`. No se aceptan redondeos ni cifras calculadas por la IA (si los datos dicen 12.27, "12.3" se descarta).
- Las reglas fijas aplican el mismo filtro a las respuestas del analista y del investigador antes de mostrarlas. Sus avisos de error los escribe el código, no la IA.
- Límite: una cantidad escrita con palabras ("doce ensayos") no se detecta; el prompt del compositor pide escribir las cifras con dígitos copiados de los datos.
- Si después del anclaje solo quedan avisos, la UI se arma con las reglas fijas.
- Cada corrección queda en el log como `composer output not grounded in the tools' data`.
- La salida corregida sigue siendo del compositor y se puede guardar en caché, porque ya solo contiene datos registrados.

## Recortes (sin cambiar código)

| Recorte | Variable | Efecto |
| --- | --- | --- |
| 1 | `COMPOSITOR_MODE=rules` | Sin LLM compositor: la UI sale de `ui_rules.build_rules_ui` |
| 2 | `INVESTIGADOR_MODE=direct` | Sin LLM investigador: los fragmentos de la búsqueda vectorial pasan directo como citas |
| — | `AGENTS_MOCK=1` | Sin Claude, Voyage ni Postgres: agentes deterministas sobre `data/experiments` y compositor por reglas |

## Tiempos

Peor caso sin caché ≈ 8 s + 20 s + 2 × 40 s. El `ms` del evento `ui` mide el total del lado del servidor. Los límites están en `Timeouts` (`run_query.py`).
