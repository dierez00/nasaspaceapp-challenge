# Plantilla SaaS

Starter multi-tenant para comenzar productos web con Next.js App Router, Supabase Auth, PostgreSQL y Prisma. Incluye autenticación, organizaciones, roles, rutas protegidas, pruebas y CI; el dominio de negocio queda deliberadamente vacío.

## Requisitos

- Node.js 22+
- pnpm 11+
- Docker para ejecutar Supabase localmente

## Arranque local

```bash
pnpm install
pnpm supabase:start
cp .env.example .env.local
pnpm db:reset
pnpm prisma:generate
pnpm dev
```

`pnpm supabase:start` imprime la URL y las claves locales que debes copiar a `.env.local`. Las URLs de PostgreSQL incluidas en `.env.example` ya apuntan al puerto local predeterminado.

- Aplicación: <http://localhost:3000>
- Supabase Studio: <http://127.0.0.1:54323>
- Bandeja de correo local: <http://127.0.0.1:54324>

Registra una cuenta y abre el enlace recibido en la bandeja local. Después del login, el onboarding crea una organización y su membresía `owner` en una sola transacción.

## Personalizar para un proyecto nuevo

1. Cambia nombre, descripción e identificador del servicio en `src/shared/config/site.ts`.
2. Renombra el paquete en `package.json` y el `project_id` local en `supabase/config.toml`.
3. Ajusta los tokens visuales de `src/app/globals.css` y reemplaza la demo pública.
4. Define cada área de negocio dentro de `src/modules/<modulo>`.
5. Sustituye este README y el aviso privado cuando el producto tenga nombre y política de distribución propios.
6. Crea tu primer commit, añade tu remoto y marca el repositorio como plantilla en GitHub si quieres reutilizarlo con “Use this template”.

Puedes localizar cualquier texto pendiente del starter con:

```bash
rg -n -i "plantilla|starter|acme" src README.md supabase package.json
```

## Base de datos

`supabase/schemas/` es la fuente declarativa del esquema y `supabase/migrations/` contiene el historial desplegable. Prisma refleja las tablas públicas para consultas exclusivas del servidor y nunca genera migraciones.

```bash
# Edita supabase/schemas/*.sql y genera una migración revisable
pnpm dlx supabase@2.115.0 db diff -f nombre_del_cambio

# Reconstruye la base local y regenera contratos
pnpm db:reset
pnpm db:types
pnpm prisma:sync

# Inspecciona cambios remotos sin aplicarlos
pnpm db:push:dry
```

No ejecutes `db reset --linked` contra un proyecto remoto: elimina sus datos. El despliegue real con `supabase db push` debe ser una acción explícita y revisada.

En producción, configura `DATABASE_URL` con una conexión compatible con el runtime y reserva `DIRECT_DATABASE_URL` para introspección. Nunca expongas credenciales de PostgreSQL con el prefijo `NEXT_PUBLIC_`.

## Autenticación y seguridad

- Públicas: `/`, `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password` y `/auth/callback`.
- Privadas: `/onboarding`, `/workspace/[tenantSlug]` y `/admin`.
- `src/proxy.ts` refresca cookies y hace un filtro optimista de sesión.
- Los layouts privados vuelven a comprobar identidad y autorización en el servidor.
- RLS protege el acceso desde Supabase; cada consulta Prisma de negocio también debe incluir `tenantId` explícitamente.

Para promover un administrador global, usa un UUID confirmado desde un entorno administrativo:

```sql
insert into public.platform_admins (user_id)
values ('UUID-DE-AUTH-USERS');
```

Los usuarios autenticados no pueden promocionarse a sí mismos. En un proyecto remoto, registra el callback de producción y los callbacks de preview que decidas permitir.

## Calidad

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm dlx supabase@2.115.0 test db
```

`pnpm check` ejecuta lint, tipos, pruebas unitarias y build. GitHub Actions repite estas validaciones y levanta Supabase para comprobar creación de perfiles, ownership, aislamiento entre organizaciones y bloqueo de autoelevación.

El build usa Webpack de forma explícita para que la validación sea reproducible también en runners restringidos; `pnpm dev` conserva el servidor de desarrollo predeterminado de Next.js.

## Arquitectura

- `src/app`: rutas, layouts, formularios y controladores HTTP delgados.
- `src/core`: dominio, aplicación e infraestructura transversal.
- `src/modules`: módulos de negocio aislados por dominio, aplicación, infraestructura e interfaz.
- `src/shared`: configuración, UI y utilidades reutilizables.
- `src/server`: autenticación, Prisma, middleware y resolución de organizaciones.
- `supabase`: configuración local, esquema declarativo, migraciones, seed y pruebas SQL.
- `prisma`: espejo tipado del esquema para consultas del servidor.
- `docs`: decisiones técnicas y documentación que crezca con el producto.

## Distribución

Código privado y sin licencia de reutilización. Consulta `LICENSE` antes de publicar o compartir el repositorio.
