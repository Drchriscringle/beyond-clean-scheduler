-- A child can attach a photo of the finished chore to their claim, so the
-- parent can approve from the Home tab without walking over to look.
-- Photos live in a private bucket at <family_id>/<claim_id>.jpg and are
-- read back via short-lived signed URLs.

alter table chore_claims add column if not exists photo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chore-photos', 'chore-photos', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "family reads chore photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'chore-photos' and (storage.foldername(name))[1] = public.my_family_id()::text);

create policy "family uploads chore photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chore-photos' and (storage.foldername(name))[1] = public.my_family_id()::text);

create policy "family replaces chore photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'chore-photos' and (storage.foldername(name))[1] = public.my_family_id()::text)
  with check (bucket_id = 'chore-photos' and (storage.foldername(name))[1] = public.my_family_id()::text);

-- chore_claims has no update policy (claims are decided via RPC), so the
-- photo is attached through this function: the claim must be in the
-- caller's family, still pending, and either the caller is a parent or it's
-- the child's own claim. The path is forced to the claim's own slot.
create or replace function attach_claim_photo(claim_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  claim record;
  path text;
begin
  select * into claim from chore_claims where id = claim_id and family_id = my_family_id();
  if claim is null then raise exception 'Claim not found.'; end if;
  if claim.status <> 'pending' then raise exception 'That chore has already been checked.'; end if;
  if not is_parent() and claim.child_id is distinct from my_child_id() then
    raise exception 'You can only add a photo to your own chores.';
  end if;
  path := claim.family_id::text || '/' || claim.id::text || '.jpg';
  update chore_claims set photo_path = path where id = claim.id;
  return path;
end;
$$;
revoke execute on function attach_claim_photo(uuid) from public, anon;
