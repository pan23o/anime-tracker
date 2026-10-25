-- Keep public profile access to the fields shown on the public profile page.
revoke select on table public.profiles from anon;
grant select (id, username, avatar_data, bio, public_stats, created_at, public_enabled)
  on table public.profiles to anon;

-- The episode worker uses service-role access, so require a Vault-backed secret
-- for every POST and pass it only from the scheduled database job.
do $$
begin
  if not exists (
    select 1 from vault.secrets where name = 'onebase_cron_secret'
  ) then
    perform vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'onebase_cron_secret',
      'OneBase episode cron authorization secret'
    );
  end if;
end
$$;

select cron.unschedule(jobid)
from cron.job
where jobname = 'onebase-episode-update-worker';

select cron.schedule(
  'onebase-episode-update-worker',
  '0 */6 * * *',
  $job$
    select net.http_post(
      url := 'https://djfjqecahztogacliavh.supabase.co/functions/v1/onebase-episode-cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'sb_publishable_tm8Tid_HSYtu6cxXQ3ddKA_RWN15BSB',
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'onebase_cron_secret'
          limit 1
        )
      ),
      body := jsonb_build_object('scheduled_at', now())
    );
  $job$
);
