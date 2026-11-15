# Atlas del Fuego Lunar

Demo pública de exploración visual en `/`. Usa el sistema `atlas-fuego-lunar-ui` de `theme.md`. La primera versión incluye 12 ensayos sintéticos, consultas guiadas y llamas cualitativas; no es un simulador predictivo ni contiene resultados verificados de NASA PSI.

## Ejecutar

```sh
pnpm install
pnpm prisma:generate
pnpm dev
```

La página del Atlas y sus dos endpoints públicos no requieren Supabase, PostgreSQL ni claves de IA. Las pantallas de autenticación, workspace y administración conservan sus requisitos originales. El cliente Prisma se genera porque esas rutas siguen formando parte del build.

## Arquitectura

- `src/modules/atlas`: dominio de experimentos, puerto `ExperimentRepository`, repositorios demo/HTTP y mapa D3 secundario.
- `src/modules/copilot`: contratos Zod, puerto `CopilotGateway`, adaptadores demo/SSE y renderer de bloques.
- `src/app`: composición de página y fachada HTTP delgada.
- React posee los nodos SVG; D3 proporciona escalas lineales, inversión de coordenadas y ticks. La sonda se actualiza localmente, sin invalidar el estado del chat.
- `AtlasProvider` mantiene selección, régimen de gravedad, pestaña móvil y consulta contextual. La selección sobrevive al cambio de panel. La selección se conserva al filtrar; los nodos ajenos se atenúan incluso si están seleccionados.
- Desde 1024 px se utiliza 65/35. En pantallas menores se alternan paneles sin desmontar el chat. El historial tiene scroll interno; la aplicación ocupa `100dvh`.

## Contrato propuesto v1

Estos endpoints son la propuesta de integración del frontend. No implican que FastAPI ya exista. Las fuentes ejecutables de los tipos son `experimentSchema`, `querySchema`, `blockSchema` y `eventSchema`.

### Catálogo

`GET /api/atlas/experiments` devuelve un arreglo:

```json
[
  {
    "id": "DEMO-001",
    "material": "PMMA",
    "pressure": 8.2,
    "oxygen": 32,
    "gravity": "micro",
    "outcome": "ignition",
    "spreadRate": 1.8,
    "provenance": "demo",
    "sources": [
      {
        "document": "Ficha ilustrativa del Atlas",
        "code": "DEMO-1",
        "section": "Condiciones de prueba",
        "excerpt": "Datos sintéticos, no un ensayo PSI.",
        "demo": true
      }
    ]
  }
]
```

Presión en psi, O₂ en porcentaje, velocidad en mm/s. `spreadRate: null` significa desconocida; cero significa una velocidad reportada de cero. Gravedad: `micro | lunar | earth`. Resultado: `ignition | extinction | unknown`. Procedencia: `demo | verified`. `sources[].url` es opcional. El catálogo debe estar dentro del dominio visual 0–16 psi y 18–50% O₂; el adaptador rechaza datos fuera de contrato, no los mueve silenciosamente a los límites.

### Consulta y streaming

`POST /api/atlas/query`, `Content-Type: application/json`:

```json
{
  "version": 1,
  "queryId": "identificador-unico",
  "text": "¿Qué pasaría si encendemos aquí en 1/6g?",
  "context": { "pressure": 10.2, "oxygen": 30, "gravity": "lunar" }
}
```

`context` es opcional. `text` admite 1–2000 caracteres. Respuesta `text/event-stream`, con JSON en `data:` y una línea vacía al terminar cada evento:

```text
event: agent-status
data: {"type":"agent-status","queryId":"identificador-unico","agent":"analyst","status":"working"}

event: text-delta
data: {"type":"text-delta","queryId":"identificador-unico","text":"Respuesta parcial"}

event: ui-block
data: {"type":"ui-block","queryId":"identificador-unico","block":{"type":"ExperimentCard","experimentId":"DEMO-001"}}

event: done
data: {"type":"done","queryId":"identificador-unico"}

```

Agentes: `analyst | physics | synthesizer`. Estados: `working | done`. Los errores del stream usan `type: error`, `queryId` y `message`. La finalización requiere `done`; un cierre prematuro produce error recuperable. El cliente ignora otros `queryId`, cancela la consulta anterior al enviar otra y conserva bloques parciales al cancelar. No se reconecta automáticamente para evitar duplicar consultas.

Bloques admitidos:

| type           | Campos                               |
| -------------- | ------------------------------------ |
| ExperimentCard | experimentId                         |
| CompareTable   | experimentIds (2–6 IDs del catálogo) |
| GravityBounds  | explanation                          |
| SourceList     | sources                              |
| FallbackCard   | markdown, sources                    |

Cada bloque se valida independientemente. Un bloque inválido se sustituye por un fallback, sin eliminar los válidos. Markdown deshabilita HTML crudo; enlaces documentales solo se presentan para HTTP(S). Un ID que no existe muestra un estado de evidencia no disponible.

## Conectar FastAPI

Configurar únicamente en el servidor:

```dotenv
ATLAS_DATA_MODE=remote
ATLAS_API_URL=http://127.0.0.1:8000
```

Reiniciar Next.js. El navegador sigue consultando la misma fachada; Next.js solicita `GET {ATLAS_API_URL}/experiments` y reenvía `POST {ATLAS_API_URL}/query`, preservando el stream. Tiempo límite: 15 segundos para catálogo y 60 segundos para consultas. La URL del backend no usa `NEXT_PUBLIC_`. Nunca enviar credenciales de agentes al navegador.

El modo predeterminado es `demo`. El modo remoto no cae silenciosamente en datos sintéticos: muestra carga, error y reintento. Implementar las mismas formas en Pydantic y comprobar los fixtures contra ambos esquemas antes de conectar datos reales. Autenticación de backend, cuotas y persistencia de conversaciones quedan para esa integración; esta entrega no modifica el modelo multiempresa.

## Comportamiento científico de la demo

La región marcada es exactamente O₂ ≥ 30% y presión ≤ 10.2 psi dentro del dominio del mapa. Es una región de exploración ilustrativa, no un umbral validado de seguridad. El catálogo no tiene muestras lunares y no permite inferir que NASA carezca de ellas. E-FIELD se presenta como tema de investigación, sin afirmar equivalencia con gravedad lunar.

Las siluetas, halo y desplazamiento de la llama son animaciones cualitativas. Las condiciones y material se muestran como contexto, no alimentan un solver de combustión. No se calcula una probabilidad de ignición ni se interpolan velocidades lunares. Sustituir las fichas por fuentes revisadas antes de presentar cifras como evidencia.

## Verificación

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Playwright utiliza Edge instalado (`channel: msedge`); para otros entornos instalar Chromium y cambiar ese canal. Cubre escritorio 1440×900 y 1366×768, móvil 390×844, filtros, sincronización, re-ignición, consultas, teclado, coincidencias, movimiento reducido, error/reintento, cancelación y fallback. Genera capturas en `test-results/`, ignorado por Git. Vitest cubre dominios, contratos y transporte SSE fragmentado, Unicode, abortos y consultas obsoletas.

El modo demo requiere el servidor Next.js local, pero no servicios externos en ejecución. No es una PWA ni un sitio completamente estático. La conexión contra FastAPI real sigue pendiente hasta disponer del servicio.

### Entorno del build heredado

Las rutas SaaS importan Prisma y validan `DATABASE_URL` durante el build. Para `pnpm build`, usa la URL local de `.env.example` (igual que CI); no hace falta un servidor PostgreSQL activo. La demo en `/` no consulta esa base.

## Laboratorio inmersivo 3D

La vista inicial ahora es **Laboratorio**; **Mapa de evidencias** conserva D3 como exploración secundaria. Se reemplazaron las barras de `CompareTable` por una acción de comparación A/B; su esquema y el transporte SSE siguen siendo compatibles. `GravityBounds` ofrece presets que abren el laboratorio, sin una tabla de siluetas. La selección de ensayos desde mapa o chat carga sus condiciones en la cámara.

### Dependencias y límites

- Three.js 0.187, React Three Fiber 9 y Drei 10: WebGL estable, un único canvas y vistas con scissor. El canvas ocupa el viewport porque Drei View mide coordenadas de ventana; solo dibuja dentro de las cámaras. No se requiere WebGPU.
- Motion: transiciones de interfaz, desactivadas con movimiento reducido.
- El módulo `simulation` separa escenarios, reloj y presentación. No consulta servicios ni modifica los experimentos. Las condiciones originales conservan la referencia al ensayo y su procedencia demo/verificada; cada edición crea un escenario hipotético.
- La llama usa un campo volumétrico procedural con ray marching, ruido advectado y transparencia. No resuelve dinámica de fluidos, química, transferencia de calor ni un modelo de seguridad.

### Reglas visuales explícitas

El estado de la llama se elige manualmente. Presión y oxígeno nunca cambian automáticamente el resultado de un ensayo. Son controles de dirección artística:

- Presión normalizada `P/16`: multiplica la densidad visual entre 0.7 y 1.2. A presión cero se oculta la llama y se muestra “Cámara sin gas”.
- Oxígeno normalizado `(O₂-18)/32`: multiplica la densidad entre 0.8 y 1.15 y la extensión entre 0.8 y 1.02. Estos coeficientes no tienen significado físico.
- Gravedad visual: 0 para µg, 0.45 para Luna y 1 para Tierra mezcla una envolvente esférica con una columna ahusada. La transición se amortigua suavemente; movimiento reducido la aplica directamente.
- Tiempo `t` entre 0 y 8 segundos: ignición crece durante el primer cuarto de la secuencia; propagación desplaza la llama a lo largo de la muestra; extinción reduce su intensidad hasta apagarla. La reproducción se repite automáticamente cada ocho segundos, conservando el estado y las condiciones de A/B. Pausar detiene el bucle; mover el progreso permite inspeccionar una fase sin reproducir.
- PMMA y polietileno usan acabado de polímero; los demás materiales usan una textura tejida ilustrativa. La marca oscura y la luz sobre la muestra son efectos visuales.

Cambiar presión, oxígeno, material o gravedad conserva el progreso. Cambiar el estado explícito, cargar un ensayo o restaurar sus condiciones reinicia la secuencia. Con movimiento reducido, el reloj inicia pausado y los estados se exploran con el control de progreso o reproducción manual.

### Comparación y controles

“Comparar A/B” duplica A, conservando por separado el historial original de cada escenario. Ambos comparten reloj y pose de cámara; sus condiciones y estados de llama son independientes. “Intercambiar” cambia los escenarios completos. “Original” restaura la referencia de ese lado. En móvil solo se ve A o B a la vez, pero ambos conservan sus condiciones.

OrbitControls limita giro, distancia y elevación, sin desplazamiento lateral. “Restablecer cámara” restaura la pose compartida. Una órbita en A se replica en B sin reiniciar la animación.

### Rendimiento y recuperación

El reloj publica datos de interfaz a unos 10 Hz; Three.js consulta el tiempo en su propio ciclo gráfico. Las pestañas ocultas, el mapa y el copiloto móvil suspenden el reloj. El renderer funciona bajo demanda y solicita nuevos frames solo durante reproducción, interacción o transición de gravedad.

Calidad inicial: DPR máximo 1.5 y 32 pasos del shader en escritorio; DPR 1 y 20 pasos en móvil. Si la medición cae por debajo de 32 FPS, se reduce la calidad. Los materiales y texturas se liberan al desmontar. La pérdida de contexto o ausencia de WebGL muestra una versión SVG con los mismos controles y un botón para reintentar 3D.

Las mediciones automatizadas usan Edge headless en este equipo y ventanas móviles emuladas, no un teléfono físico. La suite exige al menos 45 FPS en escritorio y 30 FPS en la ventana móvil para una y dos vistas. Las cifras se imprimen en la ejecución; no son una garantía para todos los dispositivos.

### Pruebas añadidas

Vitest cubre independencia A/B, restauración, intercambio, conservación de evidencia, límites de controles, estados explícitos y reloj. Playwright cubre las tres resoluciones, renderizado efectivo, presets, navegación desde mapa/chat, pausa al ocultar, movimiento reducido, WebGL ausente/perdido, reintento y sincronización de cámaras. Las capturas `laboratory-*.png` y `comparison-*.png` quedan en `test-results/`.

### Resultado de verificación del laboratorio

Verificado en Edge headless el 14 de noviembre de 2026, con el servidor de desarrollo y la misma máquina para todas las ventanas:

- 1440×900: 50.2 FPS con una llama; 60.8 FPS en comparación A/B.
- 1366×768: 59.9 FPS con una llama; 60.7 FPS en comparación A/B.
- 390×844: 59.8 FPS con una llama; 60.5 FPS en modo A/B móvil (una cámara visible a la vez).

El contador mide frames durante ventanas aproximadas de dos segundos; pequeñas diferencias alrededor de 60 FPS son variación de muestreo. El perfil móvil es una ventana emulada en este equipo, no una medición de hardware móvil. Se revisaron las capturas y se comprobó que el canvas ejecuta llamadas de dibujo, evitando confundir un canvas vacío con buen rendimiento.

Resultado funcional: 24 pruebas unitarias y 11 recorridos Playwright aprobados. Incluyen órbita compartida/restablecimiento, pérdida y ausencia de WebGL, controles independientes, vacío, estados explícitos, consultas y suspensión del reloj.
