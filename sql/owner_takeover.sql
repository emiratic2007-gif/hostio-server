-- Messages the owner writes himself (WhatsApp Business app next to Hostio, or the Instagram app):
-- Hostio then stays quiet in that chat for a while (HUMAN_PAUSE_HOURS, default 12).
alter table messages add column if not exists by_owner boolean not null default false;
create index if not exists messages_owner_idx on messages (business_id, channel, customer_phone, created_at desc) where by_owner;
