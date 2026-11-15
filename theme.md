---
name: lunar-fire-observatory
description: Approved observatory visual system for the Lunar Fire Atlas. Use for the cabin, scientific workspace, evidence map, simulation controls and contextual evidence reader.
---

# Lunar Fire Observatory

## Direction contract
- **Thesis:** exploration leads, evidence follows. The laboratory or evidence map is the primary working surface, never a sidebar beside a chatbot.
- **World:** a continuous dark orbital observatory. Preserve the introductory planet and stars. No white arrival wash, fake telemetry, decorative HUD, reward points or safety scores.
- **Story:** choose a perspective, vary a condition, compare gravities, then contrast the illustration with observed trials and exact sources.
- **First viewport:** shared orbital-combustion emblem and familiar lab/map tabs; perspective and current conditions beneath; large dark experiment viewport; assistant collapsed behind a persistent evidence action. Reading surfaces open in pale paper only when useful.
- **Form:** user-approved observatory proposal, extending the cabin rather than inventing a second visual world. The octagonal aperture stays structural, not an ornamental frame around every control.
- **Signature:** a blue spherical combustion illustration becomes a directional warm column across the same three-gravity instrument. This is art direction, not a validated interpolation or combustion solver.

## Palette and material
| Role | Value | Use |
| --- | --- | --- |
| Cabin Night | `#0A1324` | Continuous environment |
| Instrument surface | `#0D192B` | Laboratory and map |
| Instrument inset | `#15253C` | Controls, timeline |
| Instrument text | `#EDF3FC` | Primary text on dark |
| Instrument secondary | `#A9BAD2` | Labels and explanations on dark |
| Action / focus | `#9BC2FF` / `#A9C6FF` | Selection and keyboard focus |
| Evidence paper | `#F3F5F8` | Assistant, source reading, tables |
| Evidence text | `#142237` / `#485A70` | Primary / secondary on paper |
| Evidence action | `#174E99` | Links and controls on paper |
| Microgravity | `#3B82F6` | Data encoding, illustrative blue flame |
| Ignition / lunar region | `#FF5A1F` | Existing semantic data encoding |
| Extinction | `#059669` | Recorded extinction, not a safety certification |

The `.dark-instrument` and `.evidence-paper` scopes own their tokens; do not apply light text tokens to paper or dark action ink to the laboratory. Paper is for reading evidence, not for the whole workspace. Dark surfaces opt into `color-scheme: dark`, while evidence opts into light native controls.

## Typography and controls
- Retain Unbounded for module/brand headings, Instrument Sans for UI and prose, IBM Plex Mono for measured values and axes.
- Functional minimum is 13 px. Body text is 15–16 px. Data uses tabular numerals; mono is not decoration.
- Familiar buttons, selects, range inputs, number inputs, details/summary and sortable tables; visible keyboard focus, labels, and minimum 40 px action height.
- Restrained 12 px insets and 20 px module corners; thin structural boundaries, no stacked glowing bezels or ornamental gradients on text.
- Explicit vacuum, unavailable graphics, absent evidence and unknown outcome states. Never turn missing evidence into an observed result.

## Identity
`src/components/brand/atlas-mark.tsx` is the single emblem used by cabin and workspace. The orbital aperture crosses behind and in front of a combustion nucleus: silhouette and occlusion provide depth, with fixed top-left lighting rather than blur. The monochrome variant is a true current-color silhouette, not a grayscale bitmap. Keep it readable at 24–40 px; no lettering is baked into the SVG.

## Workspace hierarchy
- The instrument occupies the available width by default. Opening evidence reveals a contextual reader; closing restores that width without losing conversation, sources or simulation state.
- A persistent perspective select controls Estudiante / Docente / Investigador. It changes emphasis, not evidence truth.
- Student/teacher exploration proposes one-variable changes and a hypothesis. It never infers an outcome from oxygen or pressure.
- Researchers keep exact numeric parameters, material/gravity/range filters, raw CSV with provenance/source identifiers, source excerpts and evidence-brief citations.
- Evidence remains discoverable through the global reader action and the laboratory's expandable "Ensayos y fuentes" section. Synthetic rows never count as verified trials.
- Mobile uses an explicit instrument/evidence switch, with no offscreen topbar controls or horizontal focus-driven shifts.

## Motion contract
| Element | Role | Start | Duration | Relationship |
| --- | --- | --- | --- | --- |
| Cabin / instrument | Lead / support | Together at entry | 700 ms | Dark crossfade; no wash or scale on a canvas ancestor |
| Small camera dolly | Support | With crossfade | 700 ms | Carries the existing planet; no new star canvas |
| Return | Lead | On back | 350 ms | Same dark crossfade |
| Reduced-motion entry / return | Lead | Together | 200 ms | Opacity only; no dolly |
| View switching | Lead | On tab change | 180 ms opacity (120 ms reduced) | No transformed fixed-canvas ancestor or child stagger |
| Procedural flame | Scientific illustration | Shared clock | Explicit 8 s loop | Texture flow differs by gravity; pause/hidden/reduced-motion behavior retained |

Logo, map markers, labels, control clusters and evidence blocks stay still. No decorative map scanning or marker pulses. Transitions are skippable via the existing Escape/click flow and direct `#dashboard` entry remains instant.

## Rendering and scientific boundaries
- Reuse one laboratory Canvas with scissored views and one shared clock. Never create a canvas per gravity or another continuous star loop.
- Animation mutates shader uniforms/refs, never React state per frame. Pause when the instrument is hidden, on the map or outside the active surface. Scroll/resize invalidates paused scissor bounds without another loop.
- The shader is artistic emission/density, not CFD. Shape, color, loop timing and chosen phase do not predict sustained combustion, extinction or safety limits. Zero pressure always removes the flame.
- SVG remains a usable qualitative fallback with static depth and explicit state labels. Reduced motion does not hide controls or evidence.
- Every observed statement remains tied to real source rows. Demo data, unknown outcomes, nearest-condition differences and unvalidated lunar illustrations remain explicit.
