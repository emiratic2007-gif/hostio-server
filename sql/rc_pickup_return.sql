-- Vehicle hand-over status: when the customer actually took the car and brought it back.
alter table rc_bookings add column if not exists picked_up_at timestamptz;
alter table rc_bookings add column if not exists returned_at timestamptz;
alter table rc_bookings add column if not exists planned_end_at timestamptz;   -- original end, kept when the car came back early or late
