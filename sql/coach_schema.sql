-- Personal coaching (template "coach"): website /<slug> sends requests, the coach confirms them in /dashboard/coach/.
alter table businesses drop constraint if exists businesses_template_check;
alter table businesses add constraint businesses_template_check check (template in ('salon', 'rentacar', 'coach'));

create table if not exists coach_requests (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null default upper(substr(md5(random()::text), 1, 6)),
  business_id uuid not null references businesses(id),
  service text not null check (service in ('uzivo', 'online', 'prehrana')),
  goals text[] not null default '{}' check (coalesce(array_length(goals, 1), 0) <= 8),
  experience text check (char_length(experience) <= 40),
  days text[] not null default '{}' check (coalesce(array_length(days, 1), 0) <= 7),
  times text[] not null default '{}' check (coalesce(array_length(times, 1), 0) <= 3),
  name text not null check (char_length(name) between 2 and 120),
  phone text not null check (char_length(phone) between 6 and 40),
  note text check (char_length(note) <= 1500),
  status text not null default 'novo' check (status in ('novo', 'potvrdjeno', 'odbijeno', 'otkazano')),
  session_at timestamptz,
  session_min integer not null default 60 check (session_min between 15 and 240),
  owner_note text check (char_length(owner_note) <= 1500),
  source text not null default 'web' check (source in ('web', 'rucno', 'whatsapp', 'instagram')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists coach_requests_biz_idx on coach_requests (business_id, created_at desc);
create index if not exists coach_requests_session_idx on coach_requests (business_id, session_at);
-- Only the Hostio server (service key) reads and writes; no public policies.
alter table coach_requests enable row level security;
comment on table coach_requests is 'Zahtjevi za trening (personal coaching, npr. hostio.ba/mofit). Piše i čita samo Hostio server.';

insert into businesses (slug, name, template, settings) values ('mofit', 'MoFit', 'coach', $json$
{"tagline": "Personal coaching", "contact": {"whatsapp": "387603056475", "instagram": "mofit.ba"}}
$json$::jsonb)
on conflict (slug) do update set template = excluded.template, settings = excluded.settings, name = excluded.name;
