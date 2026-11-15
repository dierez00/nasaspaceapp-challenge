# Módulos

Cada área del producto vive en su propia carpeta con las capas `domain`, `application`, `infra` y `ui`. Las dependencias apuntan hacia dentro: `ui` e `infra` dependen de `application` y `domain`, nunca al revés.

- `atlas`: catálogo de ensayos, mapa de evidencias y estado global.
- `simulation`: laboratorio comparativo 3D.
- `copilot`: consultas, evidence brief y panel del asistente.
