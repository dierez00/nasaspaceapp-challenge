# Deployment

The frontend (`main` branch) deploys to **Vercel** and the API (`backend` branch) to **Railway**. The browser only talks to Vercel; the Next.js server routes call the API.

## Recommended order

1. Database with pgvector (Supabase or Railway).
2. API on Railway, with its public domain.
3. Frontend on Vercel, pointing to that domain.

## 1. Database

Option A: **Supabase**.

- Create a project. The `vector` extension is enabled on the first deploy (`db/schema.sql` runs `create extension if not exists vector`); you can also enable it under _Database → Extensions_.
- Use the **Session pooler** connection string (host `*.pooler.supabase.com`, port `5432`) and append `?sslmode=require`.
- Do not use the direct connection (IPv6 only, unless you buy the IPv4 add-on) or the _Transaction pooler_ (port `6543`): the API's Postgres driver reuses prepared statements, which that mode does not support.

Option B: **Railway**. Add the _pgvector_ template to the project; the standard Postgres template does not include the extension. Reference its URL with `${{pgvector.DATABASE_URL}}` (adjust to the service name).

## 2. API on Railway

The `backend` branch ships a `Dockerfile` and `railway.json`: Railway builds the image, runs `atlas-load` before every deploy (applies the schema and loads the trials idempotently) and checks `/health`.

1. Create a service from the repository with `backend` as its source branch.
2. Service variables:

   | Variable                  | Value                                     |
   | ------------------------- | ----------------------------------------- |
   | `DATABASE_URL`            | Connection string from step 1             |
   | `VOYAGE_API_KEY`          | Voyage AI key (search and reranking)      |
   | `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code token for the agents          |
   | `AGENTS_MOCK`             | `0`; `1` answers without Claude or Voyage |

   To run the agents on a GPT deployment in Azure OpenAI instead of Claude, set `LLM_PROVIDER=azure_openai` and drop `CLAUDE_CODE_OAUTH_TOKEN`:

   | Variable                        | Value                                                              |
   | ------------------------------- | ------------------------------------------------------------------ |
   | `LLM_PROVIDER`                  | `azure_openai` (default `claude`)                                  |
   | `AZURE_OPENAI_ENDPOINT`         | Resource URL, `https://<resource>.openai.azure.com`                |
   | `AZURE_OPENAI_API_KEY`          | Resource key                                                       |
   | `AZURE_OPENAI_API_VERSION`      | Azure OpenAI API version supported by your deployment              |
   | `CLASSIFIER_MODEL`, `AGENT_MODEL` | Azure **deployment names** (the defaults are Claude models)      |
   | `AZURE_OPENAI_REASONING_EFFORT` | Optional `low`, `medium` or `high`; reasoning deployments only     |

   The API refuses to start if any of these is missing. The answer cache does not tell providers apart: clear `data/query_cache.json` (or set `QUERY_CACHE_ENABLED=0`) when you switch.

   Railway injects `PORT`. All other variables have defaults (see `.env.example` on the `backend` branch).

3. Under _Settings → Networking_, generate a public domain.
4. Index the documents once (and again whenever `data/` changes); this uses Voyage quota:

   ```bash
   railway run atlas-index
   ```

## 3. Frontend on Vercel

1. Import the repository with `main` as the _Production Branch_. Vercel detects Next.js and pnpm; no `vercel.json` is needed.
2. Variables (Production and Preview):

   | Variable           | Value                                                              |
   | ------------------ | ------------------------------------------------------------------ |
   | `ATLAS_DATA_MODE`  | `remote`; `demo` deploys without a backend, on synthetic data      |
   | `ATLAS_QUERY_MODE` | `remote` for the agents; `guided` answers with non-AI calculations |
   | `ATLAS_API_URL`    | Railway domain, without a trailing `/`                             |

3. Deploy and check `/api/health`.

## Notes

- An agent answer can take up to 120 s. The `/api/atlas/query` route declares `maxDuration = 150`; your Vercel plan must allow that duration.
- Since the API only receives calls from the Next.js server, CORS is not involved. `CORS_ORIGINS` is only needed if a browser calls the API directly.
- The API's answer cache lives on the container's ephemeral disk and resets on every deploy. To keep it, mount a volume and point `QUERY_CACHE_FILE` to it.
- Local test of the API image: `docker build -t atlas-api . && docker run --rm -e PORT=8000 -e AGENTS_MOCK=1 -p 8000:8000 atlas-api`.
