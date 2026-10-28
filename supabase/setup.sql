-- Run once in the Supabase SQL editor. No public read access to personal data.
create table if not exists public.memoria_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pseudo text not null check (char_length(trim(pseudo)) between 3 and 24),
  avatar text not null default 'citadelle' check (avatar in ('citadelle','livre','voix','montagne','riviere','boussole','initiales')),
  photo_path text check (photo_path is null or split_part(photo_path, '/', 1) = user_id::text)
);
create table if not exists public.memoria_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  step_id text not null check (step_id = 'iut-grimaldi'),
  started boolean not null default false,
  visited text[] not null default '{}',
  last_point text,
  primary key (user_id, step_id),
  check (visited <@ array['iut','naissance','paoli','reouverture','corte']::text[]),
  check (last_point is null or last_point in ('iut','naissance','paoli','reouverture','corte'))
);
alter table public.memoria_profiles enable row level security;
alter table public.memoria_progress enable row level security;
revoke all on public.memoria_profiles, public.memoria_progress from anon;
grant select, insert, update, delete on public.memoria_profiles, public.memoria_progress to authenticated;
drop policy if exists "Own Memoria profile" on public.memoria_profiles;
create policy "Own Memoria profile" on public.memoria_profiles for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Own Memoria progress" on public.memoria_progress;
create policy "Own Memoria progress" on public.memoria_progress for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 1048576, array['image/jpeg']) on conflict (id) do nothing;
drop policy if exists "Own Memoria avatar" on storage.objects;
create policy "Own Memoria avatar" on storage.objects for all to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
