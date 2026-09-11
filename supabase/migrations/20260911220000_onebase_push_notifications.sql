create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.onebase_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null check (jsonb_typeof(subscription) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists onebase_push_subscriptions_user_id_idx on public.onebase_push_subscriptions(user_id);
alter table public.onebase_push_subscriptions enable row level security;

drop policy if exists onebase_push_select_own on public.onebase_push_subscriptions;
drop policy if exists onebase_push_insert_own on public.onebase_push_subscriptions;
drop policy if exists onebase_push_update_own on public.onebase_push_subscriptions;
drop policy if exists onebase_push_delete_own on public.onebase_push_subscriptions;

create policy onebase_push_select_own on public.onebase_push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy onebase_push_insert_own on public.onebase_push_subscriptions for insert to authenticated with check (user_id = auth.uid());
create policy onebase_push_update_own on public.onebase_push_subscriptions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy onebase_push_delete_own on public.onebase_push_subscriptions for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.onebase_push_subscriptions to authenticated;
grant all on public.onebase_push_subscriptions to service_role;

create table if not exists public.onebase_episode_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  anime_key text not null,
  anime_title text not null,
  episode integer not null check (episode > 0),
  sent_at timestamptz not null default now(),
  unique (user_id, anime_key, episode)
);
create index if not exists onebase_episode_notifications_user_id_idx on public.onebase_episode_notifications(user_id);
alter table public.onebase_episode_notifications enable row level security;
grant all on public.onebase_episode_notifications to service_role;

create table if not exists public.onebase_cron_state (
  id boolean primary key default true check (id),
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_result jsonb default '{}'::jsonb
);
grant all on public.onebase_cron_state to service_role;
insert into public.onebase_cron_state(id) values(true) on conflict (id) do nothing;

select cron.unschedule('onebase-episode-update-worker') where exists (select 1 from cron.job where jobname = 'onebase-episode-update-worker');
select cron.schedule(
  'onebase-episode-update-worker',
  '0 */6 * * *',
  $$
    select net.http_post(
      url := 'https://djfjqecahztogacliavh.supabase.co/functions/v1/onebase-episode-cron',
      headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_tm8Tid_HSYtu6cxXQ3ddKA_RWN15BSB'),
      body := jsonb_build_object('scheduled_at', now())
    );
  $$
);
