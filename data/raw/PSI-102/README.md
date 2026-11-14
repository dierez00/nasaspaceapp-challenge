# PSI-102: SAME

Extracción del 14 de noviembre de 2026 de [NASA PSI](https://psi.nasa.gov/physci/repo/data/investigations/PSI-102), versión 4. Registro: [`../../experiments/PSI-102.json`](../../experiments/PSI-102.json), con el contrato existente `schema_version: "1.0"`.

## Fuentes conservadas

- `PSI-102_Experimental table_SAME.csv`: original sin modificaciones, 331 bytes. SHA-256: `268d1e121d2f211b124407dd32b9475617bd269ede2c2d1749441da3e949a2af`.
- `PSI-102_Reports_SAME_Final Science Report.pdf`: original sin modificaciones, 3 712 845 bytes. SHA-256: `af91c96d22d93bbefbc0f2c5e1cc06e24813f532e5379b3fec9f121cccb22193`.
- `PSI-102_investigation.json`: selección de campos de la [API pública](https://psi.nasa.gov/geode-py/ws/repo/investigations/PSI-102), con nombre del investigador principal y sin datos de contacto. No es la respuesta íntegra de la API.

Los originales se descargaron mediante `/geode-py/ws/studies/PSI-102/download?file=<nombre-codificado>&version=4&redirect=false`. Se comprobó que coinciden byte por byte con las copias locales de la tabla y del informe `SAME Final Science report  03 18 10 with papers attached.pdf`. No se conservan enlaces firmados temporales.

## Elección de registros y cobertura

El **Apéndice A, página impresa A-1 (página 33 del PDF)** enumera las 47 corridas realizadas, con `Test Number` de 1 a 47. Se utiliza esa bitácora como fuente de cada registro, con un localizador exacto; se revisó visualmente la página completa. Las cuatro filas sin número de prueba sobre acoplar, desacoplar o girar el carrusel se excluyen.

Son **30 pruebas iniciales de muestras y 17 recalentamientos**. Los recalentamientos tienen ID propio en la fuente y no representan muestras físicas adicionales. Los registros se distribuyen así:

| Material | Iniciales | Recalentamientos | Total |
| --- | ---: | ---: | ---: |
| Silicone | 6 | 0 | 6 |
| Teflon | 6 | 1 | 7 |
| Kapton | 6 | 0 | 6 |
| Lampwick | 6 | 0 | 6 |
| Dibutyl Phthalate (DBP) | 6 | 16 | 22 |
| Total | 30 | 17 | 47 |

DBP es el líquido de referencia retenido en una mecha de algodón (resumen, página 3 del PDF). Se clasifica como `liquid` y se conservan sus pruebas de vuelo numeradas. La calibración instrumental terrestre descrita en la sección 3.C no se incorpora como corridas.

### Relación con el CSV

El CSV contiene ocho filas de resumen. Las primeras cuatro especifican condiciones de Teflon; las filas 5–8 remiten a esas mismas condiciones para Kapton, Silicone Rubber, Lampwick y Dibutyl Phthalate:

| Sample # del CSV | Aire (cm/s) | Pérdida de masa (mg/min) | Envejecimiento (min) |
| --- | ---: | ---: | ---: |
| 1 | 5 | 2 | 1 |
| 2 | 5 | 1 | 1 |
| 3 | 5 | 2 | 20 |
| 4 | 10 | 2 | 1 |

No existe una correspondencia explícita entre esos `Sample #` y los `Test Number` del informe: por ejemplo, el número 1 del CSV es Teflon, pero la corrida 1 de la bitácora es Silicone. Por ello no se convierten las condiciones del resumen en corridas adicionales, ni se asignan sus velocidades, tasas de pérdida de masa o tiempos a los 47 registros. La fuente original permanece íntegra para una futura conciliación.

## Interpretaciones y revisión pendiente

Todos los registros tienen `needs_review: true`, `confidence: "low"` y revisión global `draft`.

- **Resultado:** el resumen del informe, página 3 del PDF, describe calentamiento por debajo del punto de ignición. Se usa `no_ignition` como interpretación compatible con el contrato actual. **No significa fallo de una prueba de ignición ni resistencia al fuego**; son mediciones de aerosoles previos a un incendio. Esta equivalencia necesita revisión antes de utilizar los puntos para inferir límites de inflamabilidad.
- **Oxígeno y presión:** 21% y 101.3 kPa, ambos `assumed`, según el ambiente nominal ISS indicado en `docs/data-extraction.md`; no son mediciones de estas corridas.
- **Velocidad de flujo:** solo se asigna donde la bitácora la reporta: corridas 33 y 34, 2 cm/s; corrida 37, 8 cm/s. Los otros 44 valores quedan `null`. La dirección respecto de propagación de llama queda `null` en todos los casos.
- **Otros campos:** espesor, longitud quemada y tasa de propagación quedan `null`. El diámetro aproximado del cilindro de material descrito en el aparato no equivale a un espesor medido por corrida. Las comparaciones terrestres de aerosoles no proporcionan una referencia de combustión en 1 g; `normal_gravity_reference` queda `null`.
- **Corrida 8:** el procedimiento automático se interrumpió por Rt/Ro alto y se terminó manualmente. Se conserva la corrida y la observación; no se interpreta la interrupción como resultado de combustión.
- **Corrida 33:** la fuente indica que faltó la primera parte del calentamiento; se conserva esta limitación.
- **Corrida 44:** envejecimiento de 30 minutos (1800 s) y calentamiento de 75 s, guardados en `notes`; no son duración de combustión.
- **Tiempos y errores de escritura:** `Record Time` se conserva como texto de la fuente, sin calcular duraciones. Se preservan `39:99` en la corrida 5 y `<6.:39` en la 18. `Intiial` en la 47 se interpreta como `Initial` únicamente para el conteo de cobertura y se documenta.

El título y las fechas globales se copian de la ficha PSI: `Smoke and Aerosol Measurement Experiment`, 2001-03-02 a 2008-02-28. El informe usa `Smoke Aerosol Measurement Experiment` y sitúa las pruebas de vuelo en septiembre y principios de octubre de 2007 (sección 4, página 24 del PDF). No se sustituyen fechas del proyecto por fechas de vuelo. El número GMT de cada corrida se conserva en sus notas sin reinterpretar las marcas del video como horas del día. La microgravedad orbital usa `1e-6 g`, por convención del repositorio.

## Validación reproducible

Desde la raíz del repositorio:

```powershell
$env:PYTHONPATH = 'src'
python -m atlas.experiments.application.validate
python -m pytest tests/test_experiments.py
```

Comprobado: 3/3 investigaciones válidas y 4 pruebas de contrato aprobadas. Además, se cotejaron las 47 entradas contra las celdas de la tabla PDF: IDs, materiales, GMT, carrusel y posición; se verificaron las 30 muestras físicas, los 17 recalentamientos, los tres flujos explícitos, los localizadores y los hashes de las fuentes. En este entorno se usó `--basetemp=C:/Code/nasaApp/psi102-pytest-temp` para disponer de permisos de escritura en la carpeta temporal de pytest.
