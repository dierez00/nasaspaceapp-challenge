# Uso de la IA en el Atlas

El orquestador no es una IA: es código Python (`agents/application/run_query.py`). El analista tampoco escribe SQL: llama a una herramienta con filtros estructurados que se calculan en Python.

## Cuando alguien pregunta en `/query`

| Paso | ¿IA? | Qué hace |
| --- | --- | --- |
| Caché | No | Si la pregunta ya se respondió, devuelve la respuesta guardada |
| 1. Clasificador | Claude Haiku | Decide el tipo (huecos, comparar, evidencia o general) y si hacen falta datos, fuentes o ambos. Si tarda más de 8 s, se asume que hace falta todo |
| 2a. Analista | Claude | Elige los filtros (O₂, presión, material, resultado…) y llama a `consultar_ensayos`. El cálculo lo hace Python; Claude solo elige los parámetros y redacta el resumen |
| 2b. Investigador | Claude + Voyage | Busca fragmentos con `search_documents`, la misma búsqueda de `/search` (embeddings y reranker), y redacta la respuesta citando experimento, archivo y sección. Con `INVESTIGADOR_MODE=direct` no usa Claude |
| 3. Compositor | Claude | Convierte los resultados en el JSON que dibuja el front. Si falla dos veces o tarda más de 30 s, el JSON se arma con reglas fijas, sin IA. Con `COMPOSITOR_MODE=rules` no usa Claude |
| 4. Anclaje | No | Comprueba tablas, citas, experimentos del mapa y cifras del texto contra lo que registraron las herramientas (`agents/domain/grounding.py`) |

## Antes de las preguntas

- **Voyage `voyage-4`:** convierte los 1,283 fragmentos de los documentos en vectores (`atlas-index`; la cifra sale de `build_chunks(data/)`).
- **Voyage `rerank-2.5`:** reordena los resultados de cada búsqueda.

## Por qué los datos son confiables

Límite conocido: una cantidad escrita con palabras ("doce ensayos") no se detecta; el prompt pide escribir las cifras con dígitos.


- Las filas de las tablas y las citas las registran las herramientas mientras el agente trabaja ([`agentes.md`](agentes.md)).
- El compositor (Claude) las acomoda en el JSON, pero el anclaje las compara con lo registrado:
  - una fila que no esté en los datos hace que se use la tabla registrada;
  - una cita que no sea texto literal de un fragmento se descarta;
  - un experimento que no aparezca en los datos se quita del mapa;
  - un texto con una cifra, un `PSI-…` o un `[n]` que no esté en los datos (o en la pregunta) se descarta, y el resumen se cambia por uno fijo.
- Claude puede resumir mal un texto, pero no puede meter una fila de datos, una cita ni una cifra inventada.
- `/coverage` y los filtros de `/experiments` no usan IA.

**En una frase:** la IA entiende la pregunta, decide qué consultar y lo explica; los números y las fuentes siempre salen de los datos de NASA PSI.
