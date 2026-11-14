# Atlas del Fuego Lunar · Backend

Backend en Python del Atlas: datos de investigaciones de NASA PSI, búsqueda y agentes. El front vive en la rama `main`.

## Arranque

```bash
python3 -m venv .venv
.venv/bin/pip install -e '.[dev]'
.venv/bin/pytest
.venv/bin/atlas-validate
```

## Estructura

- `src/atlas/experiments/domain/`: contrato de datos (Pydantic).
- `src/atlas/experiments/application/`: carga y validación de `data/experiments/`.
- `data/experiments/PSI-<n>.json`: un archivo por investigación.
- `data/raw/PSI-<n>/`: copia sin cambios de la tabla experimental de PSI.
- `data/schema/experiment.schema.json`: JSON Schema generado para el front; no se edita a mano.
- `docs/data-extraction.md`: formato, reglas del equipo y prompt de extracción.
