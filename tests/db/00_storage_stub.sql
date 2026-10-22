-- LOCAL TESTING ONLY. Never run against a real Supabase project.
-- The supabase/postgres image ships the `storage` schema but its tables are
-- created by the Storage API service at runtime. This stub recreates the
-- minimum needed for our migrations to apply on a bare database.

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name      text
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
