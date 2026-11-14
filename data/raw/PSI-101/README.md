# PSI-101: SAME-R

Extracción del 14 de noviembre de 2026 de [NASA PSI](https://psi.nasa.gov/physci/repo/data/investigations/PSI-101), versión 4. Registro normalizado: [`../../experiments/PSI-101.json`](../../experiments/PSI-101.json). Se conserva el contrato `schema_version: "1.0"`.

## Fuentes

- `PSI-101_Experimental table_SAME-R.csv`: descarga original sin modificaciones, 5 674 bytes; 109 filas de datos. SHA-256: `87164b7dc9168a4273c159f7a9f23699afbd06ad97b77974377e79b9bf8a3bef`.
- `PSI-101_Reports_SAME-R_Final Report.pdf`: informe original sin modificaciones, 4 578 437 bytes. SHA-256: `65381e2715eb7379113dd1b9c550baaa5fa5a247dba00419123143aa98ef80d6`.
- `PSI-101_investigation.json`: selección de campos de la [API pública](https://psi.nasa.gov/geode-py/ws/repo/investigations/PSI-101), con nombre del investigador principal y sin datos de contacto. No es una copia íntegra de la respuesta.

Los dos archivos originales se obtuvieron con `/geode-py/ws/studies/PSI-101/download?file=<nombre-codificado>&version=4&redirect=false`. Los enlaces firmados temporales no se guardan. Las páginas citadas abajo se cuentan desde la primera página del PDF.

## Cobertura y discrepancias

El JSON contiene **109 IDs únicos: 67 corridas primarias (48–114) y 42 observaciones secundarias de envejecimiento con sufijo `a`**. Estas últimas conservan sus condiciones propias y no representan nuevos intentos de ignición. El informe, sección Flight Operation, página 3, explica este conteo. El resumen del informe y la API hablan de 66 puntos completados; esta discrepancia se conserva para revisión, sin afirmar que los 67 tuvieron éxito.

| Decisión | Evidencia |
| --- | --- |
| Conservar la corrida 57 como Lampwick y excluir su duplicado Teflon | CSV líneas 57 y 75 (encabezado = línea 1). Apéndice A, página 32: corrida 57, muestra L14, identificador 10L, material Lampwick. |
| Incorporar la corrida 112, omitida en el CSV | Apéndice A, página 49: Kapton, identificador 65K, fecha 9/9/2010, 2 cm/s, Rt/R0 1.480, calentamiento 60 s, envejecimiento primario 11 s, mezcla 8 s, envejecimiento neto 22 s. |
| Conservar las observaciones `a` | Apéndice A y Flight Operation, página 3; sus tiempos de envejecimiento son diferentes. No se completan por arrastre las celdas vacías. |

La conciliación es: 109 filas CSV − 1 duplicado erróneo + 1 corrida del informe = 109 registros. Por material: Kapton 30, Silicone 22, Lampwick 20, Pyrell 20 y Teflon 17.

## Campos pendientes de revisión

Todos los registros quedan con `needs_review: true`, `confidence: "low"` y revisión global `draft`:

- **`outcome`**: el contrato obliga a seleccionar un resultado de combustión. Se usa `no_ignition` como interpretación del protocolo de calentamiento por debajo del punto de ignición, documentado en el resumen del Apéndice F, página 72. **No es un ensayo de ignición fallida ni evidencia de resistencia al fuego.** Debe revisarse esta equivalencia antes de usar estos puntos para inferir límites de inflamabilidad. No se cambia el esquema del repositorio.
- **Oxígeno y presión**: 21% y 101.3 kPa, ambos `assumed`, usando el ambiente nominal de cabina ISS indicado en `docs/data-extraction.md`. No son mediciones de estas corridas.
- **Flujo**: velocidad de entrada copiada sin conversión, ya expresada en cm/s. `quiescent` solo para cero flujo durante calentamiento; `null` para la dirección en las demás corridas, porque no hay propagación de llama concurrente u opuesta documentada.
- **Valores ausentes**: espesor, longitud quemada, velocidad de propagación y comparación de combustión en 1 g quedan `null`. Las comparaciones terrestres del informe son de aerosoles. No se confunde duración del calentamiento con duración de combustión ni Rt/R0 con temperatura.
- **57 y 112**: revisar las correcciones respaldadas por el informe y la diferencia entre 66 puntos completados y 67 corridas listadas.

Los campos originales sin equivalente en el contrato (fecha de corrida, descripción, Rt/R0, duración y tiempos de envejecimiento/mezcla) se conservan en `notes`. Las fechas globales son las de la ficha PSI (2010-07-01 a 2010-09-30); el periodo efectivo de pruebas que describe el informe es 2010-07-16 a 2010-09-09. La microgravedad orbital se representa como `1e-6 g` por convención del repositorio.

## Validación

Desde la raíz del repositorio, ejecutar `atlas-validate`. Alternativa equivalente sin instalar el CLI en PowerShell:

```powershell
$env:PYTHONPATH = 'src'
python -m atlas.experiments.application.validate
python -m pytest tests/test_experiments.py
```

Comprobado: validador con 2/2 investigaciones válidas y 4 pruebas de contrato aprobadas. También se cotejaron todos los localizadores del CSV, IDs, materiales y velocidades, los 109 IDs únicos y los tamaños y hashes de las fuentes originales. En este entorno se ejecutó pytest con `--basetemp=C:/Code/nasaApp/psi101-pytest-temp` para usar una carpeta temporal con permisos de escritura.
