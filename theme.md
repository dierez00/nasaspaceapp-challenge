---
name: atlas-fuego-lunar-ui
description: Sistema de diseño "Flight deck" para el Atlas del Fuego Lunar (Next.js + Tailwind v4 + D3). Cabina oscura de entrada y consola clara de instrumentos. Usar siempre que se creen o modifiquen vistas del dashboard, el mapa de evidencias, los controles del laboratorio o los bloques generativos del copiloto.
---

# Design System: Flight deck

Historia: te sientas en la cúpula de la ISS, pulsas *Comenzar inmersión*, viajas hacia la Luna y aterrizas en una consola de instrumentos. La cabina (hero) es oscura; la consola (dashboard) es clara, precisa y legible. El color no decora: codifica física.

## 1. Principios
- **Operar, no admirar.** El dashboard prioriza legibilidad y jerarquía; la marca vive en los detalles (tipografía de títulos, color semántico, forma).
- **Módulos, no rejillas.** Cada instrumento es una tarjeta blanca de 20 px sobre un lienzo gris lunar. Nada de filetes de 1 px sin radio.
- **Copy llano en español, frase en minúscula.** Sin ornamentos tipo "VOL. 001" ni metadatos inventados. Una acción conserva su nombre en todo el flujo.
- **Un solo estilo de etiqueta en mayúsculas** (`.label`): 13 px, mono, tracking 0.04em. Nada más va en mayúsculas tracked.

## 2. Tokens de color (CSS variables en `src/app/globals.css`)
| Token | Valor | Uso |
| --- | --- | --- |
| `--cabin-night` | `#0A1324` | Fondo de la cabina/hero y de la ventana 3D (azul marino profundo, no negro) |
| `--moon-dust` | `#E9EDF3` | Lienzo del dashboard |
| `--instrument-white` | `#FFFFFF` | Superficie de módulos |
| `--ink` | `#0E1726` | Texto principal |
| `--slate` | `#4A5568` | Texto secundario (≥ 7:1 sobre blanco) |
| `--nasa-blue` | `#0B3D91` | Estructura, acción primaria, selección, foco |
| `--flame-orange` | `#FF5A1F` | Ignición y zona de operación lunar (≥ 30 % O₂, ≤ 10.2 psi) |
| `--blue-flame` | `#3B82F6` | Microgravedad: las llamas reales en µg son azules |
| `--safe-emerald` | `#059669` | Autoextinción |
| `--line` | `rgba(14,23,38,0.08)` | Borde sutil de módulos |

Variantes para texto sobre fondos claros (contraste ≥ 4.5:1): `--flame-orange-ink #B93A0E`, `--blue-flame-ink #1D4ED8`, `--safe-emerald-ink #047857`. Tintes para fondos: `--nasa-blue-tint`, `--flame-orange-tint`, `--blue-flame-tint`, `--safe-emerald-tint`.

### Semántica científica
- **Flame Orange**: ignición propagada y zona lunar. Se trata con calma (relleno tenue + borde discontinuo), nunca como alarma.
- **Blue Flame**: ensayos en microgravedad.
- **Safe Emerald**: autoextinción.
- **NASA Blue**: lo que el usuario controla o ha seleccionado.

## 3. Tipografía (`next/font/google`, variables CSS)
- **Display**: *Unbounded* (`--font-display`). Solo títulos de módulo y el título del hero. Peso 500–600.
- **Cuerpo**: *Instrument Sans* (`--font-body`).
- **Datos**: *IBM Plex Mono* (`--font-data`) con `font-variant-numeric: tabular-nums` en lecturas, ejes y unidades.
- Escala: `--text-sm 13px` (mínimo funcional), `--text-base 15px`, `--text-md 16px`, `--text-lg 18px`, `--text-xl 22px`, `--text-2xl 28px`, `--text-3xl 36px`. Ningún texto funcional por debajo de 13 px.

## 4. Forma, espacio y elevación
- Módulos: radio `--radius-module 20px`; elementos internos `--radius-inner 12px`; controles y chips `--radius-pill`.
- Padding de módulo 20–24 px; separación entre módulos 16 px.
- Elevación: `--shadow-module` (dos capas suaves) + borde `--line`. Sin `backdrop-blur` decorativo.
- Controles: altura mínima 40 px; segmentados en píldora con el seleccionado en blanco sobre pista `--moon-dust` (o NASA Blue en acciones primarias).
- Foco visible: anillo de 2 px NASA Blue con desfase de 2 px.

## 5. Movimiento
- Curva única: `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`. Transiciones de 150–250 ms en controles; 300–500 ms en aparición de bloques.
- Solo `transform` y `opacity`. Nada de `transition: all`.
- Press: `scale(0.97)`. Hover solo con `@media (hover: hover)`.
- `prefers-reduced-motion`: se eliminan pulsos, barridos y escalonados; los cambios de estado se mantienen sin animación.

## 6. Componentes
- **Módulo**: `.module` — blanco, 20 px, sombra suave, borde sutil.
- **Cabecera de módulo**: título en display 20–22 px, subtítulo de una línea en slate.
- **Clúster de instrumento**: grupo con etiqueta (`.label`) y controles; un clúster por magnitud (Material, Presión, Oxígeno, Gravedad, Fase).
- **Lecturas numéricas**: Plex Mono, tabulares, unidad en slate más pequeña pero ≥ 13 px.
- **Ventana 3D del laboratorio**: puede permanecer en Cabin Night; se enmarca como instrumento con radio de 16 px.
- **Mapa de evidencias**: ejes ≥ 12 px, zona lunar en Flame Orange tenue, nodos µg en Blue Flame, leyenda con muestras de color.
- **Copiloto**: burbujas redondeadas; usuario en NASA Blue sobre blanco, asistente en superficie gris tenue con avatar; chips y campo en píldora.
- **Bloques generativos** (`ExperimentCard`, `CompareTable`, `GravityBounds`, `SourceList`): mismas reglas de módulo interno (radio 12 px, borde sutil).
