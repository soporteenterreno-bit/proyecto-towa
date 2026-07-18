-- 1. Agregar categoria_id a preguntas_componentes
ALTER TABLE public.preguntas_componentes 
ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES public.categorias_inventario(id) ON DELETE CASCADE;

-- 2. Asegurar que las categorías base existan (las que ya estaban en el script de fase 3)
INSERT INTO public.categorias_inventario (nombre) VALUES 
  ('Computación'),
  ('Red y Seguridad'),
  ('Respaldo de Energía'),
  ('Impresión'),
  ('Sistemas de Pago POS')
ON CONFLICT (nombre) DO NOTHING;

-- 3. Asignar categoria_id a los componentes existentes
UPDATE public.preguntas_componentes SET categoria_id = (SELECT id FROM public.categorias_inventario WHERE nombre = 'Sistemas de Pago POS') WHERE name IN ('POS', 'Impresora POS');
UPDATE public.preguntas_componentes SET categoria_id = (SELECT id FROM public.categorias_inventario WHERE nombre = 'Computación') WHERE name IN ('Computadora administrativa');
UPDATE public.preguntas_componentes SET categoria_id = (SELECT id FROM public.categorias_inventario WHERE nombre = 'Impresión') WHERE name IN ('Impresora administrativa', 'Impresora Zebra');
UPDATE public.preguntas_componentes SET categoria_id = (SELECT id FROM public.categorias_inventario WHERE nombre = 'Red y Seguridad') WHERE name IN ('CCTV', 'Sistema de red (router, switch)', 'Biométrico');

-- 4. Eliminar subcategorias de categorias_inventario ya que ahora usamos preguntas_componentes
ALTER TABLE public.categorias_inventario DROP COLUMN IF EXISTS subcategorias;
