-- Child personalisation: a theme (colour / icon / wallpaper) and an optional
-- photo avatar stored in a private Storage bucket that only the child's own
-- family can read or write (folder = family id).

alter table children add column if not exists theme jsonb not null default '{}'::jsonb;
alter table children add column if not exists avatar_url text; -- storage object path, e.g. <family_id>/<child_id>.jpg

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "family reads own avatars" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = public.my_family_id()::text);

create policy "family uploads own avatars" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = public.my_family_id()::text);

create policy "family replaces own avatars" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = public.my_family_id()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = public.my_family_id()::text);
