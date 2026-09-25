create extension if not exists pgcrypto;

-- Run in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Auth users live in auth.users; application profile data lives in public.profiles.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null, last_name text not null, display_name text,
  email text, phone text, date_of_birth date, nationality text,
  preferred_language text default 'en', home_city text, home_country text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null, description text,
  status text not null default 'draft' check(status in ('draft','planned','active','completed','cancelled')),
  origin_city text, origin_country text, destination_city text, destination_country text,
  start_at timestamptz, end_at timestamptz, timezone text, trip_purpose text,
  priority_cost boolean not null default true, priority_time boolean not null default true,
  priority_existing_bookings boolean not null default true, priority_group_integrity boolean not null default true,
  monitor_disruptions boolean not null default true, monitoring_enabled_at timestamptz,
  currency_code char(3) not null default 'INR',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.trip_members (
  id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  first_name text not null, last_name text, email text, phone text,
  role text not null default 'traveler' check(role in ('owner','traveler','viewer')),
  is_primary_traveler boolean not null default false, is_emergency_contact boolean not null default false,
  date_of_birth date, nationality text, passport_last4 text, joined_at timestamptz default now(),
  unique(trip_id,user_id)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips(id) on delete cascade,
  booking_type text not null check(booking_type in ('flight','train','bus','hotel','cab','rental_car','activity','other')),
  provider_name text, provider_type text, external_booking_id text, confirmation_code text,
  status text not null default 'confirmed' check(status in ('pending','confirmed','delayed','cancelled','completed','refunded','unknown')),
  booked_at timestamptz, confirmed_at timestamptz,
  currency_code char(3) not null default 'INR', base_amount numeric(12,2) default 0,
  taxes numeric(12,2) default 0, fees numeric(12,2) default 0,
  total_amount numeric(12,2) generated always as(coalesce(base_amount,0)+coalesce(taxes,0)+coalesce(fees,0)) stored,
  refundable boolean default false, cancellation_deadline timestamptz, estimated_refund_amount numeric(12,2),
  origin_name text, origin_code text, destination_name text, destination_code text,
  departure_at timestamptz, arrival_at timestamptz, provider_metadata jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.booking_participants (
  booking_id uuid references public.bookings(id) on delete cascade,
  trip_member_id uuid references public.trip_members(id) on delete cascade,
  seat_or_room text, passenger_type text default 'adult', primary key(booking_id,trip_member_id)
);

create table if not exists public.itinerary_items (
  id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  item_type text not null check(item_type in ('flight','train','bus','hotel','cab','rental_car','activity','transfer','meal','free_time','other')),
  title text not null, description text, sequence_no integer not null,
  start_at timestamptz, end_at timestamptz, timezone text,
  origin_name text, origin_code text, origin_lat numeric(10,7), origin_lng numeric(10,7),
  destination_name text, destination_code text, destination_lat numeric(10,7), destination_lng numeric(10,7),
  address text, required_buffer_minutes integer default 0, minimum_connection_minutes integer default 0,
  status text not null default 'safe' check(status in ('safe','at_risk','affected','missed','resolved','unknown')),
  metadata jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(trip_id,sequence_no)
);

create table if not exists public.itinerary_participants (
  itinerary_item_id uuid references public.itinerary_items(id) on delete cascade,
  trip_member_id uuid references public.trip_members(id) on delete cascade,
  primary key(itinerary_item_id,trip_member_id)
);

-- This is the key graph table. NetworkX builds its graph from these rows.
create table if not exists public.trip_dependencies (
  id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips(id) on delete cascade,
  from_item_id uuid not null references public.itinerary_items(id) on delete cascade,
  to_item_id uuid not null references public.itinerary_items(id) on delete cascade,
  dependency_type text not null, minimum_buffer_minutes integer default 0,
  dependency_strength numeric(5,2) default 1.0 check(dependency_strength between 0 and 1),
  is_hard_dependency boolean not null default false, created_at timestamptz not null default now(),
  check(from_item_id <> to_item_id)
);

create table if not exists public.external_events (
  id uuid primary key default gen_random_uuid(), source_name text not null, source_event_id text,
  event_type text not null, title text not null, description text,
  severity text not null default 'info' check(severity in ('info','low','medium','high','critical')),
  starts_at timestamptz, ends_at timestamptz, location_name text, location_code text,
  latitude numeric(10,7), longitude numeric(10,7), affected_provider text, affected_service_code text,
  raw_payload jsonb not null default '{}', detected_at timestamptz not null default now(), created_at timestamptz not null default now(),
  unique(source_name,source_event_id)
);

create table if not exists public.disruptions (
  id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips(id) on delete cascade,
  external_event_id uuid references public.external_events(id) on delete set null,
  title text not null, description text, severity text not null default 'medium',
  detected_at timestamptz not null default now(), resolved_at timestamptz,
  source_confidence numeric(5,2) check(source_confidence is null or source_confidence between 0 and 1),
  metadata jsonb not null default '{}'
);

create table if not exists public.disruption_impacts (
  id uuid primary key default gen_random_uuid(), disruption_id uuid not null references public.disruptions(id) on delete cascade,
  itinerary_item_id uuid not null references public.itinerary_items(id) on delete cascade,
  trip_member_id uuid references public.trip_members(id) on delete set null,
  status text not null, impact_score numeric(8,3), delay_minutes integer, reason text,
  affected_deadline_at timestamptz, calculated_at timestamptz not null default now(), details jsonb not null default '{}',
  unique(disruption_id,itinerary_item_id,trip_member_id)
);

create table if not exists public.deadlines (
  id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips(id) on delete cascade,
  itinerary_item_id uuid references public.itinerary_items(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  deadline_type text not null, title text not null, deadline_at timestamptz not null,
  warning_minutes integer default 60, completed boolean not null default false, completed_at timestamptz
);

create table if not exists public.recovery_options (
  id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips(id) on delete cascade,
  disruption_id uuid references public.disruptions(id) on delete cascade, title text not null, description text,
  strategy_type text not null, additional_cost numeric(12,2) default 0, currency_code char(3) not null default 'INR',
  additional_time_minutes integer default 0, refund_amount numeric(12,2) default 0,
  convenience_score numeric(5,2), risk_score numeric(5,2), preserves_hotel boolean default false,
  preserves_transport boolean default false, preserves_group_integrity boolean default false,
  resulting_itinerary jsonb not null default '[]', ai_explanation text,
  status text default 'proposed', created_at timestamptz not null default now()
);

create table if not exists public.trip_change_proposals (
  id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade, title text not null, reason text,
  proposed_changes jsonb not null default '[]', estimated_cost_delta numeric(12,2) default 0,
  estimated_time_delta_minutes integer default 0, impact_summary jsonb not null default '{}',
  status text not null default 'draft', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null default 'Trip Budget', currency_code char(3) not null default 'INR',
  total_budget numeric(12,2) not null default 0 check(total_budget>=0),
  disruption_reserve numeric(12,2) not null default 0 check(disruption_reserve>=0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(trip_id,name)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips(id) on delete cascade,
  budget_id uuid references public.budgets(id) on delete set null, paid_by_member_id uuid references public.trip_members(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null, recovery_option_id uuid references public.recovery_options(id) on delete set null,
  category text not null default 'other', description text not null, amount numeric(12,2) not null check(amount>=0),
  currency_code char(3) not null default 'INR', expense_at timestamptz not null default now(), receipt_document_id uuid
);

create table if not exists public.expense_splits (
  expense_id uuid references public.expenses(id) on delete cascade, trip_member_id uuid references public.trip_members(id) on delete cascade,
  share_amount numeric(12,2) not null check(share_amount>=0), settled boolean not null default false, settled_at timestamptz,
  primary key(expense_id,trip_member_id)
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade, booking_id uuid references public.bookings(id) on delete set null,
  trip_member_id uuid references public.trip_members(id) on delete set null, document_type text not null,
  file_name text not null, mime_type text, file_size_bytes bigint, storage_bucket text not null default 'trip-documents',
  storage_path text not null, is_sensitive boolean not null default false, is_available_offline boolean not null default false,
  expires_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

alter table public.expenses drop constraint if exists expenses_receipt_document_fk;
alter table public.expenses add constraint expenses_receipt_document_fk foreign key(receipt_document_id) references public.documents(id) on delete set null;

create table if not exists public.emergency_contacts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null, relationship text, phone text not null, email text, is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.trip_emergency_contacts (
  trip_id uuid references public.trips(id) on delete cascade, emergency_contact_id uuid references public.emergency_contacts(id) on delete cascade,
  priority integer not null default 1, primary key(trip_id,emergency_contact_id)
);

create table if not exists public.location_snapshots (
  id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips(id) on delete cascade,
  trip_member_id uuid references public.trip_members(id) on delete set null, latitude numeric(10,7) not null, longitude numeric(10,7) not null,
  accuracy_meters numeric(10,2), captured_at timestamptz not null default now(), reason text default 'sos'
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), trip_id uuid references public.trips(id) on delete cascade,
  recipient_user_id uuid references public.profiles(id) on delete cascade, notification_type text not null,
  title text not null, message text not null, severity text default 'info', read_at timestamptz,
  created_at timestamptz not null default now(), metadata jsonb not null default '{}'
);

create table if not exists public.trip_monitoring (
  trip_id uuid primary key references public.trips(id) on delete cascade, last_checked_at timestamptz,
  last_successful_sync_at timestamptz, monitoring_status text not null default 'active', last_error text,
  last_known_trip_health text default 'safe', updated_at timestamptz not null default now()
);

create table if not exists public.trip_activity (
  id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null, activity_type text not null,
  title text not null, description text, entity_type text, entity_id uuid, created_at timestamptz not null default now(), metadata jsonb not null default '{}'
);

create index if not exists idx_trips_owner on public.trips(owner_id);
create index if not exists idx_members_trip on public.trip_members(trip_id);
create index if not exists idx_bookings_trip on public.bookings(trip_id);
create index if not exists idx_itinerary_trip_seq on public.itinerary_items(trip_id,sequence_no);
create index if not exists idx_dependencies_trip on public.trip_dependencies(trip_id);
create index if not exists idx_disruptions_trip on public.disruptions(trip_id);
create index if not exists idx_impacts_disruption on public.disruption_impacts(disruption_id);
create index if not exists idx_expenses_trip on public.expenses(trip_id);
create index if not exists idx_documents_trip on public.documents(trip_id);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;

-- Helper functions used by RLS.
create or replace function public.user_has_trip_access(p_trip_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.trips where id=p_trip_id and owner_id=auth.uid())
      or exists(select 1 from public.trip_members where trip_id=p_trip_id and user_id=auth.uid());
$$;

create or replace function public.user_owns_trip(p_trip_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.trips where id=p_trip_id and owner_id=auth.uid());
$$;

-- Profile auto-created after Auth signup.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,first_name,last_name,display_name,email,phone)
  values(new.id,coalesce(new.raw_user_meta_data->>'first_name',''),coalesce(new.raw_user_meta_data->>'last_name',''),
         coalesce(new.raw_user_meta_data->>'display_name',new.raw_user_meta_data->>'full_name',''),new.email,new.phone)
  on conflict(id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- RLS: users see their own profile; trip members see trip data; owners manage trip structure.
alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_participants enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.itinerary_participants enable row level security;
alter table public.trip_dependencies enable row level security;
alter table public.external_events enable row level security;
alter table public.disruptions enable row level security;
alter table public.disruption_impacts enable row level security;
alter table public.deadlines enable row level security;
alter table public.recovery_options enable row level security;
alter table public.trip_change_proposals enable row level security;
alter table public.budgets enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.documents enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.trip_emergency_contacts enable row level security;
alter table public.location_snapshots enable row level security;
alter table public.notifications enable row level security;
alter table public.trip_monitoring enable row level security;
alter table public.trip_activity enable row level security;

create policy profile_self on public.profiles for all to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy trip_access on public.trips for select to authenticated using(public.user_has_trip_access(id));
create policy trip_insert on public.trips for insert to authenticated with check(owner_id=auth.uid());
create policy trip_owner_update on public.trips for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy trip_owner_delete on public.trips for delete to authenticated using(owner_id=auth.uid());

create policy members_access on public.trip_members for select to authenticated using(public.user_has_trip_access(trip_id));
create policy members_owner on public.trip_members for all to authenticated using(public.user_owns_trip(trip_id)) with check(public.user_owns_trip(trip_id));

create policy bookings_access on public.bookings for select to authenticated using(public.user_has_trip_access(trip_id));
create policy bookings_owner on public.bookings for all to authenticated using(public.user_owns_trip(trip_id)) with check(public.user_owns_trip(trip_id));

create policy itinerary_access on public.itinerary_items for select to authenticated using(public.user_has_trip_access(trip_id));
create policy itinerary_owner on public.itinerary_items for all to authenticated using(public.user_owns_trip(trip_id)) with check(public.user_owns_trip(trip_id));

create policy deps_access on public.trip_dependencies for select to authenticated using(public.user_has_trip_access(trip_id));
create policy deps_owner on public.trip_dependencies for all to authenticated using(public.user_owns_trip(trip_id)) with check(public.user_owns_trip(trip_id));

create policy events_read on public.external_events for select to authenticated using(true);
create policy disruptions_access on public.disruptions for select to authenticated using(public.user_has_trip_access(trip_id));
create policy disruptions_owner on public.disruptions for all to authenticated using(public.user_owns_trip(trip_id)) with check(public.user_owns_trip(trip_id));

create policy impacts_access on public.disruption_impacts for select to authenticated using(exists(select 1 from public.disruptions d where d.id=disruption_id and public.user_has_trip_access(d.trip_id)));
create policy impacts_owner on public.disruption_impacts for all to authenticated using(exists(select 1 from public.disruptions d where d.id=disruption_id and public.user_owns_trip(d.trip_id))) with check(exists(select 1 from public.disruptions d where d.id=disruption_id and public.user_owns_trip(d.trip_id)));

create policy deadlines_access on public.deadlines for select to authenticated using(public.user_has_trip_access(trip_id));
create policy deadlines_owner on public.deadlines for all to authenticated using(public.user_owns_trip(trip_id)) with check(public.user_owns_trip(trip_id));
create policy recovery_access on public.recovery_options for select to authenticated using(public.user_has_trip_access(trip_id));
create policy recovery_owner on public.recovery_options for all to authenticated using(public.user_owns_trip(trip_id)) with check(public.user_owns_trip(trip_id));

create policy proposals_access on public.trip_change_proposals for select to authenticated using(public.user_has_trip_access(trip_id));
create policy proposals_create on public.trip_change_proposals for insert to authenticated with check(created_by=auth.uid() and public.user_has_trip_access(trip_id));
create policy proposals_update on public.trip_change_proposals for update to authenticated using(created_by=auth.uid()) with check(created_by=auth.uid());

create policy budgets_access on public.budgets for select to authenticated using(public.user_has_trip_access(trip_id));
create policy budgets_owner on public.budgets for all to authenticated using(public.user_owns_trip(trip_id)) with check(public.user_owns_trip(trip_id));
create policy expenses_access on public.expenses for select to authenticated using(public.user_has_trip_access(trip_id));
create policy expenses_insert on public.expenses for insert to authenticated with check(public.user_has_trip_access(trip_id));
create policy expenses_update on public.expenses for update to authenticated using(public.user_has_trip_access(trip_id)) with check(public.user_has_trip_access(trip_id));
create policy expenses_delete on public.expenses for delete to authenticated using(public.user_has_trip_access(trip_id));

create policy documents_access on public.documents for select to authenticated using(public.user_has_trip_access(trip_id));
create policy documents_insert on public.documents for insert to authenticated with check(uploaded_by=auth.uid() and public.user_has_trip_access(trip_id));
create policy documents_update on public.documents for update to authenticated using(uploaded_by=auth.uid()) with check(uploaded_by=auth.uid());
create policy documents_delete on public.documents for delete to authenticated using(uploaded_by=auth.uid());

create policy contacts_self on public.emergency_contacts for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy trip_contacts_access on public.trip_emergency_contacts for select to authenticated using(public.user_has_trip_access(trip_id));
create policy trip_contacts_owner on public.trip_emergency_contacts for all to authenticated using(public.user_owns_trip(trip_id)) with check(public.user_owns_trip(trip_id));

create policy location_access on public.location_snapshots for select to authenticated using(public.user_has_trip_access(trip_id));
create policy location_insert on public.location_snapshots for insert to authenticated with check(public.user_has_trip_access(trip_id));
create policy notification_read on public.notifications for select to authenticated using(recipient_user_id=auth.uid());
create policy notification_update on public.notifications for update to authenticated using(recipient_user_id=auth.uid()) with check(recipient_user_id=auth.uid());
create policy monitoring_access on public.trip_monitoring for select to authenticated using(public.user_has_trip_access(trip_id));
create policy monitoring_owner on public.trip_monitoring for all to authenticated using(public.user_owns_trip(trip_id)) with check(public.user_owns_trip(trip_id));
create policy activity_access on public.trip_activity for select to authenticated using(public.user_has_trip_access(trip_id));

-- Private document bucket. Files are NOT stored in Postgres rows.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('trip-documents','trip-documents',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;

-- Path convention: trip-documents/<trip_id>/<user_id>/<filename>
create policy trip_documents_read on storage.objects for select to authenticated using(
  bucket_id='trip-documents' and public.user_has_trip_access((split_part(name,'/',1))::uuid)
);
create policy trip_documents_insert on storage.objects for insert to authenticated with check(
  bucket_id='trip-documents' and public.user_has_trip_access((split_part(name,'/',1))::uuid)
);
create policy trip_documents_update on storage.objects for update to authenticated using(
  bucket_id='trip-documents' and public.user_has_trip_access((split_part(name,'/',1))::uuid)
) with check(
  bucket_id='trip-documents' and public.user_has_trip_access((split_part(name,'/',1))::uuid)
);
create policy trip_documents_delete on storage.objects for delete to authenticated using(
  bucket_id='trip-documents' and public.user_has_trip_access((split_part(name,'/',1))::uuid)
);

-- Useful dashboard view.
create or replace view public.trip_health_summary with (security_invoker=true) as
select t.id trip_id,t.name,t.status,
       count(distinct di.id) filter(where di.status='affected') affected_items,
       count(distinct di.id) filter(where di.status='at_risk') at_risk_items,
       count(distinct d.id) filter(where d.severity in('high','critical') and d.resolved_at is null) active_major_disruptions,
       coalesce((select sum(e.amount) from public.expenses e where e.trip_id=t.id),0) total_expenses,
       coalesce(b.total_budget,0) total_budget,coalesce(b.disruption_reserve,0) disruption_reserve
from public.trips t left join public.disruptions d on d.trip_id=t.id left join public.disruption_impacts di on di.disruption_id=d.id
left join public.budgets b on b.trip_id=t.id group by t.id,t.name,t.status,b.total_budget,b.disruption_reserve;
