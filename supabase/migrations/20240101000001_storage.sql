-- Habilitar la extensión de almacenamiento si no está habilitada
create extension if not exists "uuid-ossp";

-- Crear el bucket 'evidencias_visitas'
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidencias_visitas',
  'evidencias_visitas',
  true,
  5242880, -- 5MB por archivo max
  array['image/jpeg', 'image/png', 'image/webp']
) on conflict (id) do nothing;

-- Políticas de Seguridad para Storage (RLS)
-- Permitir acceso público de lectura a las imágenes
create policy "Acceso de lectura publico para evidencias"
on storage.objects for select
using ( bucket_id = 'evidencias_visitas' );

-- Permitir a los usuarios autenticados insertar archivos en evidencias_visitas
create policy "Usuarios autenticados pueden subir fotos"
on storage.objects for insert
with check ( bucket_id = 'evidencias_visitas' and auth.role() = 'authenticated' );

-- Permitir a los usuarios autenticados actualizar/eliminar sus archivos (opcional, pero útil)
create policy "Usuarios autenticados pueden eliminar fotos"
on storage.objects for delete
using ( bucket_id = 'evidencias_visitas' and auth.role() = 'authenticated' );
