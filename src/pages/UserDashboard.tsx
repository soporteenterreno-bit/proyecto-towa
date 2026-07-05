import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import StoreForm from '../components/StoreForm';

interface Tienda {
  id: string;
  pais_tienda: string;
  ciudad_region: string;
  establecimiento_tienda: string;
  direccion_referencia: string;
  estatus: string;
}

export default function UserDashboard() {
  const [tiendas, setTiendas] = useState<Tienda[]>([]);

  useEffect(() => {
    const unsubscribeTiendas = onSnapshot(collection(db, 'Tienda'), (snapshot) => {
      const tiendasData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Tienda[];
      setTiendas(tiendasData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'Tienda');
    });

    return () => {
      unsubscribeTiendas();
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{t.pais_tienda}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.ciudad_region}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.establecimiento_tienda}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.direccion_referencia}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        t.estatus === 'Tienda Activa' ? 'bg-green-100 text-green-800' :
                        t.estatus === 'Tienda Existente' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {t.estatus}
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
