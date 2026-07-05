import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { preloadPaisesData } from '../scripts/preloadData';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

import StoreForm from '../components/StoreForm';

interface User {
  id: string;
  email: string;
  rol: string;
  created_at: string;
}

interface Tienda {
  id: string;
  pais: string;
  ciudad: string;
  region: string;
  establecimiento_cc: string;
  direccion: string;
  estatus: string;
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [tiendas, setTiendas] = useState<Tienda[]>([]);
  const [activeTab, setActiveTab] = useState<'summary' | 'users' | 'stores'>('summary');
  const [pieFilter, setPieFilter] = useState<string>('Todos');

  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase.from('users').select('*');
      if (data) setUsers(data as User[]);
    };

    const fetchTiendas = async () => {
      const { data } = await supabase.from('tiendas').select('*');
      if (data) setTiendas(data as Tienda[]);
    };

    fetchUsers();
    fetchTiendas();

    const usersSub = supabase.channel('public:users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchUsers)
      .subscribe();

    const tiendasSub = supabase.channel('public:tiendas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tiendas' }, fetchTiendas)
      .subscribe();

    return () => {
      supabase.removeChannel(usersSub);
      supabase.removeChannel(tiendasSub);
    };
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await supabase.from('users').update({ rol: newRole }).eq('id', userId);
    } catch (error) {
      console.error(error);
    }
  };

  const handleStatusChange = async (tiendaId: string, newStatus: string) => {
    try {
      await supabase.from('tiendas').update({ estatus: newStatus }).eq('id', tiendaId);
    } catch (error) {
      console.error(error);
    }
  };

  // Summary logic
  const targets: Record<string, number> = {
    Colombia: 82,
    Guatemala: 55,
    Ecuador: 45,
    'República Dominicana': 39,
    México: 100,
    Perú: 30,
    Total: 351
  };

  const currentCounts = tiendas.reduce((acc, tienda) => {
    const p = tienda.pais || 'Desconocido';
    acc[p] = (acc[p] || 0) + 1;
    acc.Total = (acc.Total || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const filteredTiendas = pieFilter === 'Todos' ? tiendas : tiendas.filter(t => t.pais === pieFilter);
  const statusCounts = filteredTiendas.reduce((acc, t) => {
    const status = t.estatus || 'Sin Estatus';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = [
    { name: 'Tienda Activa', value: statusCounts['Tienda Activa'] || 0, color: '#16a34a' },
    { name: 'Tienda Existente', value: statusCounts['Tienda Existente'] || 0, color: '#2563eb' },
    { name: 'Tienda no existe', value: statusCounts['Tienda No Existe'] || statusCounts['Tienda no existe'] || 0, color: '#dc2626' },
  ].filter(d => d.value > 0);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Panel de Administración</h1>
        <button
          onClick={preloadPaisesData}
          className="bg-[#1c322e] hover:bg-[#2a4a44] text-white font-bold py-2 px-4 rounded shadow"
        >
          Cargar Datos de Países
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {['summary', 'users', 'stores'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`${
                activeTab === tab
                  ? 'border-[#1c322e] text-[#1c322e]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize`}
            >
              {tab === 'summary' ? 'Resumen' : tab === 'users' ? 'Gestión de Usuarios' : 'Estado de Tiendas'}
            </button>
          ))}
        </nav>
      </div>

      {/* Summary Panel */}
      {activeTab === 'summary' && (
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Conteo de Tiendas vs Objetivos</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">País</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Objetivo</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actual</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">% Cumplimiento</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.entries(targets).map(([country, target]) => {
                    const current = currentCounts[country] || 0;
                    const percentage = Math.round((current / target) * 100) || 0;
                    const isTotal = country === 'Total';
                    return (
                      <tr key={country} className={isTotal ? 'bg-gray-50 font-bold' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{country}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{target}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">{current}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className={percentage >= 100 ? 'text-green-600 font-medium' : 'text-gray-900'}>
                              {percentage}%
                            </span>
                            <div className="w-24 bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${percentage >= 100 ? 'bg-green-500' : 'bg-[#1c322e]'}`}
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">Distribución de Estatus</h2>
              <div className="mt-4 sm:mt-0">
                <label htmlFor="pieFilter" className="mr-2 text-sm font-medium text-gray-700">Filtrar por País:</label>
                <select
                  id="pieFilter"
                  value={pieFilter}
                  onChange={(e) => setPieFilter(e.target.value)}
                  className="pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-[#1c322e] focus:border-[#1c322e] sm:text-sm rounded-md border"
                >
                  <option value="Todos">Todos los países</option>
                  {Array.from(new Set(tiendas.map(t => t.pais))).filter(Boolean).sort().map(pais => (
                    <option key={pais} value={pais}>{pais}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => percent > 0 ? `${name} (${(percent * 100).toFixed(0)}%)` : ''}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} tiendas`, 'Cantidad']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Users Panel */}
      {activeTab === 'users' && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Correo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha de Registro</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{u.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <select
                      value={u.rol || 'tecnico'}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-[#1c322e] focus:border-[#1c322e] sm:text-sm rounded-md border"
                    >
                      <option value="tecnico">Técnico</option>
                      <option value="coordinador">Coordinador</option>
                      <option value="administrador">Administrador</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Stores Panel */}
      {activeTab === 'stores' && (
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <select
                        value={t.estatus || 'Tienda Activa'}
                        onChange={(e) => handleStatusChange(t.id, e.target.value)}
                        className={`mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-[#1c322e] focus:border-[#1c322e] sm:text-sm rounded-md border ${
                          t.estatus === 'Tienda Activa' ? 'text-green-600 font-medium' :
                          t.estatus === 'Tienda Existente' ? 'text-blue-600 font-medium' :
                          'text-red-600 font-medium'
                        }`}
                      >
                        <option value="Tienda No Existe">Tienda no existe</option>
                        <option value="Tienda Activa">Tienda Activa</option>
                        <option value="Tienda Existente">Tienda Existente</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
