import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import StoreForm from '../components/StoreForm';

interface Tienda {
  id: string;
  pais: string;
  ciudad: string;
  region: string;
  establecimiento_cc: string;
  direccion: string;
  estatus: string;
}

export default function UserDashboard() {
  const [tiendas, setTiendas] = useState<Tienda[]>([]);

  useEffect(() => {
    const fetchTiendas = async () => {
      const { data } = await supabase.from('tiendas').select('*');
      if (data) setTiendas(data as Tienda[]);
    };

    fetchTiendas();

    const tiendasSub = supabase.channel('public:tiendas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tiendas' }, fetchTiendas)
      .subscribe();

    return () => {
      supabase.removeChannel(tiendasSub);
    };
  }, []);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Panel de Usuario</h1>
        <p className="mt-2 text-sm text-gray-600">Registra nuevas tiendas y visualiza el estado de las tiendas existentes.</p>
      </div>

      <div className="space-y-8">
        <StoreForm />
        
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-xl font-bold text-gray-800">Tiendas Registradas</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">País</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ciudad/Región</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Establecimiento</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dirección</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tiendas.map((t) => (
                  <tr key={t.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{t.pais}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.ciudad} {t.region ? `(${t.region})` : ''}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.establecimiento_cc}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.direccion}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        t.estatus === 'Tienda Activa' ? 'bg-green-100 text-green-800' :
                        t.estatus === 'Tienda Existente' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {t.estatus || 'Sin estatus'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
