-- Morning notification preferences and send idempotency

alter table public.profiles
  add column if not exists notifications_enabled boolean not null default false;

alter table public.profiles
  add column if not exists notification_mode text not null default 'favorites_only';

alter table public.profiles
  drop constraint if exists profiles_notification_mode_check;

alter table public.profiles
  add constraint profiles_notification_mode_check
  check (notification_mode in ('favorites_only', 'always'));

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create table if not exists public.notification_sends (
  user_id uuid not null references auth.users (id) on delete cascade,
  send_date date not null,
  kind text not null default 'daily_digest',
  created_at timestamptz not null default now(),
  primary key (user_id, send_date, kind)
);

create index if not exists notification_sends_send_date_idx
  on public.notification_sends (send_date);

alter table public.notification_sends enable row level security;
