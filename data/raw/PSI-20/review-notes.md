# PSI-20 (ACME BRE): notas de revisión cruzada

Revisado contra `PSI-20_Experimental table_ACME BRE.csv` y la página de la investigación (API `geode-py/ws/repo/investigations/PSI-20`). Título, DOI, área, fechas e investigador principal coinciden con PSI.

## Cambios

- **Un punto por nivel de O₂.** Cada fila del CSV es un día de pruebas con varios niveles de O₂ (`21; 26.5; 40`). La extracción tomaba el punto medio (30.5 %), un nivel que nunca se ensayó. Ahora hay un punto por día y nivel (`BRE-2019-02-08-O2-26.5`): 18 filas → 43 puntos. `o2_status` es `reported`; las dos erratas (`3400%`, `2100%`) siguen como `derived`.
- **Presión según el objetivo 1 de PSI.** El objetivo 1 empareja tres atmósferas de NASA: 14.7 psia con 21 %, 10.2 psia con 26.5 % y 8.2 psia con 34 % de O₂. Los puntos de 26.5 % quedan en 70.3 kPa y los de 34 % en 56.5 kPa, la atmósfera del hábitat lunar. Los de 25 % y 40 % no tienen pareja y siguen en 101.3 kPa. Toda presión sigue como `assumed`, porque la tabla no la da por prueba.
- **21 % de O₂ → `no_sustained_burn`.** Los impactos de investigación de PSI dicen que las llamas en una atmósfera normal de 21 % se autoextinguieron en poco tiempo. Confianza `low`.
- `platform` incluye ACME, como en PSI (`experimentHardware`). `100%C2H4` se normalizó a `100% C2H4`.

## Pendiente para el equipo

- `complete_burn` en un quemador de gas no significa que se consumió un material. PSI-159 usa `partial_burn` para la combustión sostenida. Conviene acordar una sola convención para llamas de gas.
- El conteo `Flames Ignited` es por día y no se puede repartir entre niveles de O₂.
