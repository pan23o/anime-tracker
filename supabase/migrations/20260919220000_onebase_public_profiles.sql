alter table public.profiles
  add column if not exists public_enabled boolean not null default false,
  add column if not exists bio text not null default '',
  add column if not exists public_stats jsonb not null default '{}';

alter table public.profiles
  drop constraint if exists profiles_bio_length;

alter table public.profiles
  add constraint profiles_bio_length check (char_length(bio) <= 280);

grant select on public.profiles to anon;

drop policy if exists profiles_select_public on public.profiles;
create policy profiles_select_public
  on public.profiles
  for select
  to anon, authenticated
  using (public_enabled = true);