create extension if not exists pgcrypto;

create table public.space_settings (
  id int primary key default 1,
  passcode_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);
insert into public.space_settings (id) values (1) on conflict do nothing;

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  storage_path text,
  caption text not null,
  liked boolean not null default false,
  created_at timestamptz not null default now()
);
create index memories_created_at_idx on public.memories (created_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender text not null check (sender in ('me','meiso')),
  text text not null,
  status text not null default 'sent' check (status in ('sent','delivered','read')),
  created_at timestamptz not null default now()
);
create index messages_created_at_idx on public.messages (created_at asc);

alter table public.space_settings enable row level security;
alter table public.memories enable row level security;
alter table public.messages enable row level security;

create policy "Realtime read memories"
  on public.memories for select to anon, authenticated using (true);

create policy "Realtime read messages"
  on public.messages for select to anon, authenticated using (true);

alter publication supabase_realtime add table public.memories;
alter publication supabase_realtime add table public.messages;
alter table public.memories replica identity full;
alter table public.messages replica identity full;

insert into storage.buckets (id, name, public)
values ('memories', 'memories', true)
on conflict (id) do nothing;

create policy "Read memory photos by path"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'memories' and name is not null and length(name) > 0);