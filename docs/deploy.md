# Despliegue

El frontend (rama `main`) se despliega en **Vercel** y la API (rama `backend`) en **Railway**. El navegador solo habla con Vercel; las rutas de servidor de Next.js llaman a la API.

## Orden recomendado

1. Base de datos con pgvector (Supabase o Railway).
2. API en Railway, con su dominio público.
3. Frontend en Vercel, apuntando a ese dominio.

## 1. Base de datos

Opción A: **Supabase**.

- Crea un proyecto. La extensión `vector` se activa sola en el primer despliegue (`db/schema.sql` ejecuta `create extension if not exists vector`); también puedes activarla en _Database → Extensions_.
- Usa la cadena del **Session pooler** (host `*.pooler.supabase.com`, puerto `5432`) y añade `?sslmode=require`.
- No uses la conexión directa (solo IPv6, salvo con el complemento IPv4) ni el _Transaction pooler_ (puerto `6543`): el driver de Postgres de la API reutiliza sentencias preparadas y ese modo no las admite.

Opción B: **Railway**. Agrega al proyecto la plantilla _pgvector_; la plantilla estándar de Postgres no incluye la extensión. Referencia su URL con `${{pgvector.DATABASE_URL}}` (ajusta al nombre del servicio).

## 2. API en Railway

La rama `backend` trae `Dockerfile` y `railway.json`: Railway construye la imagen, ejecuta `atlas-load` antes de cada despliegue (aplica el esquema y carga los ensayos de forma idempotente) y verifica `/health`.

1. Crea un servicio desde el repositorio con la rama `backend` como origen.
2. Variables del servicio:

   | Variable                  | Valor                                      |
   | ------------------------- | ------------------------------------------ |
   | `DATABASE_URL`            | Cadena de la base del paso 1               |
   | `VOYAGE_API_KEY`          | Clave de Voyage AI (búsqueda y reranking)  |
   | `CLAUDE_CODE_OAUTH_TOKEN` | Token de Claude Code para los agentes      |
   | `AGENTS_MOCK`             | `0`; con `1` responde sin Claude ni Voyage |

   `PORT` lo inyecta Railway. El resto de variables tiene valores por defecto (ver `.env.example` de la rama `backend`).

3. En _Settings → Networking_, genera un dominio público.
4. Indexa los documentos una vez (y cada vez que cambie `data/`); consume cuota de Voyage:

   ```bash
   railway run atlas-index
   ```

## 3. Frontend en Vercel

1. Importa el repositorio con `main` como _Production Branch_. Vercel detecta Next.js y pnpm; no hace falta `vercel.json`.
2. Variables (Production y Preview):

   | Variable           | Valor                                                            |
   | ------------------ | ---------------------------------------------------------------- |
   | `ATLAS_DATA_MODE`  | `remote`; `demo` despliega sin backend, con datos sintéticos     |
   | `ATLAS_QUERY_MODE` | `remote` para los agentes; `guided` responde con cálculos sin IA |
   | `ATLAS_API_URL`    | Dominio de Railway, sin `/` final                                |

3. Despliega y comprueba `/api/health`.

## Notas

- Una respuesta de los agentes puede tardar hasta 120 s. La ruta `/api/atlas/query` declara `maxDuration = 150`; el plan de Vercel debe permitir esa duración.
- Como la API solo recibe llamadas del servidor de Next.js, CORS no interviene. `CORS_ORIGINS` solo hace falta si un navegador consulta la API directamente.
- La caché de respuestas de la API vive en el disco efímero del contenedor y se reinicia en cada despliegue. Para conservarla, monta un volumen y apunta `QUERY_CACHE_FILE` a él.
- Prueba local de la imagen de la API: `docker build -t atlas-api . && docker run --rm -e PORT=8000 -e AGENTS_MOCK=1 -p 8000:8000 atlas-api`.
