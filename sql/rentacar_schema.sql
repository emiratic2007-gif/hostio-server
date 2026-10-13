-- Hostio: rent-a-car šablon (vozila, zahtjevi za najam, postavke agencije, privatne vozačke dozvole).

alter table businesses add column if not exists template text not null default 'salon'
  check (template in ('salon', 'rentacar'));
alter table businesses add column if not exists settings jsonb not null default '{}'::jsonb;

create table if not exists rc_vehicles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  active boolean not null default true,
  featured boolean not null default false,
  sort int not null default 0,
  make text not null,
  model text not null,
  year int,
  category text not null,                -- mali, kompakt, srednji, suv, kombi, premium
  body text not null default 'hatch',     -- hatch, sedan, karavan, suv, kombi (za ilustraciju)
  color text not null default '#c9ced6',  -- boja ilustracije dok agencija ne ubaci fotografije
  transmission text not null check (transmission in ('manual', 'automatic')),
  fuel text not null check (fuel in ('benzin', 'dizel', 'hibrid', 'elektro')),
  seats int not null check (seats between 2 and 9),
  doors int not null default 5,
  bags int not null default 2,
  ac boolean not null default true,
  consumption numeric(4,1),
  engine text,
  price_tiers jsonb not null,             -- [{"od":1,"cijena":45},{"od":4,"cijena":40},{"od":8,"cijena":35}]
  deposit numeric(8,2) not null default 300,
  description jsonb not null default '{}'::jsonb,
  photos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists rc_vehicles_business_idx on rc_vehicles (business_id, active, sort);

create table if not exists rc_bookings (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null default upper(substr(md5(random()::text), 1, 6)),
  business_id uuid not null references businesses(id) on delete cascade,
  vehicle_id uuid not null references rc_vehicles(id),
  start_at timestamptz not null,
  end_at timestamptz not null check (end_at > start_at),
  status text not null default 'na_cekanju'
    check (status in ('na_cekanju', 'odobreno', 'odbijeno', 'otkazano', 'blokirano')),
  pickup_location text,
  dropoff_location text,
  extras jsonb not null default '[]'::jsonb,
  days int,
  price_total numeric(10,2),
  price_breakdown jsonb,
  deposit numeric(10,2),
  first_name text, last_name text, email text, phone text, birth_date date,
  license_number text, license_front text, license_back text,  -- putanje u privatnom bucketu
  flight_number text, note text,
  lang text, source text not null default 'web', wa_phone text,
  owner_note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  -- Isto vozilo ne može imati dva aktivna najma (ili blokadu) u istom periodu.
  exclude using gist (vehicle_id with =, tstzrange(start_at, end_at) with &&)
    where (status in ('na_cekanju', 'odobreno', 'blokirano'))
);
create index if not exists rc_bookings_business_idx on rc_bookings (business_id, start_at);

alter table rc_vehicles enable row level security;
alter table rc_bookings enable row level security;

-- Privatni bucket za vozačke dozvole (pristup samo preko servera), javni za fotografije vozila.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rc-licenses', 'rc-licenses', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rc-vehicles', 'rc-vehicles', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
