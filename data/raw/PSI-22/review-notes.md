# PSI-22 (ACME E-FIELD Flames): notas de revisión cruzada

Revisado contra `PSI-22_Experimental table_ACME E-FIELD Flames.csv` y la página de la investigación (API `geode-py/ws/repo/investigations/PSI-22`). Título, DOI, área, fechas e investigador principal coinciden con PSI.

## Cambios

- **Un punto por concentración de combustible.** `material` usaba la etiqueta de la botella, aunque varios días solo se quemó una mezcla diluida: el día 18130 decía `100% CH4` y solo se probó 70 %, y el día 18290 decía `100% C2H4` y solo se probó 80 %. Ahora hay un punto por día y concentración (`18078-70`): 20 → 28 puntos.
- **Día 18319 duplicado.** El CSV repite ese día de forma idéntica (filas 25–28 y 29–32). Se cuenta una vez y se anota.
- **O₂ en el quemador coflow.** La página de PSI dice que el coflow es aire sintético, así que el 21 % de esas pruebas pasa a `derived`. En el quemador de chorro de gas sigue `assumed`. La presión no aparece en ninguna fuente y sigue `assumed` (101.3 kPa).
- `platform` incluye ACME, como en PSI (`experimentHardware`).

## Pendiente para el equipo

- **Criterio de inclusión.** Según `docs/data-extraction.md`, una investigación entra al mapa si quema un material; E-FIELD estudia la forma y el hollín de llamas de gas. Además, PSI aclara en sus impactos que no se hizo para aplicaciones espaciales. Conviene decidir si pasa a `data/search/sources.json` como `search_only`.
- **Gravedad parcial.** Todas las pruebas son en microgravedad. El campo eléctrico sustituye a la flotación en el experimento, pero no hay datos a 1/6 g; no debe marcarse como `lunar` ni `partial`.
