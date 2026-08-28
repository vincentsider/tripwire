-- Ownership must STAY in place: the maintenance cron re-checks the proof and, if
-- it has been gone past a grace window, revokes. proof_last_ok is the last time
-- the challenge proof was confirmed present; a grace window off it prevents a
-- transient outage from causing a false revocation.
alter table public.origins add column if not exists proof_last_ok timestamptz;
update public.origins set proof_last_ok = verified_at where verified_at is not null and proof_last_ok is null;
