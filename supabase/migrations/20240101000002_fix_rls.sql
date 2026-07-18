-- 1. Crear función segura que no se bloquee a sí misma (security definer)
create or replace function public.get_user_role()
returns text as $$
declare
  user_role text;
begin
  select rol into user_role from public.users where id = auth.uid();
  return user_role;
end;
$$ language plpgsql security definer;

-- 2. Corregir política de usuarios (Eliminar la que causa recursividad infinita)
drop policy if exists "Admins pueden hacer todo en users" on public.users;
create policy "Admins pueden hacer todo en users" on public.users
  for all using (
    public.get_user_role() = 'administrador'
  );

-- 3. (Opcional, pero recomendado) Permitir a los nuevos usuarios insertar su rol al entrar
drop policy if exists "Usuarios pueden insertar su propio perfil" on public.users;
create policy "Usuarios pueden insertar su propio perfil" on public.users
  for insert with check (auth.uid() = id);
