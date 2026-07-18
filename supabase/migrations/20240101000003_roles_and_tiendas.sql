-- Fase 1: colapsar roles a 2 (administrador/tecnico) y reconstruir tiendas desde el CSV de Payless

-- 1. Migrar usuarios 'coordinador' -> 'tecnico' antes de tocar el constraint
update public.users set rol = 'tecnico' where rol = 'coordinador';

alter table public.users drop constraint if exists users_rol_check;
alter table public.users add constraint users_rol_check check (rol in ('administrador', 'tecnico'));

-- 2. RLS: con solo 2 roles, "tecnico" ve/edita todo excepto la gestión de personal.
--    Solo la tabla users (rol, alta/baja de personal) queda restringida a administrador.
drop policy if exists "Escritura de tiendas solo admin/coord" on public.tiendas;
create policy "Escritura de tiendas para autenticados" on public.tiendas
  for all using (auth.role() = 'authenticated');

drop policy if exists "Escritura de inventario solo admin/coord" on public.inventario;
create policy "Escritura de inventario para autenticados" on public.inventario
  for all using (auth.role() = 'authenticated');

drop policy if exists "Lectura de visitas" on public.visitas;
create policy "Lectura de visitas" on public.visitas
  for select using (auth.role() = 'authenticated');

drop policy if exists "Creación de visitas" on public.visitas;
create policy "Creación de visitas" on public.visitas
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "Actualización de visitas" on public.visitas;
create policy "Actualización de visitas" on public.visitas
  for update using (auth.role() = 'authenticated');

drop policy if exists "Escritura de reportes" on public.reportes_actividades;
create policy "Escritura de reportes para autenticados" on public.reportes_actividades
  for all using (auth.role() = 'authenticated');

-- La policy "Admins pueden hacer todo en users" (get_user_role() = 'administrador') ya restringe
-- correctamente la gestión de personal (alta/edición/borrado de otros perfiles) al administrador.

-- 3. Reconstrucción completa de tiendas (se acepta perder inventario/visitas actuales en cascada)
truncate table public.reportes_actividades, public.visitas, public.inventario, public.tiendas cascade;

alter table public.tiendas
  drop column if exists codigo_tienda,
  drop column if exists pais,
  drop column if exists ciudad,
  drop column if exists region,
  drop column if exists establecimiento_cc,
  drop column if exists direccion,
  drop column if exists referencia,
  drop column if exists correos_tienda,
  drop column if exists coordenadas,
  drop column if exists estatus;

alter table public.tiendas
  add column id_tienda integer,
  add column tienda text,
  add column provincia_tienda text,
  add column ciudad_tienda text,
  add column municipio_tienda text,
  add column domicilio_tienda text,
  add column pais_tienda text,
  add column coordenadas_tienda jsonb,
  add column telefono_tienda text,
  add column correo_tienda text,
  add column estatus text not null default 'Tienda Activa';

alter table public.tiendas alter column pais_tienda set not null;
alter table public.tiendas add constraint tiendas_id_tienda_key unique (id_tienda);
alter table public.tiendas alter column id_tienda set not null;

-- 4. Corregir drift de esquema: columnas que el código ya usa pero faltaban en migraciones
alter table public.visitas
  add column if not exists prioridad text,
  add column if not exists correo_encargado text,
  add column if not exists componentes_afectados jsonb,
  add column if not exists notas_adicionales text,
  add column if not exists actividades_ejecutadas jsonb,
  add column if not exists fecha_ejecucion timestamp with time zone;

alter table public.visitas drop constraint if exists visitas_tipo_check;
alter table public.visitas add constraint visitas_tipo_check check (tipo in ('Programada', 'Falla', 'Rutina'));

-- 5. Crear preguntas_componentes (hoy solo existía manualmente en Supabase, no en migraciones)
create table if not exists public.preguntas_componentes (
  id text primary key,
  name text not null,
  questions jsonb not null default '[]'::jsonb
);

alter table public.preguntas_componentes enable row level security;

drop policy if exists "Lectura de preguntas_componentes" on public.preguntas_componentes;
create policy "Lectura de preguntas_componentes" on public.preguntas_componentes
  for select using (auth.role() = 'authenticated');

drop policy if exists "Escritura de preguntas_componentes" on public.preguntas_componentes;
create policy "Escritura de preguntas_componentes" on public.preguntas_componentes
  for all using (auth.role() = 'authenticated');
