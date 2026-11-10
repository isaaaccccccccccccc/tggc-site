-- =====================================================================
--  Tarlac Gospel of Grace Church website: database setup for Supabase
--  How to use: Supabase → SQL Editor → New query → paste ALL of this → Run.
--  It is safe to run again later; it won't erase anything.
--
--  The editor email is already filled in (step 7 at the bottom).
-- =====================================================================

-- 1. Where the church content is stored -------------------------------
--    (settings, preachings, announcements, events and gallery photos)
create table if not exists public.docs (
  path        text primary key,            -- e.g. 'sermons/abc123'
  collection  text not null,               -- e.g. 'sermons'
  id          text not null,               -- e.g. 'abc123'
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
create index if not exists docs_collection_idx on public.docs (collection);
alter table public.docs replica identity full;   -- lets visitors' pages see deletions live

-- 2. Who is allowed to post (the pastor and helpers) -------------------
create table if not exists public.editors (
  email      text primary key,
  added_at   timestamptz not null default now()
);

create or replace function public.is_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.editors e
    where lower(e.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_editor() from public;
grant execute on function public.is_editor() to anon, authenticated;

-- 3. Security rules ---------------------------------------------------
--    Everyone can READ church content. Only editors can add, change or delete it.
alter table public.docs    enable row level security;
alter table public.editors enable row level security;

drop policy if exists "Anyone can read church content" on public.docs;
create policy "Anyone can read church content" on public.docs
  for select using (true);

drop policy if exists "Editors can add content" on public.docs;
create policy "Editors can add content" on public.docs
  for insert to authenticated with check (public.is_editor());

drop policy if exists "Editors can change content" on public.docs;
create policy "Editors can change content" on public.docs
  for update to authenticated using (public.is_editor()) with check (public.is_editor());

drop policy if exists "Editors can delete content" on public.docs;
create policy "Editors can delete content" on public.docs
  for delete to authenticated using (public.is_editor());

drop policy if exists "Editors can see the editor list" on public.editors;
create policy "Editors can see the editor list" on public.editors
  for select to authenticated using (public.is_editor());

grant select on public.docs to anon, authenticated;
grant insert, update, delete on public.docs to authenticated;
grant select on public.editors to authenticated;

-- 4. Live updates (new posts appear without refreshing) ---------------
do $$
begin
  alter publication supabase_realtime add table public.docs;
exception
  when duplicate_object then null;   -- already turned on
  when undefined_object then null;   -- realtime not available; the site falls back to checking every 2 minutes
end $$;

-- 5. File storage for photos, sermon audio and PDFs --------------------
--    Public bucket "media", 50 MB per file (the free-plan maximum).
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 52428800)
on conflict (id) do update set public = true, file_size_limit = 52428800;

drop policy if exists "Anyone can view church media" on storage.objects;
create policy "Anyone can view church media" on storage.objects
  for select using (bucket_id = 'media');

drop policy if exists "Editors can upload church media" on storage.objects;
create policy "Editors can upload church media" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and public.is_editor());

drop policy if exists "Editors can replace church media" on storage.objects;
create policy "Editors can replace church media" on storage.objects
  for update to authenticated using (bucket_id = 'media' and public.is_editor());

drop policy if exists "Editors can delete church media" on storage.objects;
create policy "Editors can delete church media" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and public.is_editor());

-- 6. Starting content (copied from the current site) ------------------
insert into public.docs (path, collection, id, data) values
('site/settings', 'site', 'settings', $json${
  "churchName": "Tarlac Gospel of Grace Church",
  "tagline": "A family of believers gathering to worship God, grow in His Word and serve one another.",
  "verseRef": "Ephesians 2:8",
  "verseText": "For by grace are ye saved through faith; and that not of yourselves: it is the gift of God:",
  "updatedAt": 1794287900000
}$json$::jsonb),
('announcements/welcome1', 'announcements', 'welcome1', $json${
  "title": "Welcome to our new church website",
  "body": "This is the new online home of Tarlac Gospel of Grace Church. Come here for the latest preachings in our Preaching Archives, church announcements, upcoming events, and the King James Bible to read anytime.",
  "category": "General",
  "status": "published",
  "pinned": true,
  "postDate": "2026-11-10",
  "expires": "",
  "imageId": "",
  "link": "",
  "linkLabel": "",
  "createdAt": 1794284700000,
  "updatedAt": 1794287900000
}$json$::jsonb)
on conflict (path) do nothing;

-- 7. The pastor's login email -----------------------------------------
--    The website's editor (can post). Add more editors with the lines below.
--    To add a helper later, run:  insert into public.editors (email) values ('helper@example.com');
--    To remove one:               delete from public.editors where email = 'helper@example.com';
insert into public.editors (email) values ('johnisaacapolinar12@gmail.com')
on conflict (email) do nothing;
