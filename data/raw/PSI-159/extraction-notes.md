# PSI-159: notas de extracción

Fuente: https://psi.nasa.gov/physci/repo/data/investigations/PSI-159

Se consultaron los metadatos de la API pública, versión 1, y se conservaron sin modificaciones las dos tablas experimentales originales, el informe final y el registro diario 21106. No se descargaron los archivos de imágenes y telemetría masiva.

## Cobertura

Las tablas contienen 333 filas con identificador de prueba: 179 normales y 154 inversas. El CSV inverso contiene además 861 filas vacías, que se ignoran.

El JSON incluye 326 pruebas: 173 normales y 153 inversas. Las siete filas restantes se conservan completas en `excluded-rows.json`, con su ubicación y motivo:

- `21106 F2`, `21106 F5`, `21106 H1` y `21106 H2`: no tienen duración ni terminación. `Hot ignition = No` no demuestra ausencia de una llama fría. F2 y F5 indican intentos de ignición fría directa. El informe final, sección 8.B.2 (pp. 31–32), describe esta dificultad; el registro diario acredita la adquisición de imágenes, pero no resuelve el resultado. No se inventa un valor obligatorio de `outcome`.
- `21125 A4` y `21125 H3`: fracción de combustible y flujo de hidrocarburo iguales a cero. Se excluyen como condiciones sin aporte de combustible, no como fallos de inflamabilidad de butano.
- `21209 A2`: prueba abortada. No se presenta como un ensayo de ignición completado.

## Unidades y significado de los campos

- Presión aproximada: bar × 100 → kPa, `pressure_status: derived`.
- Oxígeno: fracción molar × 100 → porcentaje, `o2_status: derived`. En llamas normales se usa el punto medio entre los valores antes y después; el intervalo conserva ambos extremos. Son dos observaciones temporales, no los extremos comprobados de una serie continua. Si coinciden, el intervalo queda en `null`.
- En llamas inversas, `o2_percent` representa la corriente oxidante que sale del quemador. La cámara contiene combustible y nitrógeno. No se debe interpretar ese porcentaje como oxígeno ambiental de la cámara ni comparar ambas configuraciones sin leer esta distinción.
- `material` normal utiliza la especie y la fracción real `Xf`; la etiqueta original `Fuel` puede referirse a la botella y se conserva en notas. En la configuración inversa se conserva la especie y se dejan las fracciones de combustible de la cámara antes/después en notas.
- `normal` e `inverse` describen la distribución de reactivos en llamas esféricas y no la gravedad ni propagación concurrente/opuesta. Se usa microgravedad orbital, `gravity_g = 1e-6`, y `flow_direction: null`.
- El flujo másico en mg/s no se convierte a velocidad en cm/s sin una base física suficiente. Se conserva en notas. Espesor, longitud quemada, tasa de propagación y referencia terrestre quedan en `null`.
- Los campos adicionales de las tablas (duración, terminación, TFP, Tad, Zst, temperaturas, color, indicadores de llama fría y comentarios) se conservan en notas y en los CSV originales. Una celda vacía de llama fría significa desconocido, no un resultado negativo.

## Interpretación provisional de resultados

El esquema del repositorio fue diseñado para muestras y no distingue llama caliente/fría ni tiene un resultado específico para combustión gaseosa sostenida. No se amplió el esquema.

- `no_ignition`: 54 filas con `Hot ignition = No/no` y duración cero, salvo las exclusiones anteriores.
- `no_sustained_burn`: 29 filas con `flash` o autoextinción en hasta 3 segundos. Este corte es una convención explícita de extracción y requiere revisión.
- `partial_burn`: 243 filas con combustión observada de mayor duración o terminada por corte de flujo. Es una clasificación provisional para ajustarse al contrato, no una fracción quemada medida. No se interpreta `FT` como consumo completo del combustible.
- `SE` indica autoextinción de la llama caliente; puede ocurrir combustión fría posteriormente. El indicador de llama fría y los comentarios se mantienen por separado en notas.

Todas las filas están marcadas `needs_review: true`; el registro queda como `draft`. Esta extracción no constituye una validación científica de la clasificación provisional de las llamas gaseosas.

## Discrepancias y fechas

- `21106 F4`: `Hot ignition = No`, pero duración de 22 s, terminación FT y comentario `hot flame`. Se conserva la evidencia de combustión, con confianza baja.
- `21242 P2`: la tabla dice que no hubo ignición, pero advierte pérdida de la mayoría de los datos del día. Se conserva ese resultado con confianza baja.
- Sesión `21291`: el CSV identifica butano; la cronología del informe final (p. 49) identifica propano. Se conserva el combustible del CSV y se marca confianza baja en las 12 pruebas de esa sesión.
- Las fechas de investigación están vacías en la API. `start_date` y `end_date` se obtienen de los prefijos YYDDD de las pruebas: 2021-03-29 a 2021-10-18, consistentes con la cronología del informe final (pp. 48–49). Representan la cobertura de las sesiones tabuladas, no toda la preparación/operación del hardware. Algunas sesiones atraviesan medianoche; la fecha decodificada no garantiza la fecha UTC de cada corrida.

El informe final identifica al investigador principal como Peter B. Sunderland y confirma que se ensayó etano en lugar del pentano inicialmente propuesto.
