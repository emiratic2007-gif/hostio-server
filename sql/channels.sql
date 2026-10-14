-- Channels: WhatsApp + Instagram conversations, connected Instagram accounts, and a daily maintenance job.

-- Which channel a message came from. customer_phone holds the WhatsApp number or the Instagram user id (IGSID).
alter table messages add column if not exists channel text not null default 'whatsapp' check (channel in ('whatsapp', 'instagram'));
create index if not exists messages_conv_idx on messages (business_id, channel, customer_phone, created_at desc);

-- Instagram professional accounts connected to a business (through "Poveži Instagram").
create table if not exists ig_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  ig_user_id text not null unique,          -- professional account id, used in webhooks
  app_user_id text,                         -- id returned by the login (may differ)
  username text,
  access_token text not null,
  token_expires_at timestamptz,
  token_refreshed_at timestamptz not null default now(),
  active boolean not null default true,
  connected_at timestamptz not null default now()
);
alter table ig_accounts enable row level security;   -- no policies: only the server (service key) can read tokens

-- Server-only settings (random key for the scheduled job).
create table if not exists app_secrets (name text primary key, value text not null, created_at timestamptz not null default now());
alter table app_secrets enable row level security;
insert into app_secrets (name, value) values ('cron_key', encode(gen_random_bytes(24), 'hex')) on conflict (name) do nothing;
