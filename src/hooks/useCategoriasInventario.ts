import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export function useCategoriasInventario() {
  const [categorias, setCategorias] = useState<any[]>([]);
  const [loadingCategorias, setLoadingCategorias] = useState(true);

  useEffect(() => {
    async function fetchCategorias() {
      try {
        const { data, error } = await supabase.from('categorias_inventario').select('*').order('nombre');
        if (error) throw error;
        setCategorias(data || []);
      } catch (err) {
        console.error('Error fetching categorias', err);
      } finally {
        setLoadingCategorias(false);
      }
    }
    fetchCategorias();
  }, []);

  return { categorias, loadingCategorias };
}
