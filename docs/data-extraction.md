# Extracción de investigaciones PSI

Guía para capturar investigaciones de [NASA PSI](https://psi.nasa.gov/physci/repo/) en el formato común del Atlas. El ejemplo completo es [`data/experiments/PSI-99.json`](../data/experiments/PSI-99.json).

## ¿Va al mapa o solo a la búsqueda?

Lista completa de investigaciones de combustión: <https://psi.nasa.gov/physci/repo/search?q=combustion&data_source=psi&data_type=investigation>.

Una investigación entra al mapa (`data/experiments/`) si cumple las tres condiciones:

1. Quema un **material** (sólido, tela, película o líquido) y no solo estudia la forma o el hollín de una llama.
2. Reporta, o permite citar, el **O₂** y la **presión** de cada condición.
3. Dice si el material **ardió o no**, o da un **límite** (extinción, *blowoff*, O₂ mínimo).

Si no las cumple, regístrala en `data/search/sources.json` con `"scope": "search_only"` y la razón. Ejemplo: PSI-107 (SPICE, llamas de gas y *smoke point*).

**Cuando la tabla de PSI no trae resultados** (como en BASS y BASS-II), búscalos en `Reports`, `Science Documents` o `Presentations`. Captura como `limit` lo que los autores reportan, con página o lámina, y no deduzcas resultados prueba por prueba.

## Reglas del equipo

1. **Un archivo por investigación:** `data/experiments/PSI-<n>.json`. Como nadie edita el mismo archivo, no hay conflictos de merge.
2. **Asignación por lotes:** cada persona toma IDs distintos de la lista priorizada y los anota en el tablero antes de empezar.
3. **Copia de la fuente:** la tabla experimental original se guarda en `data/raw/PSI-<n>/`, sin cambios.
4. **Validación antes de cada commit:** `.venv/bin/atlas-validate` debe pasar (también regenera `data/schema/experiment.schema.json`).
5. **Revisión cruzada:** otra persona revisa el archivo, corrige lo marcado con `needs_review: true` y cambia `review.status` a `"reviewed"`.
6. **Commit:** `feat(data): add PSI-<n> <acrónimo>`.

## Formato

La fuente de verdad es el modelo Pydantic [`experiment.py`](../src/atlas/experiments/domain/experiment.py). El front consume el JSON Schema exportado en [`data/schema/experiment.schema.json`](../data/schema/experiment.schema.json). Un registro equivale a una investigación, y cada elemento de `tests[]` es **un punto en el mapa**: una muestra o una corrida con condiciones propias.

| Campo de `tests[]` | Tipo | Regla |
| --- | --- | --- |
| `test_id` | string | ID tal como aparece en la fuente (`"2-1"`); para límites, un ID corto propio |
| `point_type` | enum | `test` = una prueba tal como se reporta; `limit` = límite de inflamabilidad que los autores derivan de varias pruebas |
| `limit_type` | enum \| null | Solo para `limit`: `radiative_extinction`, `blowoff`, `quenching`, `minimum_oxygen` |
| `derived_from` | string[] | Pruebas de origen de un límite (p. ej. `["B1","B3"]`); vacío para `test` |
| `material` / `material_class` | string / enum | `polymer`, `fabric`, `composite`, `metal`, `liquid`, `gas`, `other` |
| `thickness_mm` | number \| null | Convertir a mm |
| `o2_percent` | number | Fracción molar en %; si hay rango, usar el punto medio y llenar `o2_percent_range` |
| `pressure_kpa` | number | 1 atm = 101.3 kPa; 1 psi = 6.895 kPa |
| `o2_status`, `pressure_status` | enum | `reported` (dicho en la fuente), `derived` (calculado), `assumed` (no está en la fuente) |
| `gravity_environment` | enum | `microgravity`, `lunar`, `martian`, `partial`, `normal` |
| `gravity_g` | number | µg en órbita = `1e-6`, Luna = `0.166`, Marte = `0.38`, Tierra = `1` |
| `flow_velocity_cm_s`, `flow_direction` | number / enum | `concurrent`, `opposed`, `quiescent`, `mixed` |
| `outcome` | enum | `no_ignition`, `no_sustained_burn`, `partial_burn`, `complete_burn` |
| `burn_length_cm`, `spread_rate_mm_s` | number \| null | Solo si la fuente lo reporta |
| `normal_gravity_reference` | objeto \| null | Resultado en 1 g, si la investigación lo compara |
| `source` | `{ file, locator }` | Archivo y fila, página o sección exacta |
| `confidence` / `needs_review` | enum / bool | `needs_review: true` si interpretaste, asumiste o corregiste algo |

**Valores faltantes:** usa `null`, nunca inventes. Si el mapa necesita un dato que no aparece en la fuente (`o2_percent`, `pressure_kpa`), usa el valor nominal del ambiente, márcalo como `assumed` y explica en `notes` de dónde sale. El validador rechaza un valor `assumed` sin `needs_review: true`.

## Cómo descargar los archivos de PSI sin navegador

La página de cada investigación es una app de JavaScript, pero detrás tiene una API pública:

```bash
curl -s https://psi.nasa.gov/geode-py/ws/repo/investigations/PSI-99
```

La respuesta trae título, fechas, plataforma, objetivos y el nombre de la tabla experimental (`experimentalTable[].file_name`).

```bash
curl -s "https://psi.nasa.gov/geode-py/ws/studies/PSI-99/download?file=<nombre-url-encoded>&version=1&redirect=false"
```

Esta llamada devuelve una URL firmada de S3; descárgala con `curl -o`. Si `version=1` no funciona, prueba la versión que indica la página.

No descargues la carpeta `Raw Data`: son GB de imágenes. Basta con la tabla experimental, el Readme y los documentos de `Science Documents`.

## Prompt para el agente extractor

Pega este prompt en Claude junto con la tabla experimental (CSV), el JSON de la investigación y, si hace falta, el Readme. Revisa la salida antes de guardarla.

````text
Eres un asistente de extracción de datos de combustión de NASA PSI. Convierte la
investigación adjunta en UN objeto JSON que cumpla exactamente este contrato
(schema_version "1.1"). Usa como referencia de estilo el ejemplo PSI-99 adjunto.

Reglas:
1. Un elemento en `tests[]` por cada muestra o corrida con condiciones propias
   (point_type "test"). Si la fuente no da el resultado de cada corrida pero sí
   límites de inflamabilidad (velocidad de extinción, blowoff, O2 mínimo), captura
   cada límite como point_type "limit" con su limit_type y las corridas de origen
   en derived_from. Ignora filas que no son pruebas (calibración, visualización).
2. Copia los valores de la fuente; no inventes. Si falta un valor opcional, usa null.
3. Normaliza unidades: espesor en mm, presión en kPa (1 atm = 101.3, 1 psi = 6.895),
   O2 en % molar, velocidad de flujo en cm/s, tasa de propagación en mm/s.
4. `o2_status` y `pressure_status`: "reported" si la fuente lo dice, "derived" si lo
   calculaste, "assumed" si no aparece (usa el nominal del ambiente: cabina ISS
   21% O2 y 101.3 kPa) y explícalo en `notes`.
5. `gravity_g`: microgravedad orbital = 1e-6, Luna = 0.166, Marte = 0.38, Tierra = 1.
6. `outcome`: no_ignition | no_sustained_burn (encendió y se apagó casi de inmediato)
   | partial_burn | complete_burn. Si la fuente compara contra 1 g, llena
   `normal_gravity_reference`.
7. Cada test lleva `source.file` (nombre exacto del archivo) y `source.locator`
   (fila, tabla, página o sección).
8. `needs_review: true` y `confidence` "medium" o "low" en cualquier valor que
   hayas interpretado: celdas vacías, typos como "037 mm", rangos o supuestos.
   Explica cada interpretación en `notes`.
9. `review`: { "status": "draft", "extracted_by": "claude", "reviewed_by": null }.
10. No incluyas correos, teléfonos ni datos personales; del contacto solo va el nombre
    del investigador principal.

Responde solo con el JSON, sin texto alrededor. Después, en un bloque aparte,
enumera los campos marcados con needs_review y por qué.

Contrato (campos y enums):
<pega aquí la tabla "Formato" de docs/data-extraction.md>

Ejemplo:
<pega aquí data/experiments/PSI-99.json>

Fuente:
<pega aquí el CSV de la tabla experimental y el JSON de /geode-py/ws/repo/investigations/PSI-<n>>
````
