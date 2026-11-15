---
name: atlas-fuego-lunar-ui
description: Sistema de diseño "NASA Spatial & Precision Laser Lab" de alto contraste sobre blanco puro (#FFFFFF) para el Atlas del Fuego Lunar (Next.js + Tailwind CSS + D3.js). Usar siempre que se creen o modifiquen vistas del mapa de huecos, controles de gravedad o componentes generativos del chat.
---

# Design System: NASA Spatial & Precision Laser Lab

## 1. Filosofía Visual y Movimiento
- **Claridad Espacial sobre Blanco Puro:** Lienzo principal `#FFFFFF` con tarjetas elevadas (`0 12px 36px -8px rgba(10,14,23,0.08)`), superficies translúcidas con `backdrop-blur-xl` y bordes ultrafinos (*hairline* al 10% de opacidad).
- **Contraste Oficial NASA:** Uso disciplinado de **NASA Deep Space Blue (`#0B3D91`)** para estructura, controles de telemetría y selección activa, combinado con **NASA Rocket Red (`#FC3D21`)** exclusivamente para alertas físicas, haces láser de umbral ($\ge 30\%\ O_2$ y $\le 10.2\ \text{psi}$) e ignición propagada con liquid glass.
- **Movimiento Físico (Apple Spring Curves):** Todas las transiciones de interfaz, filtros de gravedad en D3 y aparición de bloques generativos utilizan `cubic-bezier(0.16, 1, 0.3, 1)` para lograr una sensación táctil, fluida y sin rebotes bruscos.

## 2. Tokens de Color (CSS Variables & Tailwind)

### Superficies y Tipografía (WCAG AAA)
- **Pure Canvas (`#FFFFFF`):** Fondo base de la aplicación y lienzo del mapa D3 (`bg-white`).
- **Technical Cool Gray (`#F3F4F6`):** Contenedores secundarios, barra de gravedad y chips de consulta rápida (`bg-gray-100`).
- **Hairline Border (`rgba(10, 14, 23, 0.10)`):** Divisores ópticos de `1px`.
- **Carbon Ink (`#0A0E17`):** Texto principal de máximo contraste.
- **Telemetry Slate (`#4B5563`):** Etiquetas de ejes, secciones y metadatos secundarios.

### Paleta Oficial NASA & Semántica Científica
- **NASA Deep Space Blue (`#0B3D91`):** Botones principales, badges de identificación PSI, burbujas del usuario y anillo doble de selección cruzada entre chat y mapa.
- **NASA Rocket Red / Vermilion (`#FC3D21`):** Contorno y barrido láser de la Zona de Operación Lunar ($\ge 30\%\ O_2$, $\le 10.2\ \text{psi}$), haz horizontal umbral y nodos con ignición sostenida.
- **Safe Emerald (`#059669`):** Experimentos con autoextinción e indicador de red de seguridad estática.
- **Microgravity Violet (`#5B21B6`):** Ensayos realizados en microgravedad ($\mu g$ / ISS).

## 3. Especificaciones de Animación y Microinteracciones
1. **Barrido Láser Óptico (`laserScan`):** Gradiente lineal sutil en `#FC3D21` que barre verticalmente la Zona Lunar cada `4.5s` para dirigir la mirada hacia la brecha de datos en $1/6g$.
2. **Pulso Radial en Nodos Críticos (`nodePulse`):** Anillo expansivo suave cada `2.4s` en los ensayos con ignición y en el experimento seleccionado activamente.
3. **Filtro Magnético de Gravedad:** Al mover el *slider* ($\mu g$, $1/6g$, $1g$), los nodos fuera del régimen seleccionado transicionan suavemente (`0.45s cubic-bezier(0.16, 1, 0.3, 1)`) a `opacity: 0.16` y `scale(0.88)`.
4. **Entrada Escalonada (*Staggered Fade-Up*):** Los componentes generativos del copiloto (`ExperimentCard`, `CompareTable`, `GravityBounds`, `SourceList`) entran secuencialmente con retardos de `40ms`, `140ms` y `240ms`.