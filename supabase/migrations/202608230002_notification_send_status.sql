-- Allow a failed 7:30 AM send to be retried in the same Pacific window.

alter table public.notification_sends
  add column if not exists status text;

update public.notification_sends
  set status = 'sent'
  where status is null;

alter table public.notification_sends
  alter column status set default 'claimed';

alter table public.notification_sends
  alter column status set not null;

alter table public.notification_sends
  drop constraint if exists notification_sends_status_check;

alter table public.notification_sends
  add constraint notification_sends_status_check
  check (status in ('claimed', 'sent', 'failed'));
