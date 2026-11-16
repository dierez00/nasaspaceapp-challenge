# Endpoints y eventos SSE

| Método | Ruta | Cuerpo / parámetros | Para |
| --- | --- | --- | --- |
| `POST` | `/query` | `{"q": "...", "lang": "es" \| "en"}` (`q` de 1-500 caracteres, no solo espacios; `lang` opcional, `es` por defecto) | `fetch` con lectura del stream |
| `GET` | `/query?q=...&lang=en` | mismas reglas | `EventSource` |

- **Errores de entrada:** se responden con HTTP 422 antes de abrir el stream.
- **Respuesta:** `text/event-stream` con `Cache-Control: no-cache` y `X-Accel-Buffering: no`.
- **Formato:** cada evento es `event: <nombre>\ndata: <json>\n\n`.
- **Idioma (`lang`):** todo el texto que lee el usuario sale en ese idioma: lo que escribe el compositor, el brief y la UI por reglas, los títulos y avisos de respaldo, y el `error` genérico. Las tablas, las citas literales y los ids no se traducen. Con `en`, el analista y el investigador reciben una nota de idioma al final de la pregunta (`atlas/agents/domain/lang.py`) y el prompt del compositor lleva una sección "Idioma de la respuesta".

## Eventos

| Evento | `data` | Cuándo |
| --- | --- | --- |
| `status` | `{"step": "cache" \| "clasificando" \| "consultando_datos" \| "buscando_fuentes" \| "componiendo"}` | Al empezar cada paso. `consultando_datos` y `buscando_fuentes` solo aparecen si el clasificador los pidió y corren en paralelo. |
| `ui` | `{"summary", "components", "ms"}` y `brief_version` (`1`) si hay un componente `brief` | Una vez, al final, si todo salió bien. Ver [`contrato-ui.md`](contrato-ui.md). |
| `error` | `{"message"}` | Una vez, en lugar de `ui`, si el flujo se rompe. Mensaje genérico; el detalle queda en el log. |

El stream termina después de `ui` o de `error`. Con `EventSource`, cierra la conexión al recibir cualquiera de los dos para que el navegador no reconecte.

## Ejemplo con `EventSource`

```js
const es = new EventSource(`${API}/query?q=${encodeURIComponent(q)}`);
es.addEventListener("status", (e) => setStep(JSON.parse(e.data).step));
es.addEventListener("ui", (e) => { render(JSON.parse(e.data)); es.close(); });
es.addEventListener("error", (e) => { if (e.data) showError(JSON.parse(e.data).message); es.close(); });
```

`EventSource` también dispara `error` cuando falla la red, y en ese caso no trae `data`.

## Probar sin tokens

```bash
AGENTS_MOCK=1 .venv/bin/uvicorn atlas.main:app --reload
curl -N -X POST localhost:8000/query -H 'content-type: application/json' -d '{"q":"¿Qué huecos hay en gravedad lunar?"}'
```
