-- Run after supabase-schema.sql from the Supabase SQL Editor.
-- Expires unbooked loads whose pickup date has passed, once per hour (UTC).
create extension if not exists pg_cron;

select cron.unschedule(jobid)
from cron.job
where jobname = 'haulboard-expire-open-loads';

select cron.schedule(
  'haulboard-expire-open-loads',
  '0 * * * *',
  'select public.expire_open_loads();'
);
