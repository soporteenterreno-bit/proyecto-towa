-- 1. Agregar columnas faltantes a la tabla visitas
ALTER TABLE public.visitas
  ADD COLUMN IF NOT EXISTS prioridad text default 'Media',
  ADD COLUMN IF NOT EXISTS correo_encargado text,
  ADD COLUMN IF NOT EXISTS componentes_afectados text[] default '{}',
  ADD COLUMN IF NOT EXISTS "createdAt" timestamp with time zone default timezone('utc'::text, now());

-- 2. Actualizar el constraint de 'tipo' para incluir 'Rutina'
ALTER TABLE public.visitas DROP CONSTRAINT IF EXISTS visitas_tipo_check;
ALTER TABLE public.visitas ADD CONSTRAINT visitas_tipo_check CHECK (tipo IN ('Programada', 'Falla', 'Rutina'));
