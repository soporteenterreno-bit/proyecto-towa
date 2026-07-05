-- Habilitar extensión UUID
create extension if not exists "uuid-ossp";

-- 1. Tabla de Usuarios (Extendiendo auth.users)
create table public.users (
  id uuid references auth.users not null primary key,
  email text unique not null,
  nombre text,
  rol text check (rol in ('administrador', 'coordinador', 'tecnico')),
  telefono text,
  pais text,
  direccion text,
  jefe_inmediato text,
  area_trabajo text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Tabla de Tiendas
create table public.tiendas (
  id uuid default uuid_generate_v4() primary key,
  codigo_tienda text unique not null,
  pais text not null,
  ciudad text not null,
  region text,
  establecimiento_cc text not null,
  direccion text not null,
  referencia text
);

-- 3. Tabla de Inventario
create table public.inventario (
  id uuid default uuid_generate_v4() primary key,
  id_tienda uuid references public.tiendas(id) on delete cascade not null,
  categoria text not null,
  marca text not null,
  modelo text not null,
  serial text not null,
  estado_fisico text not null,
  estado_operativo text not null
);

-- 4. Tabla de Visitas
create table public.visitas (
  id uuid default uuid_generate_v4() primary key,
  tipo text check (tipo in ('Programada', 'Falla')) not null,
  tecnico_uid uuid references public.users(id),
  coordinador_uid uuid references public.users(id),
  id_tienda uuid references public.tiendas(id) on delete cascade not null,
  status text check (status in ('Pendiente', 'En Curso', 'Completada')) not null default 'Pendiente',
  fecha_programada timestamp with time zone,
  fecha_inicio timestamp with time zone,
  fecha_fin timestamp with time zone,
  tt_number text,
  notas_coordinador text,
  ponderacion_final numeric,
  revision text,
  acciones_aplicadas text,
  resultado text,
  acciones_pendientes text
);

-- 5. Tabla de Reportes Actividades
create table public.reportes_actividades (
  id uuid default uuid_generate_v4() primary key,
  id_visita uuid references public.visitas(id) on delete cascade not null,
  actividad_id text not null,
  completada boolean not null default false,
  razon_no_completada text,
  evidencia_url text
);

-- 6. Config Comunicaciones
create table public.config_comunicaciones (
  pais_id text primary key,
  lista_correos jsonb not null default '[]'::jsonb
);

-- RLS (Row Level Security)

-- Habilitar RLS en todas las tablas
alter table public.users enable row level security;
alter table public.tiendas enable row level security;
alter table public.inventario enable row level security;
alter table public.visitas enable row level security;
alter table public.reportes_actividades enable row level security;
alter table public.config_comunicaciones enable row level security;

-- Políticas para Users
create policy "Usuarios autenticados pueden ver perfiles" on public.users
  for select using (auth.role() = 'authenticated');

create policy "Usuarios pueden actualizar su propio perfil" on public.users
  for update using (auth.uid() = id);

create policy "Admins pueden hacer todo en users" on public.users
  for all using (
    exists (select 1 from public.users where id = auth.uid() and rol = 'administrador')
  );

-- Políticas para Tiendas
create policy "Lectura de tiendas para todos" on public.tiendas
  for select using (auth.role() = 'authenticated');

create policy "Escritura de tiendas solo admin/coord" on public.tiendas
  for all using (
    exists (select 1 from public.users where id = auth.uid() and rol in ('administrador', 'coordinador'))
  );

-- Políticas para Inventario
create policy "Lectura de inventario para todos" on public.inventario
  for select using (auth.role() = 'authenticated');

create policy "Escritura de inventario solo admin/coord" on public.inventario
  for all using (
    exists (select 1 from public.users where id = auth.uid() and rol in ('administrador', 'coordinador'))
  );

-- Políticas para Visitas
create policy "Lectura de visitas" on public.visitas
  for select using (
    -- Admin/Coord ven todas
    exists (select 1 from public.users where id = auth.uid() and rol in ('administrador', 'coordinador'))
    or
    -- Tecnico ve las suyas o pendientes sin asignar
    tecnico_uid = auth.uid()
    or 
    (status = 'Pendiente' and tecnico_uid is null)
  );

create policy "Creación de visitas" on public.visitas
  for insert with check (
    exists (select 1 from public.users where id = auth.uid() and rol in ('administrador', 'coordinador'))
    or
    tecnico_uid = auth.uid()
  );

create policy "Actualización de visitas" on public.visitas
  for update using (
    exists (select 1 from public.users where id = auth.uid() and rol in ('administrador', 'coordinador'))
    or
    tecnico_uid = auth.uid()
    or
    (status = 'Pendiente' and tecnico_uid is null) -- Para auto-asignación
  );

-- Políticas para Reportes Actividades
create policy "Lectura de reportes" on public.reportes_actividades
  for select using (auth.role() = 'authenticated');

create policy "Escritura de reportes" on public.reportes_actividades
  for all using (
    -- Para simplificar: el mismo técnico de la visita o admins/coords
    exists (
      select 1 from public.visitas v 
      where v.id = public.reportes_actividades.id_visita 
      and (
        v.tecnico_uid = auth.uid() 
        or exists (select 1 from public.users where id = auth.uid() and rol in ('administrador', 'coordinador'))
      )
    )
  );

-- Función (Trigger) para crear automáticamente el perfil de usuario público al registrarse en Auth
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
