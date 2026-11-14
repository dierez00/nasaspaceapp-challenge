create extension if not exists vector;

-- One row per PSI investigation; `record` keeps the full validated contract.
create table if not exists experiments (
  id text primary key,
  title text not null,
  acronym text,
  platform text not null,
  research_area text not null,
  review_status text not null,
  record jsonb not null,
  updated_at timestamptz not null default now()
);

-- One row per map point; flat columns so the analyst agent can query with SQL.
create table if not exists experiment_tests (
  experiment_id text not null references experiments (id) on delete cascade,
  test_id text not null,
  point_type text not null default 'test',
  limit_type text,
  material text not null,
  material_class text not null,
  thickness_mm double precision,
  o2_percent double precision not null,
  o2_status text not null,
  pressure_kpa double precision not null,
  pressure_status text not null,
  gravity_environment text not null,
  gravity_g double precision not null,
  flow_velocity_cm_s double precision,
  flow_direction text,
  outcome text not null,
  burn_length_cm double precision,
  spread_rate_mm_s double precision,
  confidence text not null,
  needs_review boolean not null,
  primary key (experiment_id, test_id)
);

-- Columns added after the first release; keep the file idempotent.
alter table experiment_tests add column if not exists point_type text not null default 'test';
alter table experiment_tests add column if not exists limit_type text;

-- RAG chunks of PSI documents; 1024 = Voyage default embedding size.
create table if not exists document_chunks (
  id bigserial primary key,
  experiment_id text not null,
  source_file text not null,
  section text,
  content text not null,
  embedding vector(1024)
);

create index if not exists document_chunks_embedding_idx
  on document_chunks using hnsw (embedding vector_cosine_ops);

-- Chunks also cover search-only sources (e.g. PSI-107) that are not in `experiments`.
alter table document_chunks drop constraint if exists document_chunks_experiment_id_fkey;
alter table document_chunks add column if not exists content_hash text;
create unique index if not exists document_chunks_hash_idx
  on document_chunks (experiment_id, source_file, content_hash);
