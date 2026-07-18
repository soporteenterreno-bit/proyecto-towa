-- 1. Asegurar la estructura correcta de la tabla (usada por el frontend)
DROP TABLE IF EXISTS public.preguntas_componentes;

CREATE TABLE public.preguntas_componentes (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  questions jsonb not null default '[]'::jsonb
);

ALTER TABLE public.preguntas_componentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura de preguntas_componentes" ON public.preguntas_componentes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Escritura de preguntas_componentes" ON public.preguntas_componentes FOR ALL USING (auth.role() = 'authenticated');

-- 1. POS
INSERT INTO public.preguntas_componentes (name, questions) VALUES (
  'POS',
  '[
    {"id": "pos_1", "text": "¿El monitor está en buen estado?", "points": 20},
    {"id": "pos_2", "text": "¿Tiene mouse y teclado?", "points": 20},
    {"id": "pos_3", "text": "¿Escáner tipo pistola en buen estado?", "points": 20},
    {"id": "pos_4", "text": "¿Tiene UPS la caja de cobro?", "points": 20},
    {"id": "pos_5", "text": "¿El UPS en qué estado está?", "points": 20}
  ]'::jsonb
);

-- 2. Impresora POS
INSERT INTO public.preguntas_componentes (name, questions) VALUES (
  'Impresora POS',
  '[
    {"id": "imp_pos_1", "text": "¿Impresora en buen estado?", "points": 100}
  ]'::jsonb
);

-- 3. Computadora administrativa
INSERT INTO public.preguntas_componentes (name, questions) VALUES (
  'Computadora administrativa',
  '[
    {"id": "comp_adm_1", "text": "¿El monitor está en buen estado?", "points": 25},
    {"id": "comp_adm_2", "text": "¿Tiene mouse y teclado?", "points": 25},
    {"id": "comp_adm_3", "text": "¿Tiene UPS la máquina?", "points": 25},
    {"id": "comp_adm_4", "text": "¿El UPS en qué estado está?", "points": 25}
  ]'::jsonb
);

-- 4. Impresora administrativa
INSERT INTO public.preguntas_componentes (name, questions) VALUES (
  'Impresora administrativa',
  '[
    {"id": "imp_adm_1", "text": "¿Impresora en buen estado?", "points": 100}
  ]'::jsonb
);

-- 5. Impresora Zebra
INSERT INTO public.preguntas_componentes (name, questions) VALUES (
  'Impresora Zebra',
  '[
    {"id": "imp_zeb_1", "text": "¿Impresora en buen estado?", "points": 100}
  ]'::jsonb
);

-- 6. Biométrico
INSERT INTO public.preguntas_componentes (name, questions) VALUES (
  'Biométrico',
  '[
    {"id": "bio_1", "text": "¿El biométrico está funcionando correctamente?", "points": 100}
  ]'::jsonb
);

-- 7. CCTV
INSERT INTO public.preguntas_componentes (name, questions) VALUES (
  'CCTV',
  '[
    {"id": "cctv_1", "text": "¿El sistema de cámaras está encendido y grabando?", "points": 100}
  ]'::jsonb
);

-- 8. Sistema de red (router, switch)
INSERT INTO public.preguntas_componentes (name, questions) VALUES (
  'Sistema de red (router, switch)',
  '[
    {"id": "red_1", "text": "¿Los equipos de red están encendidos y operando?", "points": 100}
  ]'::jsonb
);
