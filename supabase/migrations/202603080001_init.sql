-- Profiles linked to Supabase Auth users
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Favorite foods
create table if not exists public.favorite_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  food_name text not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, food_name)
);

create index if not exists favorite_foods_user_id_idx on public.favorite_foods (user_id);

alter table public.favorite_foods enable row level security;

create policy "Users manage own favorites select"
  on public.favorite_foods for select
  using (auth.uid() = user_id);

create policy "Users manage own favorites insert"
  on public.favorite_foods for insert
  with check (auth.uid() = user_id);

create policy "Users manage own favorites delete"
  on public.favorite_foods for delete
  using (auth.uid() = user_id);

-- Push tokens
create table if not exists public.push_tokens (
  user_id uuid not null references auth.users (id) on delete cascade,
  expo_push_token text primary key,
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

create policy "Users manage own push tokens select"
  on public.push_tokens for select
  using (auth.uid() = user_id);

create policy "Users manage own push tokens insert"
  on public.push_tokens for insert
  with check (auth.uid() = user_id);

create policy "Users manage own push tokens update"
  on public.push_tokens for update
  using (auth.uid() = user_id);

create policy "Users manage own push tokens delete"
  on public.push_tokens for delete
  using (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Storage bucket for menu JSON (run via Supabase dashboard or storage API)
-- insert into storage.buckets (id, name, public) values ('menus', 'menus', true);
