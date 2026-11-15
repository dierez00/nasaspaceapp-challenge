# PSI-159 (ACME CFI-G): notas de revisión cruzada

Revisado con un script contra las dos tablas experimentales y la página de la investigación (API `geode-py/ws/repo/investigations/PSI-159`).

## Verificación

- Las 333 filas con ID de prueba están en el JSON (326) o en `excluded-rows.json` (7); ninguna falta ni sobra.
- En los 326 puntos coinciden con el CSV: especie de combustible, presión (bar × 100), O₂ (punto medio antes/después en llamas normales, `XO2` del quemador en inversas) y el intervalo `o2_percent_range`.
- Título, DOI, área, investigador principal y hardware (`ACME, Combustion Integrated Rack (CIR)`) coinciden con PSI. PSI no publica fechas; las de `start_date`/`end_date` salen de los prefijos YYDDD, como explican las notas de extracción.

## Cambios

- `21265 A4`: `partial_burn` → `no_sustained_burn`, confianza `low`. El comentario de la fuente es `Flash` (autoextinción a los 5 s) y las notas de extracción asignan `no_sustained_burn` a los *flash*. Fue el único resultado que no seguía la regla.

## Pendiente para el equipo

- En las llamas inversas (153 puntos), `o2_percent` es la corriente que sale del quemador, no el aire de la cámara. El contrato no distingue ambos casos; un filtro por O₂ los mezcla.
- La sesión 21291 (12 pruebas) sigue con la discrepancia butano/propano descrita en las notas de extracción.
