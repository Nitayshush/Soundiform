-- מסנכרן auth.users (מנוהל ע"י Supabase Auth) -> public.users (הטבלה שלנו, עם plan/RLS).
-- לא ניתן להביע את זה ב-Drizzle schema DSL כי auth.* אינו בסכימה שלנו.
-- ⚠️ אין לשנות ללא אישור — ראה PROJECT.md §0.1

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
