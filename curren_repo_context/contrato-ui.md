# Contrato de UI (`UIPayload`)

- **Fuente de verdad:** `src/atlas/agents/domain/ui.py`.
- **JSON Schema generado:** `data/schema/ui.schema.json`.
- **Estado:** borrador hasta el congelamiento H2; cualquier cambio debe acordarse con el front (rol 5).

```jsonc
{
  "summary": "1-2 frases en el idioma de `lang` (inglés en el front por defecto)",
  "components": [ /* 1 a 7 componentes; se distinguen por "type" */ ]
}
```

En el evento `ui` el backend agrega `ms`, el tiempo total en milisegundos, y `brief_version` (hoy `1`) cuando hay un componente `brief`: el front lo usa para detectar el resumen de evidencia.

## Componentes

| `type` | Campos | Uso |
| --- | --- | --- |
| `text` | `body` | Explicación en texto |
| `table` | `title`, `columns: string[]`, `rows: (string\|number\|boolean\|null)[][]` | Filas de una consulta del analista |
| `gap_map` | `title`, `experiment_ids: "PSI-n"[]` (vacío = todos), `gravity_environment` (`microgravity`\|`lunar`\|`martian`\|`partial`\|`normal`\|null), `note` (string\|null) | Resaltar experimentos en el mapa de huecos |
| `citations` | `items: [{experiment_id, source_file, section \| null, quote (≤600)}]` (al menos uno) | Fragmentos literales de los documentos PSI |
| `notice` | `level: "info"\|"warning"`, `message` | Avisos sobre los datos (nunca sobre quién falló) o datos `assumed` |
| `brief` | Ver abajo | Resumen de evidencia: veredicto, evidencia, hueco, siguientes pasos y una lectura por audiencia |

Todos los objetos tienen `additionalProperties: false`.

## `brief` (versión 1)

Aditivo: `summary` y los demás componentes siguen igual. Siempre es el primer componente (el compositor lo escribe; si lo omite, el anclaje agrega el de reglas). Como máximo uno por respuesta.

```jsonc
{
  "type": "brief",
  "verdict": "Una frase segura de lo que muestran los datos",
  "evidence": null | {
    "title": "...", "columns": ["..."], "rows": [[...]],   // idénticas a una consulta registrada
    "experiment_ids": ["PSI-n"]                            // para resaltar en el mapa
  },
  "gap": null | {
    "description": "Qué falta, en una frase",
    "pressure_kpa_min": number|null, "pressure_kpa_max": number|null,
    "o2_percent_min": number|null,   "o2_percent_max": number|null,
    "gravity": "microgravity"|"lunar"|"martian"|"normal"|null
  },
  "next_steps": [                                          // 0 a 3
    {"kind": "simulate"|"propose_experiment"|"explore_map", "label": "...",
     "pressure_kpa": number|null, "o2_percent": number|null,
     "gravity": "microgravity"|"lunar"|"martian"|"normal"|null, "material": string|null}
  ],
  "lenses": {"student": "...", "teacher": "...", "researcher": "..."}   // el mismo hecho con tres énfasis
}
```

Garantías del anclaje (`grounding._ground_brief`):

- `evidence` es una consulta registrada del analista (si no coincide se reemplaza por la registrada; sin consultas, `null`). Los `experiment_ids` existen en los datos.
- `gap`: las cotas y `gravity` se calculan en Python (`agents/domain/brief.py`, `compute_gap`) a partir de los filtros de la última consulta o de la pregunta ("más de 30 % de O₂"); nunca las pone el LLM. Hay hueco si la consulta no encontró ensayos o si las filas agrupadas no incluyen gravedad lunar o marciana. Sin base para calcularlo, `gap` es `null`. Las cotas entran como cifras permitidas en los textos.
- `next_steps`: cifras (`pressure_kpa`, `o2_percent`) solo si están en los datos, la pregunta o el hueco; si no, `null`. `material` solo si aparece en los datos o la pregunta.
- `verdict` y cada texto de `lenses` con cifras que no están en los datos se reemplazan por el texto de reglas; el resto del brief se conserva.
- El `description` del hueco que nombra una gravedad distinta de la calculada se reemplaza por el texto de reglas; un `summary` casi igual al `verdict` se sustituye por el resumen genérico del tipo.
- Los valores técnicos (`ambient`, `partial_burn`, `oxidizer_stream`, `microgravity`...) se cambian por términos en español en el texto (`agents/domain/labels.py`, `ENUM_LABELS`); nunca en tablas ni columnas.
- El veredicto de reglas cita el hallazgo con cifras registradas, p. ej. "Para PMMA hay 12 ensayos en microgravedad y 5 en gravedad normal."
- No hay objetos abiertos: el esquema del compositor (`UIPayload.model_json_schema()` sin `discriminator`) lo acepta en modo estricto.

Tono: el texto habla de los datos ("No hay ensayos con esas condiciones"), nunca de agentes, búsquedas, herramientas ni reintentos.

## Reglas fijas (`ui_rules.build_rules_ui`)

Se usan con `COMPOSITOR_MODE=rules`, con `AGENTS_MOCK=1` y como respaldo cuando el compositor falla o cuando nada de su salida pasa el anclaje a los datos (`agents/domain/grounding.py`, ver [`flujo.md`](flujo.md#4-anclaje-a-los-datos)).

| Tipo de consulta | Primer componente | Después |
| --- | --- | --- |
| `huecos` | `brief`, luego `gap_map` con los `experiment_id` de la última tabla | `text` y `table` |
| `comparar` | `brief`, luego `text` de los agentes | `table` y `citations` |
| `evidencia` | `brief`, luego `citations` | `text` y `table` |
| `general` | `brief`, luego `text` | `table` y `citations` |

El `brief` de reglas sale de las consultas registradas (veredicto con el total, la última tabla como evidencia, hueco calculado, siguientes pasos y lecturas por audiencia). Al final van los `notice` de lo que no se pudo consultar, redactados sobre los datos ("No se pudieron consultar los ensayos del Atlas en este momento"), sin el detalle de la excepción. Si no hay contenido, se agrega un `text` que dice que no hay ensayos ni informes para esa pregunta.

## Ejemplo (`AGENTS_MOCK=1`, "Compara PMMA y algodón", recortado)

```json
{
  "summary": "Las diferencias entre los ensayos del Atlas se ven en la tabla.",
  "brief_version": 1,
  "components": [
    {"type": "brief", "verdict": "Los datos del Atlas muestran 22 registros con esas condiciones.",
     "evidence": {"title": "Ensayos consultados", "columns": ["experiment_id", "..."], "rows": [["PSI-100", "..."]],
                  "experiment_ids": ["PSI-100"]},
     "gap": {"description": "No hay ensayos en gravedad lunar con estas condiciones.", "pressure_kpa_min": null,
             "pressure_kpa_max": null, "o2_percent_min": null, "o2_percent_max": null, "gravity": "lunar"},
     "next_steps": [{"kind": "simulate", "label": "Simular este escenario en el laboratorio", "pressure_kpa": null,
                     "o2_percent": null, "gravity": "lunar", "material": null}],
     "lenses": {"student": "...", "teacher": "...", "researcher": "..."}},
    {"type": "text", "body": "El Atlas registra 22 grupos de ensayos."},
    {"type": "table", "title": "Ensayos consultados",
     "columns": ["experiment_id", "gravity_environment", "outcome", "ensayos", "experimentos",
                 "spread_rate_min_mm_s", "spread_rate_max_mm_s"],
     "rows": [["PSI-100", "microgravity", "complete_burn", 1, "PSI-100", null, null]]},
    {"type": "citations", "items": [{"experiment_id": "PSI-100", "source_file": "...", "section": "summary", "quote": "..."}]}
  ],
  "ms": 3
}
```
