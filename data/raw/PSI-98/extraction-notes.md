# PSI-98: notas de extracción

Fuente: https://psi.nasa.gov/physci/repo/data/investigations/PSI-98

Se conserva la tabla CSV original sin modificaciones, junto con el Readme, el protocolo de operaciones y el informe de resultados de NASA NTRS `20170008805.pdf`.

- Se incluyen S1 y S2; se excluyen F1C1/F1C2 y F2C1/F2C2 porque son visualizaciones de flujo. El Readme identifica F1 como preflujo y F2 como posflujo, aunque el CSV etiqueta ambos como pretest.
- S1 y S2 corresponden a dos encendidos sucesivos de la misma tela, según el informe de resultados (pp. 14 y 16). Los identificadores equivalentes de su Tabla I (p. 29) son 1-1 y 1-2.
- Se usa 0.37 mm de espesor, explícito en la Tabla I del informe, corrigiendo la unidad cm del CSV. El informe y el Readme también aclaran la orientación: 94 cm de largo y 40.6 cm de ancho.
- Las longitudes quemadas son aproximadas (84 y 10 cm), como indica la Tabla I. S1 es combustión parcial del original; S2 es combustión completa del remanente. La referencia terrestre de S2 (~0 cm) no distingue entre falta de ignición y extinción inmediata; su clasificación requiere revisión.
- El O2 es derivado conforme a la nota i de la Tabla I. Para S1 se usa el punto medio del rango; para S2 se conserva el valor aproximado. La presión de 101.3 kPa es un supuesto nominal, no una medición.
- La API versión 4 contiene fechas de investigación 2001-03-02 y 2008-02-28 que no corresponden a esta operación de SAFFIRE-I. Se usan 2016-06-14 (encendido) y 2016-06-19 (apagado y fin de operaciones), documentados por NASA en sus actualizaciones de misión: https://www.nasa.gov/centers-and-facilities/glenn/nasa-ignites-fire-experiment-aboard-space-cargo-ship/ . Estas fechas describen las operaciones del experimento, no el lanzamiento ni la reentrada.
- Ambas corridas quedan con `needs_review: true`, confianza media y revisión en borrador por las correcciones e interpretaciones anteriores.
