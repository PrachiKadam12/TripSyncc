-- ==============================================================================
-- TripSync Notification Schema Migration (Phase 2 - IndexedDB & Supabase Sync)
-- ==============================================================================
-- Scope: ONLY the 4 approved notification events:
--   1. group_invitation
--   2. member_response
--   3. passport_expiry
--   4. insurance_expiry
--
-- Row Level Security (RLS) ensures a user can ONLY access their own notifications.
-- ==============================================================================

-- 1. Ensure table exists with conceptual fields
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  recipient_user_id uuid references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('group_invitation', 'member_response', 'passport_expiry', 'insurance_expiry')),
  notification_type text,
  title text not null,
  message text not null,
  related_id text,
  related_type text,
  channels jsonb not null default '{"in_app": true, "sms": false, "whatsapp": false}'::jsonb,
  read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

-- 2. Safely add columns if the table already existed with older columns
alter table public.notifications add column if not exists user_id uuid references public.profiles(id) on delete cascade;
alter table public.notifications add column if not exists recipient_user_id uuid references public.profiles(id) on delete cascade;
alter table public.notifications add column if not exists event_type text;
alter table public.notifications add column if not exists notification_type text;
alter table public.notifications add column if not exists title text;
alter table public.notifications add column if not exists message text;
alter table public.notifications add column if not exists related_id text;
alter table public.notifications add column if not exists related_type text;
alter table public.notifications add column if not exists channels jsonb default '{"in_app": true, "sms": false, "whatsapp": false}'::jsonb;
alter table public.notifications add column if not exists read boolean default false;
alter table public.notifications add column if not exists read_at timestamptz;
alter table public.notifications add column if not exists created_at timestamptz default now();
alter table public.notifications add column if not exists updated_at timestamptz default now();
alter table public.notifications add column if not exists expires_at timestamptz;
alter table public.notifications add column if not exists metadata jsonb default '{}'::jsonb;

-- 3. Synchronize aliases
update public.notifications 
set user_id = recipient_user_id 
where user_id is null and recipient_user_id is not null;

update public.notifications 
set recipient_user_id = user_id 
where recipient_user_id is null and user_id is not null;

update public.notifications 
set event_type = notification_type 
where event_type is null and notification_type is not null;

update public.notifications 
set read = (read_at is not null) 
where read is null;

-- 4. Fast Query Indexes
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_recipient_id on public.notifications(recipient_user_id);
create index if not exists idx_notifications_event_type on public.notifications(event_type);
create index if not exists idx_notifications_read on public.notifications(read);
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);

-- 5. Row Level Security (Strict isolation per user)
alter table public.notifications enable row level security;

-- Read policy: only recipient / owner
drop policy if exists notification_read on public.notifications;
drop policy if exists notification_select_policy on public.notifications;
create policy notification_select_policy on public.notifications
  for select to authenticated
  using (user_id = auth.uid() or recipient_user_id = auth.uid());

-- Insert policy: authenticated user can only insert for their own user_id
drop policy if exists notification_insert_policy on public.notifications;
create policy notification_insert_policy on public.notifications
  for insert to authenticated
  with check (user_id = auth.uid() or recipient_user_id = auth.uid());

-- Update policy: authenticated user can update (e.g. mark read) their own notifications
drop policy if exists notification_update on public.notifications;
drop policy if exists notification_update_policy on public.notifications;
create policy notification_update_policy on public.notifications
  for update to authenticated
  using (user_id = auth.uid() or recipient_user_id = auth.uid())
  with check (user_id = auth.uid() or recipient_user_id = auth.uid());

-- Delete policy: authenticated user can delete their own notifications
drop policy if exists notification_delete_policy on public.notifications;
create policy notification_delete_policy on public.notifications
  for delete to authenticated
  using (user_id = auth.uid() or recipient_user_id = auth.uid());
