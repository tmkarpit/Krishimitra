-- Run once in the Supabase SQL editor after deploying the functions.
-- Replace <PROJECT_REF> and <CRON_SECRET> (same value as the CRON_SECRET function secret).
-- Kept out of migrations because it contains a secret and a project-specific URL.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'krishimitra-weather-alerts',
  '15 */3 * * *',           -- every 3 hours
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/weather-alerts',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

-- To remove: select cron.unschedule('krishimitra-weather-alerts');
