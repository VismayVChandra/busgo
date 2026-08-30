-- This project is missing supabase_functions (the schema Database Webhooks
-- rely on to fire an HTTP POST via pg_net when a row changes). Every Supabase
-- project normally gets this provisioned automatically on creation; this one
-- didn't, which surfaced as "schema supabase_functions does not exist" when
-- trying to create a webhook in Studio.
--
-- This is a trimmed-down version of Supabase's own platform bootstrap for
-- this schema: same schema/table/function shape, but skips creating a
-- dedicated supabase_functions_admin role and reassigning ownership to it —
-- the migration role here (postgres) lacks ADMIN OPTION on roles it creates
-- on this managed instance, so that part of the standard bootstrap fails with
-- a permission error. Making http_request() security definer, owned by
-- postgres (who already has full access to schema net and everything else
-- needed), gets the same result without requiring that extra role.

create schema if not exists supabase_functions;

grant usage on schema supabase_functions to postgres, anon, authenticated, service_role;
alter default privileges in schema supabase_functions grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema supabase_functions grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema supabase_functions grant all on sequences to postgres, anon, authenticated, service_role;

create table if not exists supabase_functions.migrations (
  version text primary key,
  inserted_at timestamptz not null default now()
);
insert into supabase_functions.migrations (version) values ('initial') on conflict do nothing;

create table if not exists supabase_functions.hooks (
  id bigserial primary key,
  hook_table_id integer not null,
  hook_name text not null,
  created_at timestamptz not null default now(),
  request_id bigint
);
create index if not exists supabase_functions_hooks_request_id_idx on supabase_functions.hooks using btree (request_id);
create index if not exists supabase_functions_hooks_h_table_id_h_name_idx on supabase_functions.hooks using btree (hook_table_id, hook_name);
comment on table supabase_functions.hooks is 'Supabase Functions Hooks Table';

create or replace function supabase_functions.http_request()
returns trigger
language plpgsql
security definer
set search_path = supabase_functions, net, pg_catalog
as $function$
declare
  request_id bigint;
  payload jsonb;
  url text := TG_ARGV[0]::text;
  method text := TG_ARGV[1]::text;
  headers jsonb default '{}'::jsonb;
  params jsonb default '{}'::jsonb;
  timeout_ms integer default 1000;
begin
  if url is null or url = 'null' then
    raise exception 'url argument is missing';
  end if;

  if method is null or method = 'null' then
    raise exception 'method argument is missing';
  end if;

  if TG_ARGV[2] is null or TG_ARGV[2] = 'null' then
    headers = '{"Content-Type": "application/json"}'::jsonb;
  else
    headers = TG_ARGV[2]::jsonb;
  end if;

  if TG_ARGV[3] is null or TG_ARGV[3] = 'null' then
    params = '{}'::jsonb;
  else
    params = TG_ARGV[3]::jsonb;
  end if;

  if TG_ARGV[4] is null or TG_ARGV[4] = 'null' then
    timeout_ms = 1000;
  else
    timeout_ms = TG_ARGV[4]::integer;
  end if;

  case
    when method = 'GET' then
      select http_get into request_id from net.http_get(url, params, headers, timeout_ms);
    when method = 'POST' then
      payload = jsonb_build_object('old_record', OLD, 'record', NEW, 'type', TG_OP, 'table', TG_TABLE_NAME, 'schema', TG_TABLE_SCHEMA);
      select http_post into request_id from net.http_post(url, payload, params, headers, timeout_ms);
    else
      raise exception 'method argument % is invalid', method;
  end case;

  insert into supabase_functions.hooks (hook_table_id, hook_name, request_id)
  values (TG_RELID, TG_NAME, request_id);

  return NEW;
end
$function$;

grant all privileges on all tables in schema supabase_functions to postgres, anon, authenticated, service_role;
grant all privileges on all sequences in schema supabase_functions to postgres, anon, authenticated, service_role;
