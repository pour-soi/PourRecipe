begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id) on delete cascade,
  revision bigint not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table if not exists public.recipes (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade, data jsonb not null,
  revision bigint not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table if not exists public.recipe_ingredients (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade, recipe_id uuid not null references public.recipes(id) on delete cascade,
  data jsonb not null, revision bigint not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table if not exists public.recipe_steps (like public.recipe_ingredients including all);
alter table public.recipe_steps drop constraint if exists recipe_steps_recipe_id_fkey;
alter table public.recipe_steps add constraint recipe_steps_recipe_id_fkey foreign key(recipe_id) references public.recipes(id) on delete cascade;
create table if not exists public.categories (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade, data jsonb not null,
  revision bigint not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table if not exists public.tags (like public.categories including all);
create table if not exists public.recipe_categories (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade, category_id uuid not null references public.categories(id) on delete cascade,
  revision bigint not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique(user_id,recipe_id,category_id)
);
create table if not exists public.recipe_tags (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade, tag_id uuid not null references public.tags(id) on delete cascade,
  revision bigint not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique(user_id,recipe_id,tag_id)
);
create table if not exists public.cook_records (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade, recipe_id uuid not null references public.recipes(id) on delete cascade, data jsonb not null,
  revision bigint not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table if not exists public.images (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade, recipe_id uuid not null references public.recipes(id) on delete cascade, data jsonb not null,
  revision bigint not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table if not exists public.ocr_records (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade, recipe_id uuid not null references public.recipes(id) on delete cascade,
  image_id uuid not null references public.images(id) on delete cascade, data jsonb not null,
  revision bigint not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table if not exists public.sync_changes (
  cursor bigint generated always as identity primary key, id uuid not null default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  object_type text not null check(object_type in ('recipe','category','tag','cook_record','image','ocr_record')), object_id uuid not null,
  revision bigint not null, data jsonb not null, deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint sync_changes_revision_positive check(revision>0)
);

create index if not exists recipes_user_updated_idx on public.recipes(user_id,updated_at);
create index if not exists ingredients_recipe_idx on public.recipe_ingredients(user_id,recipe_id);
create index if not exists steps_recipe_idx on public.recipe_steps(user_id,recipe_id);
create index if not exists categories_user_updated_idx on public.categories(user_id,updated_at);
create index if not exists tags_user_updated_idx on public.tags(user_id,updated_at);
create index if not exists cook_records_recipe_idx on public.cook_records(user_id,recipe_id);
create index if not exists images_recipe_idx on public.images(user_id,recipe_id);
create index if not exists ocr_recipe_image_idx on public.ocr_records(user_id,recipe_id,image_id);
create index if not exists sync_changes_pull_idx on public.sync_changes(user_id,cursor);
create index if not exists sync_changes_object_latest_idx on public.sync_changes(user_id,object_type,object_id,cursor desc);

do $$ declare t text; begin
  foreach t in array array['profiles','recipes','recipe_ingredients','recipe_steps','categories','tags','recipe_categories','recipe_tags','cook_records','images','ocr_records','sync_changes']
  loop execute format('alter table public.%I enable row level security',t); end loop;
end $$;

do $$ declare t text; begin
  foreach t in array array['profiles','recipes','categories','tags','sync_changes']
  loop
    execute format('drop policy if exists own_rows on public.%I',t);
    execute format('create policy own_rows on public.%I for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid())',t);
  end loop;
end $$;

do $$ declare t text; begin
  foreach t in array array['recipe_ingredients','recipe_steps','cook_records','images']
  loop
    execute format('drop policy if exists own_recipe_rows on public.%I',t);
    execute format('create policy own_recipe_rows on public.%I for all to authenticated using (user_id=auth.uid() and exists(select 1 from public.recipes r where r.id=recipe_id and r.user_id=auth.uid())) with check (user_id=auth.uid() and exists(select 1 from public.recipes r where r.id=recipe_id and r.user_id=auth.uid()))',t);
  end loop;
end $$;

drop policy if exists own_recipe_categories on public.recipe_categories;
create policy own_recipe_categories on public.recipe_categories for all to authenticated
using(user_id=auth.uid() and exists(select 1 from public.recipes r where r.id=recipe_id and r.user_id=auth.uid()) and exists(select 1 from public.categories c where c.id=category_id and c.user_id=auth.uid()))
with check(user_id=auth.uid() and exists(select 1 from public.recipes r where r.id=recipe_id and r.user_id=auth.uid()) and exists(select 1 from public.categories c where c.id=category_id and c.user_id=auth.uid()));
drop policy if exists own_recipe_tags on public.recipe_tags;
create policy own_recipe_tags on public.recipe_tags for all to authenticated
using(user_id=auth.uid() and exists(select 1 from public.recipes r where r.id=recipe_id and r.user_id=auth.uid()) and exists(select 1 from public.tags t where t.id=tag_id and t.user_id=auth.uid()))
with check(user_id=auth.uid() and exists(select 1 from public.recipes r where r.id=recipe_id and r.user_id=auth.uid()) and exists(select 1 from public.tags t where t.id=tag_id and t.user_id=auth.uid()));
drop policy if exists own_ocr_records on public.ocr_records;
create policy own_ocr_records on public.ocr_records for all to authenticated
using(user_id=auth.uid() and exists(select 1 from public.recipes r where r.id=recipe_id and r.user_id=auth.uid()) and exists(select 1 from public.images i where i.id=image_id and i.recipe_id=recipe_id and i.user_id=auth.uid()))
with check(user_id=auth.uid() and exists(select 1 from public.recipes r where r.id=recipe_id and r.user_id=auth.uid()) and exists(select 1 from public.images i where i.id=image_id and i.recipe_id=recipe_id and i.user_id=auth.uid()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('pourrecipe-images','pourrecipe-images',false,12582912,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists own_pourrecipe_images on storage.objects;
create policy own_pourrecipe_images on storage.objects for all to authenticated
using(bucket_id='pourrecipe-images' and (storage.foldername(name))[1]=auth.uid()::text)
with check(bucket_id='pourrecipe-images' and (storage.foldername(name))[1]=auth.uid()::text and (storage.foldername(name))[2]='recipes'
  and exists(select 1 from public.recipes r where r.id::text=(storage.foldername(name))[3] and r.user_id=auth.uid()));

create or replace function public.push_sync_change(p_change jsonb) returns jsonb language plpgsql security invoker set search_path=public as $$
declare u uuid:=auth.uid(); typ text:=p_change->>'objectType'; oid uuid:=(p_change->>'id')::uuid; base bigint:=coalesce((p_change->>'baseRevision')::bigint,0);
cur public.sync_changes%rowtype; rev bigint; payload jsonb:=coalesce(p_change->'data','{}'::jsonb); tomb timestamptz:=nullif(p_change->>'deletedAt','')::timestamptz;
item jsonb; ref text;
begin
 if u is null then raise exception 'authentication required'; end if;
 select * into cur from public.sync_changes where user_id=u and object_type=typ and object_id=oid order by cursor desc limit 1 for update;
 if found and cur.revision<>base then return jsonb_build_object('id',oid,'objectType',typ,'status','conflict','serverRevision',cur.revision,'serverData',cur.data); end if;
 rev:=coalesce(cur.revision,0)+1;
 if typ='recipe' then
  insert into public.recipes(id,user_id,data,revision,created_at,updated_at,deleted_at) values(oid,u,payload,rev,coalesce((payload->>'createdAt')::timestamptz,now()),now(),tomb)
  on conflict(id) do update set data=excluded.data,revision=excluded.revision,updated_at=now(),deleted_at=excluded.deleted_at where recipes.user_id=u;
  delete from public.recipe_ingredients where user_id=u and recipe_id=oid;
  for item in select value from jsonb_array_elements(coalesce(payload->'ingredients','[]'::jsonb)) loop
    insert into public.recipe_ingredients(id,user_id,recipe_id,data,revision,created_at,updated_at) values((item->>'id')::uuid,u,oid,item,rev,now(),now());
  end loop;
  delete from public.recipe_steps where user_id=u and recipe_id=oid;
  for item in select value from jsonb_array_elements(coalesce(payload->'steps','[]'::jsonb)) loop
    insert into public.recipe_steps(id,user_id,recipe_id,data,revision,created_at,updated_at) values((item->>'id')::uuid,u,oid,item,rev,now(),now());
  end loop;
  delete from public.recipe_categories where user_id=u and recipe_id=oid;
  for ref in select jsonb_array_elements_text(coalesce(payload->'categoryIds','[]'::jsonb)) loop
    insert into public.recipe_categories(user_id,recipe_id,category_id,revision) values(u,oid,ref::uuid,rev);
  end loop;
  delete from public.recipe_tags where user_id=u and recipe_id=oid;
  for ref in select jsonb_array_elements_text(coalesce(payload->'tagIds','[]'::jsonb)) loop
    insert into public.recipe_tags(user_id,recipe_id,tag_id,revision) values(u,oid,ref::uuid,rev);
  end loop;
 elsif typ='category' then
  insert into public.categories(id,user_id,data,revision,created_at,updated_at,deleted_at) values(oid,u,payload,rev,coalesce((payload->>'createdAt')::timestamptz,now()),now(),tomb)
  on conflict(id) do update set data=excluded.data,revision=excluded.revision,updated_at=now(),deleted_at=excluded.deleted_at where categories.user_id=u;
 elsif typ='tag' then
  insert into public.tags(id,user_id,data,revision,created_at,updated_at,deleted_at) values(oid,u,payload,rev,coalesce((payload->>'createdAt')::timestamptz,now()),now(),tomb)
  on conflict(id) do update set data=excluded.data,revision=excluded.revision,updated_at=now(),deleted_at=excluded.deleted_at where tags.user_id=u;
 elsif typ='cook_record' then
  insert into public.cook_records(id,user_id,recipe_id,data,revision,created_at,updated_at,deleted_at) values(oid,u,(payload->>'recipeId')::uuid,payload,rev,coalesce((payload->>'createdAt')::timestamptz,now()),now(),tomb)
  on conflict(id) do update set data=excluded.data,revision=excluded.revision,updated_at=now(),deleted_at=excluded.deleted_at where cook_records.user_id=u;
 elsif typ='image' then
  insert into public.images(id,user_id,recipe_id,data,revision,created_at,updated_at,deleted_at) values(oid,u,(payload->>'recipeId')::uuid,payload,rev,coalesce((payload->>'createdAt')::timestamptz,now()),now(),tomb)
  on conflict(id) do update set data=excluded.data,revision=excluded.revision,updated_at=now(),deleted_at=excluded.deleted_at where images.user_id=u;
 elsif typ='ocr_record' then
  insert into public.ocr_records(id,user_id,recipe_id,image_id,data,revision,created_at,updated_at,deleted_at) values(oid,u,(payload->>'recipeId')::uuid,(payload->>'imageId')::uuid,payload,rev,coalesce((payload->>'createdAt')::timestamptz,now()),now(),tomb)
  on conflict(id) do update set data=excluded.data,revision=excluded.revision,updated_at=now(),deleted_at=excluded.deleted_at where ocr_records.user_id=u;
 else raise exception 'unsupported object type'; end if;
 insert into public.sync_changes(user_id,object_type,object_id,revision,data,deleted_at) values(u,typ,oid,rev,payload,tomb);
 return jsonb_build_object('id',oid,'objectType',typ,'status','synced','serverRevision',rev);
end $$;

create or replace function public.pull_sync_changes(p_since bigint default 0) returns table(cursor bigint,"objectType" text,id uuid,revision bigint,"deletedAt" timestamptz,data jsonb)
language sql security invoker set search_path=public as $$ select s.cursor,s.object_type,s.object_id,s.revision,s.deleted_at,s.data from public.sync_changes s where s.user_id=auth.uid() and s.cursor>p_since order by s.cursor limit 1000 $$;
create or replace function public.permanently_delete_recipe(p_recipe_id uuid) returns jsonb language plpgsql security invoker set search_path=public as $$
begin
 if not exists(select 1 from public.recipes where id=p_recipe_id and user_id=auth.uid()) then raise exception 'not found'; end if;
 delete from public.sync_changes where user_id=auth.uid() and (object_id=p_recipe_id or (data->>'recipeId')::uuid=p_recipe_id);
 delete from public.recipes where id=p_recipe_id and user_id=auth.uid();
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.push_sync_change(jsonb) from public;
revoke all on function public.pull_sync_changes(bigint) from public;
revoke all on function public.permanently_delete_recipe(uuid) from public;
grant execute on function public.push_sync_change(jsonb),public.pull_sync_changes(bigint),public.permanently_delete_recipe(uuid) to authenticated;
grant select,insert,update,delete on table
  public.profiles,public.recipes,public.recipe_ingredients,public.recipe_steps,public.categories,public.tags,
  public.recipe_categories,public.recipe_tags,public.cook_records,public.images,public.ocr_records,public.sync_changes
to authenticated;
grant usage,select on sequence public.sync_changes_cursor_seq to authenticated;
commit;
