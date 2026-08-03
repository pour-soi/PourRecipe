begin;
create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  model text not null,
  request_id text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_user_created_idx on public.ai_usage(user_id,created_at desc);
alter table public.ai_usage enable row level security;
drop policy if exists own_ai_usage_select on public.ai_usage;
create policy own_ai_usage_select on public.ai_usage for select to authenticated using(user_id=auth.uid());
drop policy if exists own_ai_usage_insert on public.ai_usage;
create policy own_ai_usage_insert on public.ai_usage for insert to authenticated with check(user_id=auth.uid());
grant select,insert on public.ai_usage to authenticated;
grant usage,select on sequence public.ai_usage_id_seq to authenticated;
commit;
