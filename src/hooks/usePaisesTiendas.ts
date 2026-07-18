import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export function usePaisesTiendas() {
  const [paises, setPaises] = useState<string[]>([]);
  const [loadingPaises, setLoadingPaises] = useState(true);

  useEffect(() => {
    async function fetchPaises() {
      try {
        const { data, error } = await supabase.from('tiendas').select('pais_tienda');
        if (error) throw error;
        const unique = Array.from(new Set((data || []).map(d => d.pais_tienda))).filter(Boolean).sort() as string[];
        setPaises(unique);
      } catch (err) {
        console.error('Error fetching paises from tiendas', err);
      } finally {
        setLoadingPaises(false);
      }
    }
    fetchPaises();
  }, []);

  return { paises, loadingPaises };
}
