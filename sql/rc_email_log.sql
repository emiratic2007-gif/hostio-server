-- Log of emails sent to the customer for a booking (kind, time, ok / error).
alter table rc_bookings add column if not exists email_log jsonb not null default '[]'::jsonb;
