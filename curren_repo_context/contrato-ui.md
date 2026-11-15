# Contrato de UI (`UIPayload`)

- **Fuente de verdad:** `src/atlas/agents/domain/ui.py`.
- **JSON Schema generado:** `data/schema/ui.schema.json`.
- **Estado:** borrador hasta el congelamiento H2; cualquier cambio debe acordarse con el front (rol 5).

```jsonc
{
  "summary": "1-2 frases en español",
  "components": [ /* 1 a 6 componentes; se distinguen por "type" */ ]
}
```

En el evento `ui` el backend agrega `ms`, el tiempo total en milisegundos.

## Componentes

| `type` | Campos | Uso |
| --- | --- | --- |
| `text` | `body` | Explicación en texto |
| `table` | `title`, `columns: string[]`, `rows: (string\|number\|boolean\|null)[][]` | Filas de una consulta del analista |
| `gap_map` | `title`, `experiment_ids: "PSI-n"[]` (vacío = todos), `gravity_environment` (`microgravity`\|`lunar`\|`martian`\|`partial`\|`normal`\|null), `note` (string\|null) | Resaltar experimentos en el mapa de huecos |
| `citations` | `items: [{experiment_id, source_file, section \| null, quote (≤600)}]` (al menos uno) | Fragmentos literales de los documentos PSI |
| `notice` | `level: "info"\|"warning"`, `message` | Avisos: un agente falló o los datos son `assumed` |

Todos los objetos tienen `additionalProperties: false`.

## Reglas fijas (`ui_rules.build_rules_ui`)

Se usan con `COMPOSITOR_MODE=rules`, con `AGENTS_MOCK=1` y como respaldo cuando el compositor falla.

| Tipo de consulta | Primer componente | Después |
| --- | --- | --- |
| `huecos` | `gap_map` con los `experiment_id` de la última tabla | `text` y `table` |
| `comparar` | `text` de los agentes | `table` y `citations` |
| `evidencia` | `citations` | `text` y `table` |
| `general` | `text` | `table` y `citations` |

Al final van los `notice` de los agentes que fallaron. Si no hay contenido, se agrega un `text` que pide reformular la pregunta.

## Ejemplo (`AGENTS_MOCK=1`, "Compara PMMA y algodón", recortado)

```json
{
  "summary": "Comparación de los ensayos registrados en el Atlas.",
  "components": [
    {"type": "text", "body": "[mock] 22 grupos de ensayos calculados desde data/experiments."},
    {"type": "table", "title": "Ensayos consultados",
     "columns": ["experiment_id", "gravity_environment", "outcome", "ensayos", "experimentos",
                 "spread_rate_min_mm_s", "spread_rate_max_mm_s"],
     "rows": [["PSI-100", "microgravity", "complete_burn", 1, "PSI-100", null, null]]},
    {"type": "citations", "items": [{"experiment_id": "PSI-100", "source_file": "...", "section": "summary", "quote": "..."}]}
  ],
  "ms": 3
}
```
