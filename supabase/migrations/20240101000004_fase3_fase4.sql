-- Migración para Fase 3 y 4

-- 1. Tabla para Categorías y Subcategorías de Inventario
create table if not exists public.categorias_inventario (
  id uuid default uuid_generate_v4() primary key,
  nombre text not null unique,
  subcategorias jsonb not null default '[]'::jsonb
);

alter table public.categorias_inventario enable row level security;

create policy "Lectura de categorias para autenticados" on public.categorias_inventario
  for select using (auth.role() = 'authenticated');

create policy "Escritura de categorias para autenticados" on public.categorias_inventario
  for all using (auth.role() = 'authenticated');


-- 2. Tabla para Preguntas del Checklist General
create table if not exists public.checklist_preguntas (
  id uuid default uuid_generate_v4() primary key,
  pregunta text not null,
  formularios text[] not null default '{"Programada", "Falla"}',
  activo boolean default true,
  orden integer default 0
);

alter table public.checklist_preguntas enable row level security;

create policy "Lectura de checklist para autenticados" on public.checklist_preguntas
  for select using (auth.role() = 'authenticated');

create policy "Escritura de checklist para autenticados" on public.checklist_preguntas
  for all using (auth.role() = 'authenticated');


-- 3. Modificaciones a la tabla Inventario
alter table public.inventario
  add column if not exists id_componente text,
  add column if not exists categoria_componente text,
  add column if not exists subcategoria_componente text,
  add column if not exists status_componente text default 'Operativo';

-- Migrar datos existentes (si aplica) y eliminar la columna antigua
update public.inventario set categoria_componente = categoria where categoria_componente is null;
alter table public.inventario drop column if exists categoria;


-- 4. Modificaciones a la tabla Visitas
alter table public.visitas
  add column if not exists checklist_respuestas jsonb default '[]'::jsonb;

-- 5. Insertar datos por defecto para Categorias
insert into public.categorias_inventario (nombre, subcategorias) values
  ('Computación', '["Laptops", "Desktops", "Monitores", "Periféricos"]'),
  ('Red y Seguridad', '["Routers", "Switches", "Cámaras", "Access Points"]'),
  ('Respaldo de Energía', '["UPS", "Inversores", "Baterías"]'),
  ('Impresión', '["Impresoras Térmicas", "Multifuncionales", "Escaners"]'),
  ('Sistemas de Pago POS', '["Datáfonos", "Cajas Registradoras", "Gavetas"]')
on conflict (nombre) do nothing;

-- 6. Insertar datos por defecto para Checklist
insert into public.checklist_preguntas (pregunta, formularios, orden) values
  ('¿La tienda se encuentra limpia y ordenada?', '{"Programada", "Falla"}', 1),
  ('¿El personal estaba presente y con uniforme adecuado?', '{"Programada", "Falla"}', 2),
  ('¿Los equipos principales se encuentran encendidos y sin alertas visuales?', '{"Programada", "Falla"}', 3),
  ('¿Se verificó la conectividad a la red de la tienda?', '{"Programada", "Falla"}', 4),
  ('¿El rack de comunicaciones está cerrado y organizado?', '{"Programada", "Falla"}', 5),
  ('¿Se entregó reporte de visita al gerente o encargado?', '{"Programada", "Falla"}', 6);
