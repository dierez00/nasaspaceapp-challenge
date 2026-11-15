# Vendored agent skills

Project-scoped skills copied verbatim from upstream on 2026-11-15. Only Markdown and JSON files are vendored; no executable code.

| Skill folder | Upstream | Commit |
|---|---|---|
| `vercel-react-best-practices` | https://github.com/vercel-labs/agent-skills (`skills/react-best-practices`) | `1a2c79d` |
| `web-design-guidelines` | https://github.com/vercel-labs/agent-skills | `1a2c79d` |
| `emil-design-eng`, `review-animations`, `improve-animations`, `animation-performance`, `choreograph`, `break-ui`, `animation-vocabulary` | https://github.com/emilkowalski/skills | `0f2e23b` |
| `r3f-best-practices` | https://github.com/emalorenzo/three-agent-skills | `f950f95` |
| `impeccable` | https://github.com/pbakaus/impeccable (`.claude/skills/impeccable`) | `2b86d9c` |

## Local modifications

- `impeccable/scripts/` is intentionally **not** vendored. The upstream launcher downloads and runs a binary. Without it, Impeccable follows its documented "Launcher unavailable" fallback: read `PRODUCT.md` / `DESIGN.md` directly. Do not run `impeccable live`, `hooks`, `pin`, or `foundations`.
- `theme.md` at the repo root is the design system of record; skills must not override its palette, typography, or motion tokens.
