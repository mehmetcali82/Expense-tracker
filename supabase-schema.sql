-- Run in the Supabase SQL Editor to add the marketplace schema.
-- Existing expense tables and records are not dropped by this script.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  account_type text not null check (account_type in ('driver', 'broker')),
  full_name text not null,
  company_name text,
  phone text,
  email text not null,
  broker_approved boolean not null default false,
  created_at timestamptz not null default now(),
  check (account_type <> 'broker' or nullif(btrim(company_name), '') is not null)
);

create or replace function public.handle_new_marketplace_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_company_name text := nullif(btrim(new.raw_user_meta_data ->> 'company_name'), '');
  v_account_type text;
begin
  v_account_type := case
    when new.raw_user_meta_data ->> 'account_type' = 'broker'
      and v_company_name is not null then 'broker'
    else 'driver'
  end;

  insert into public.profiles (
    id,
    account_type,
    full_name,
    company_name,
    phone,
    email
  )
  values (
    new.id,
    v_account_type,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'User'
    ),
    v_company_name,
    nullif(btrim(new.raw_user_meta_data ->> 'phone'), ''),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;

drop trigger if exists on_auth_user_created_marketplace on auth.users;
create trigger on_auth_user_created_marketplace
  after insert on auth.users
  for each row execute function public.handle_new_marketplace_user();

insert into public.profiles (id, account_type, full_name, company_name, phone, email)
select
  users.id,
  case
    when users.raw_user_meta_data ->> 'account_type' = 'broker'
      and nullif(btrim(users.raw_user_meta_data ->> 'company_name'), '') is not null then 'broker'
    else 'driver'
  end,
  coalesce(
    nullif(btrim(users.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
    'User'
  ),
  nullif(btrim(users.raw_user_meta_data ->> 'company_name'), ''),
  nullif(btrim(users.raw_user_meta_data ->> 'phone'), ''),
  coalesce(users.email, '')
from auth.users as users
on conflict (id) do nothing;

create table if not exists public.loads (
  id uuid primary key default gen_random_uuid(),
  broker_id uuid not null references public.profiles (id) on delete restrict,
  broker_company text not null,
  origin_city text not null,
  origin_state text not null,
  destination_city text not null,
  destination_state text not null,
  pickup_date date not null,
  delivery_date date not null,
  equipment_type text not null,
  weight_lbs integer check (weight_lbs is null or weight_lbs > 0),
  commodity text not null,
  miles integer not null check (miles > 0),
  rate numeric(12, 2) not null check (rate > 0),
  public_notes text,
  status text not null default 'open'
    check (status in ('open', 'booked', 'in_transit', 'delivered', 'cancelled')),
  booked_by uuid references public.profiles (id) on delete set null,
  expired_at timestamptz,
  created_at timestamptz not null default now(),
  check (delivery_date >= pickup_date),
  check (char_length(btrim(origin_city)) > 0),
  check (char_length(btrim(destination_city)) > 0),
  check (char_length(btrim(origin_state)) between 2 and 40),
  check (char_length(btrim(destination_state)) between 2 and 40),
  check (char_length(btrim(equipment_type)) > 0),
  check (char_length(btrim(commodity)) > 0),
  check (
    (status in ('open', 'cancelled') and booked_by is null)
    or (status in ('booked', 'in_transit', 'delivered') and booked_by is not null)
  )
);

create table if not exists public.load_private_details (
  load_id uuid primary key references public.loads (id) on delete cascade,
  pickup_address text not null,
  delivery_address text not null,
  broker_contact_name text not null,
  broker_contact_phone text,
  broker_contact_email text not null,
  instructions text,
  check (char_length(btrim(pickup_address)) > 0),
  check (char_length(btrim(delivery_address)) > 0)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  load_id uuid not null references public.loads (id) on delete cascade,
  driver_id uuid not null references public.profiles (id) on delete restrict,
  driver_name text not null,
  driver_phone text,
  driver_email text not null,
  status text not null default 'booked'
    check (status in ('booked', 'in_transit', 'delivered', 'cancelled')),
  created_at timestamptz not null default now()
);

alter table public.loads add column if not exists expired_at timestamptz;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  load_id uuid references public.loads (id) on delete set null,
  title text not null,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create unique index if not exists bookings_one_active_per_load
  on public.bookings (load_id)
  where status in ('booked', 'in_transit');
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists loads_available_pickup_idx
  on public.loads (pickup_date, created_at)
  where status = 'open';
create index if not exists loads_broker_created_idx
  on public.loads (broker_id, created_at desc);
create index if not exists loads_booked_by_idx
  on public.loads (booked_by, created_at desc)
  where booked_by is not null;
create index if not exists bookings_driver_created_idx
  on public.bookings (driver_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.loads enable row level security;
alter table public.load_private_details enable row level security;
alter table public.bookings enable row level security;
alter table public.notifications enable row level security;

revoke all on public.profiles, public.loads, public.load_private_details, public.bookings, public.notifications
  from anon, authenticated;
grant select on public.profiles, public.loads, public.load_private_details, public.bookings, public.notifications
  to authenticated;

drop policy if exists "Users read their own marketplace profile" on public.profiles;
create policy "Users read their own marketplace profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "Authenticated users browse open or related loads" on public.loads;
create policy "Authenticated users browse open or related loads"
  on public.loads for select to authenticated
  using (
    status = 'open'
    or broker_id = (select auth.uid())
    or booked_by = (select auth.uid())
  );

drop policy if exists "Brokers and assigned drivers read private load details" on public.load_private_details;
create policy "Brokers and assigned drivers read private load details"
  on public.load_private_details for select to authenticated
  using (
    exists (
      select 1
      from public.loads as load
      where load.id = load_id
        and (load.broker_id = (select auth.uid()) or load.booked_by = (select auth.uid()))
    )
  );

drop policy if exists "Drivers and load owners read bookings" on public.bookings;
create policy "Drivers and load owners read bookings"
  on public.bookings for select to authenticated
  using (
    driver_id = (select auth.uid())
    or exists (
      select 1
      from public.loads as load
      where load.id = load_id
        and load.broker_id = (select auth.uid())
    )
  );

drop policy if exists "Users read their own notifications" on public.notifications;
create policy "Users read their own notifications"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.create_load(
  p_origin_city text,
  p_origin_state text,
  p_destination_city text,
  p_destination_state text,
  p_pickup_date date,
  p_delivery_date date,
  p_equipment_type text,
  p_weight_lbs integer,
  p_commodity text,
  p_miles integer,
  p_rate numeric,
  p_public_notes text,
  p_pickup_address text,
  p_delivery_address text,
  p_instructions text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_profile public.profiles%rowtype;
  v_load_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to post a load.';
  end if;

  select * into v_profile
  from public.profiles
  where id = auth.uid();

  if not found or v_profile.account_type <> 'broker' or not v_profile.broker_approved then
    raise exception 'A verified broker account is required to post loads.';
  end if;

  if nullif(btrim(v_profile.company_name), '') is null then
    raise exception 'Add a company name before posting a load.';
  end if;

  if p_pickup_date is null or p_delivery_date is null or p_delivery_date < p_pickup_date then
    raise exception 'Delivery date must be on or after pickup date.';
  end if;

  if p_miles is null or p_miles <= 0 or p_rate is null or p_rate <= 0 then
    raise exception 'Enter positive mileage and a positive load rate.';
  end if;

  insert into public.loads (
    broker_id,
    broker_company,
    origin_city,
    origin_state,
    destination_city,
    destination_state,
    pickup_date,
    delivery_date,
    equipment_type,
    weight_lbs,
    commodity,
    miles,
    rate,
    public_notes
  )
  values (
    auth.uid(),
    v_profile.company_name,
    btrim(p_origin_city),
    btrim(p_origin_state),
    btrim(p_destination_city),
    btrim(p_destination_state),
    p_pickup_date,
    p_delivery_date,
    btrim(p_equipment_type),
    p_weight_lbs,
    btrim(p_commodity),
    p_miles,
    p_rate,
    nullif(btrim(p_public_notes), '')
  )
  returning id into v_load_id;

  insert into public.load_private_details (
    load_id,
    pickup_address,
    delivery_address,
    broker_contact_name,
    broker_contact_phone,
    broker_contact_email,
    instructions
  )
  values (
    v_load_id,
    btrim(p_pickup_address),
    btrim(p_delivery_address),
    v_profile.full_name,
    v_profile.phone,
    v_profile.email,
    nullif(btrim(p_instructions), '')
  );

  return v_load_id;
end;
$function$;

create or replace function public.book_load(p_load_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_profile public.profiles%rowtype;
  v_load public.loads%rowtype;
  v_booking_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to book a load.';
  end if;

  select * into v_profile
  from public.profiles
  where id = auth.uid();

  if not found or v_profile.account_type <> 'driver' then
    raise exception 'Only driver accounts can book loads.';
  end if;

  select * into v_load
  from public.loads
  where id = p_load_id
    and status = 'open'
    and pickup_date >= current_date
  for update;

  if not found then
    raise exception 'This load is no longer available.';
  end if;

  update public.loads
  set status = 'booked', booked_by = auth.uid()
  where id = p_load_id and status = 'open';

  if not found then
    raise exception 'This load is no longer available.';
  end if;

  insert into public.bookings (
    load_id,
    driver_id,
    driver_name,
    driver_phone,
    driver_email
  )
  values (
    p_load_id,
    auth.uid(),
    v_profile.full_name,
    v_profile.phone,
    v_profile.email
  )
  returning id into v_booking_id;

  insert into public.notifications (user_id, load_id, title, message)
  values
    (
      v_load.broker_id,
      p_load_id,
      'Load booked',
      format('%s → %s was booked by %s.', v_load.origin_city, v_load.destination_city, v_profile.full_name)
    ),
    (
      auth.uid(),
      p_load_id,
      'Booking confirmed',
      format('You booked the load from %s to %s.', v_load.origin_city, v_load.destination_city)
    );

  return v_booking_id;
end;
$function$;

create or replace function public.set_load_status(
  p_load_id uuid,
  p_new_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_load public.loads%rowtype;
  v_driver_name text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to update a load.';
  end if;

  select * into v_load
  from public.loads
  where id = p_load_id
  for update;

  if not found then
    raise exception 'Load not found.';
  end if;

  if v_load.broker_id = auth.uid()
    and v_load.status = 'open'
    and p_new_status = 'cancelled' then
    update public.loads
    set status = 'cancelled'
    where id = p_load_id;
    return;
  end if;

  if v_load.booked_by = auth.uid()
    and v_load.status = 'booked'
    and p_new_status = 'open' then
    update public.bookings
    set status = 'cancelled'
    where load_id = p_load_id and driver_id = auth.uid() and status = 'booked';
    if not found then
      raise exception 'Active booking not found.';
    end if;
    update public.loads
    set status = 'open', booked_by = null
    where id = p_load_id;
    insert into public.notifications (user_id, load_id, title, message)
    values (
      v_load.broker_id,
      p_load_id,
      'Booking cancelled',
      format('The driver cancelled the booking for %s → %s.', v_load.origin_city, v_load.destination_city)
    );
    return;
  end if;

  if v_load.booked_by = auth.uid()
    and (
      (v_load.status = 'booked' and p_new_status = 'in_transit')
      or (v_load.status = 'in_transit' and p_new_status = 'delivered')
    ) then
    update public.bookings
    set status = p_new_status
    where load_id = p_load_id and driver_id = auth.uid() and status = v_load.status;
    if not found then
      raise exception 'Active booking not found.';
    end if;
    select driver_name into v_driver_name
    from public.bookings
    where load_id = p_load_id and driver_id = auth.uid();
    update public.loads
    set status = p_new_status
    where id = p_load_id;
    insert into public.notifications (user_id, load_id, title, message)
    values (
      v_load.broker_id,
      p_load_id,
      case when p_new_status = 'in_transit' then 'Load picked up' else 'Load delivered' end,
      format(
        '%s updated the load from %s to %s.',
        v_driver_name,
        format('%s, %s', v_load.origin_city, v_load.origin_state),
        format('%s, %s', v_load.destination_city, v_load.destination_state)
      )
    );
    return;
  end if;

  raise exception 'That status change is not allowed.';
end;
$function$;

create or replace function public.expire_open_loads()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_expired record;
  v_expired_count integer := 0;
begin
  for v_expired in
    update public.loads
    set status = 'cancelled', expired_at = now()
    where status = 'open'
      and pickup_date < current_date
    returning id, broker_id, origin_city, origin_state, destination_city, destination_state
  loop
    insert into public.notifications (user_id, load_id, title, message)
    values (
      v_expired.broker_id,
      v_expired.id,
      'Load expired',
      format(
        'The unbooked load from %s, %s to %s, %s expired after its pickup date.',
        v_expired.origin_city,
        v_expired.origin_state,
        v_expired.destination_city,
        v_expired.destination_state
      )
    );
    v_expired_count := v_expired_count + 1;
  end loop;

  return v_expired_count;
end;
$function$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Sign in to update notifications.';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id and user_id = auth.uid();

  if not found then
    raise exception 'Notification not found.';
  end if;
end;
$function$;

revoke all on function public.handle_new_marketplace_user() from public, anon, authenticated;
revoke all on function public.create_load(text, text, text, text, date, date, text, integer, text, integer, numeric, text, text, text, text)
  from public, anon;
revoke all on function public.book_load(uuid) from public, anon;
revoke all on function public.set_load_status(uuid, text) from public, anon;
revoke all on function public.expire_open_loads() from public, anon, authenticated;
revoke all on function public.mark_notification_read(uuid) from public, anon;
grant execute on function public.create_load(text, text, text, text, date, date, text, integer, text, integer, numeric, text, text, text, text)
  to authenticated;
grant execute on function public.book_load(uuid) to authenticated;
grant execute on function public.set_load_status(uuid, text) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;

-- After verifying a broker outside the app, approve them from the SQL Editor:
-- update public.profiles set broker_approved = true where id = '<auth.users.id>';
