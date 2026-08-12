-- Public read access for menu JSON files; writes use service role from Vercel cron.
insert into storage.buckets (id, name, public)
values ('menus', 'menus', true)
on conflict (id) do update set public = true;

create policy "Public read menus bucket"
  on storage.objects for select
  using (bucket_id = 'menus');
