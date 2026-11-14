# PSI-106: SLICE — extracción pendiente

**Estado: pendiente, no apta para carga en el Atlas.** Por decisión del usuario, se conserva la extracción sin modificar el contrato del repositorio ni inventar resultados de combustión.

[`PSI-106.pending.json`](PSI-106.pending.json) utiliza los campos del contrato 1.0 como borrador, pero contiene `outcome: null` en sus 11 entradas. **No es un experimento válido bajo ese contrato.** Las entradas son resúmenes de sesiones, no corridas individuales; sus fechas son identificadores provisionales. El archivo permanece en `data/raw/PSI-106/`, fuera del directorio que carga el validador y la aplicación.

## Fuentes

Consulta del 14 de noviembre de 2026, [PSI-106](https://psi.nasa.gov/physci/repo/data/investigations/PSI-106), versión 3:

- `PSI-106_Experimental table_Slice.csv`: tabla original sin modificaciones, 734 bytes. SHA-256: `89ef980810ca6d9aa8be817b42e36cd2adff23f5e9058361b5a33d18b4363f4d`.
- `PSI-106_investigation.json`: selección de campos de la [API pública](https://psi.nasa.gov/geode-py/ws/repo/investigations/PSI-106). Conserva únicamente el nombre del investigador principal, sin datos de contacto; no es una copia íntegra de la respuesta.
- `structure-liftoff-in-combustion-experiment-slice.pdf`: [ficha técnica NASA](https://www.nasa.gov/wp-content/uploads/2025/07/structure-liftoff-in-combustion-experiment-slice.pdf), original de dos páginas, 82 627 bytes. SHA-256: `ddc56bd4a9bf46d582fd00e6aed4fbe7c362c1aa6e35a857925fdf7d5a7bc36a`. Describe objetivos y aparato; no es una bitácora de resultados por corrida.

La tabla se descargó mediante `/geode-py/ws/studies/PSI-106/download?file=PSI-106_Experimental%20table_Slice.csv&version=3&redirect=false`. No se guardan enlaces firmados temporales.

También se inspeccionó `PSI-106_metadata_PSI-174_SLICE.zip`: contiene `i_Investigation.txt` y `s_PSI-106.txt`. La tabla de muestras solo tiene las columnas `Source Name` y `Sample Name` y una fila de marcadores de posición, sin muestras científicas identificables. No permite recuperar corridas ni resultados; el ZIP no se incorpora como datos experimentales.

## Cobertura

El CSV tiene **12 filas de datos**. Se conservan **11 sesiones SLICE** en el borrador, con fecha y combustible, y se excluye la última sesión del borrador por estar rotulada explícitamente como SPICE. Se preserva la fila excluida en el CSV original.

| Línea CSV (encabezado = 1) | Sesión | Combustible reportado | Observación |
| --- | --- | --- | --- |
| 2 | 2012-FEB-09 | 100% CH4 | Sin corridas individuales |
| 3 | 2012-FEB-13 | 40% CH4, balance N2 | Incluye 2 calibraciones de pirometría y 2 de ventilador |
| 4 | 2012-FEB-17 | 70% CH4, balance N2 | Incluye 1 calibración de pirometría |
| 5 | 2012-FEB-20 | 20% C2H4, balance N2 | Sin corridas individuales |
| 6 | 2012-FEB-27 | 100% CH4 | Sin corridas individuales |
| 7 | 2012-MAR-01 | 40% CH4, balance N2 | Sin corridas individuales |
| 8 | 2012-MAR-05 | 70% CH4, balance N2 | La botella no se vació; no es una medida de combustión parcial |
| 9 | 2012-MAR-09 | 100% C2H6 | Posible discrepancia de combustible; fórmula conservada |
| 10 | 2012-MAR-12 | 100% CH4 | Sin corridas individuales |
| 11 | 2012-MAR-15 | 20% C2H4, balance N2 | Sin corridas individuales |
| 12 | 2012-MAR-19 | 70% CH4, balance N2 | Incluye 1 calibración de pirometría y 2 de ventilador |
| 13 | 2012-MAR-23 | El texto menciona 100% C3H8; la celda Fuel Type dice 100% C2H4 | Excluida del borrador: sesión rotulada SPICE |

Las calibraciones mencionadas dentro de sesiones no se convierten en registros. No se conoce cuántas corridas científicas hay dentro de cada sesión. La API describe 13 experimentos, mientras que el CSV enumera 12 sesiones: no se equiparan ambos conteos ni se crea una fila adicional.

## Campos e incertidumbres

- **Resultados:** ninguna fila indica si hubo ignición fallida, apagado temprano o combustión parcial/completa. La ficha describe llamas adheridas y levantadas, no un resultado de consumo de muestra compatible con los cuatro valores de `outcome`. Por eso se mantiene `null`.
- **Identificadores:** `test_id` contiene provisionalmente la fecha inicial de cada celda `Test Date`, sin la prosa o espacios adicionales. No es un ID de corrida publicado. Las celdas originales se conservan en `notes` y en el CSV.
- **Combustible:** se conserva la fórmula y el porcentaje reportados. Las fracciones de CH4/C2H4/N2 corresponden al combustible y no al porcentaje ambiental de oxígeno. `C2H6` de 2012-MAR-09 se mantiene, aunque la descripción general habla de metano y etileno; no se corrige sin una bitácora que lo respalde.
- **Oxígeno/presión:** 21% y 101.3 kPa se proponen como valores nominales de cabina ISS según `docs/data-extraction.md`, ambos `assumed`, nunca como mediciones de sesión.
- **Flujo:** no hay velocidades por corrida ni datos suficientes para clasificar dirección de propagación de llama. Ambos campos quedan `null`; no se asigna a cada sesión un rango general del aparato.
- **Geometría/resultados opcionales:** espesor, longitud quemada, tasa de propagación y referencia de combustión en 1 g quedan `null`. Diámetro de quemador no equivale a espesor de muestra; longitud de llama no equivale a longitud quemada.
- **Fechas y clasificación global:** las fechas de inicio/fin y la subárea están vacías en la API y se dejan `null`. No se sustituyen por la primera y última sesión. Título, DOI, plataforma e investigador principal se copian de la API; microgravedad orbital usa `1e-6 g` por convención del repositorio.

Todas las entradas quedan con `needs_review: true`, `confidence: "low"` y revisión global `draft`.

## Qué falta para incorporarlo

1. Obtener una bitácora que vincule cada sesión a sus corridas, IDs, combustible, velocidades y resultados.
2. Resolver la discrepancia C2H6/C2H4 y confirmar el alcance de la sesión SPICE del 23 de marzo.
3. Establecer con evidencia si los resultados de llamas de gas admiten alguno de los valores actuales de `outcome`. Si no, será necesaria una decisión explícita sobre el contrato; no basta con marcar una suposición como revisada.
4. Sustituir los resúmenes por corridas respaldadas, validar el JSON y entonces guardarlo como `data/experiments/PSI-106.json`.

El validador general debe continuar aprobando únicamente los experimentos ya incorporados. Una validación directa del borrador debe señalar 11 resultados ausentes; ese rechazo es intencional y evita presentar información desconocida como un resultado científico.

Comprobado: las 3 investigaciones existentes siguen siendo válidas y las 4 pruebas de contrato pasan. Se cotejaron las 11 sesiones con sus filas y combustibles originales, la exclusión de la fila SPICE, la conservación de C2H6 y los localizadores. La validación directa del borrador produjo exactamente 11 errores de `outcome`, uno por sesión, y ningún otro error estructural; esto no resuelve la falta de corridas individuales. El esquema y `data/experiments/` permanecen sin cambios.
