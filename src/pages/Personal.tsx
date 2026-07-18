import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth, UserRole } from '../context/AuthContext';
import { Shield, UserCog, Mail, Edit2, Trash2, X } from 'lucide-react';
import { CustomSelect } from '../components/CustomSelect';
import { Country } from 'country-state-city';
import { useNotification } from '../context/NotificationContext';
import { usePageTitle } from '../hooks/usePageTitle';

export default function Personal() {
  usePageTitle('Personal');
  const { showAlert, showConfirm } = useNotification();
  const { userData, role, refreshUserData } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const allCountries = Country.getAllCountries().map(c => c.name).sort();

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    nombre: '', telefono: '', pais: userData?.pais || '', direccion: '', rol: 'tecnico' as UserRole, area_trabajo: '', jefe_inmediato: '', cargo: ''
  });

  const fetchUsers = async () => {
    try {
        const { data: usersData, error } = await supabase.from('users').select('*');
        if (error) throw error;
        
        const updatedUsers = (usersData || []).map(data => {
            let nombre = data.nombre;
            
            // Extract name from email if not defined
            if (!nombre && data.email) {
                const parts = data.email.split('@')[0].split('.');
                nombre = parts.map((part: string) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
                
                // Fire and forget update to DB so it persists
                supabase.from('users').update({ nombre }).eq('id', data.id).then(({error}) => { if(error) console.error(error); });
            }

            return { ...data, nombre };
        });
        setUsers(updatedUsers);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const openEditModal = (user: any) => {
      setEditingUser(user);
      setFormData({
          nombre: user.nombre || '',
          telefono: user.telefono || '',
          pais: user.pais || userData?.pais || '',
          direccion: user.direccion || '',
          rol: user.rol || 'tecnico',
          area_trabajo: user.area_trabajo || '',
          jefe_inmediato: user.jefe_inmediato || '',
          cargo: user.cargo || ''
      });
      setIsEditModalOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!editingUser) return;
      try {
          await supabase.from('users').update(formData).eq('id', editingUser.id);
          setIsEditModalOpen(false);
          fetchUsers();
          if (editingUser.id === userData?.uid) {
              await refreshUserData();
          }
          showAlert("Usuario actualizado correctamente", "success");
      } catch (err) {
          console.error(err);
          showAlert('Error al actualizar el personal', 'error');
      }
  };

  const handleDeleteUser = async (userId: string, currentRole: string) => {
      if(currentRole === 'administrador') {
          return showAlert('No puedes eliminar a un administrador desde esta vista.', 'warning');
      }
      if(await showConfirm('¿Estás seguro de que deseas eliminar permanentemente de la base de datos a este usuario? Esta acción es irreversible.')) {
          try {
              // Delete user data from public.users
              await supabase.from('users').delete().eq('id', userId);
              // Note: Auth user deletion is usually handled via admin api, 
              // but deleting from the public schema is a good start.
              fetchUsers();
              showAlert("Usuario eliminado", "success");
          } catch(err) {
              console.error(err);
              showAlert('Ocurrió un error al intentar eliminar el usuario.', 'error');
          }
      }
  };

  if (role === 'tecnico') return <div className="p-8 text-center text-red-500">Acceso denegado.</div>;

  const coordinadores = users.filter(u => u.rol === 'administrador');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Directorio de Personal</h2>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Cargando personal...</div>
        ) : (
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-max relative">
                <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="p-4 text-sm font-semibold text-gray-600">Personal</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Contacto</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">País</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Rol del Sistema</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Área / Cargo</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Jefe Inmediato</th>
                    <th className="p-4 text-sm font-semibold text-gray-600 text-center sticky right-0 bg-gray-50 z-10 border-l border-gray-200 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)]">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((u) => (
                    <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50 group transition-colors">
                        <td className="p-4">
                           <div className="flex items-center">
                               <div className="w-8 h-8 rounded-full bg-brand-dark text-white flex items-center justify-center font-bold mr-3 shrink-0">
                                   {u.nombre ? u.nombre[0].toUpperCase() : 'U'}
                               </div>
                               <div className="truncate">
                                   <div className="font-medium text-gray-800 truncate">{u.nombre || 'Sin nombre'}</div>
                                   <div className="text-xs text-gray-500 flex items-center truncate"><Mail className="w-3 h-3 mr-1 shrink-0"/> {u.email}</div>
                               </div>
                           </div>
                        </td>
                        <td className="p-4">
                            <div className="text-sm text-gray-700">{u.telefono || '---'}</div>
                        </td>
                        <td className="p-4">
                            <div className="text-sm text-gray-700">{u.pais || '---'}</div>
                        </td>
                        <td className="p-4">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider 
                                ${u.rol === 'administrador' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {u.rol === 'tecnico' ? 'Técnico' : u.rol}
                            </span>
                        </td>
                        <td className="p-4 text-sm text-gray-700">
                            <div>{u.area_trabajo || '---'}</div>
                            {u.cargo && <div className="text-xs text-brand-dark font-semibold mt-0.5">{u.cargo}</div>}
                        </td>
                        <td className="p-4 text-sm text-gray-700">
                            {users.find(c => c.id === u.jefe_inmediato)?.nombre || '---'}
                        </td>
                        <td className="p-4 text-center sticky right-0 bg-white group-hover:bg-gray-50 z-10 border-l border-gray-100 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)] transition-colors">
                            <div className="flex items-center justify-center space-x-2">
                                <button onClick={() => openEditModal(u)} className="p-2 text-brand-dark hover:text-white hover:bg-brand-hover bg-brand-gray border border-brand-dark/20 shadow-sm rounded-lg transition-all" title="Editar Perfil">
                                    <Edit2 className="w-4 h-4"/>
                                </button>
                                {u.rol !== 'administrador' && (
                                    <button onClick={() => handleDeleteUser(u.id, u.rol)} className="p-2 text-red-600 hover:text-white hover:bg-red-600 bg-red-50 border border-red-200 shadow-sm rounded-lg transition-all" title="Eliminar Usuario">
                                        <Trash2 className="w-4 h-4"/>
                                    </button>
                                )}
                            </div>
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
        )}
      </div>

      {isEditModalOpen && editingUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                   <h3 className="text-xl font-bold text-gray-800">Modificar Datos del Personal</h3>
                   <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6"/></button>
                </div>
                <form onSubmit={handleUpdateUser} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div>
                          <label className="block text-sm font-medium mb-1 text-gray-700">Nombre Completo</label>
                          <input required value={formData.nombre} onChange={e=>setFormData({...formData, nombre: e.target.value})} className="w-full border p-2.5 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-brand-dark outline-none" />
                       </div>
                       <div>
                          <label className="block text-sm font-medium mb-1 text-gray-700">Correo Electrónico (Solo Lectura)</label>
                          <input disabled value={editingUser.email} className="w-full border p-2.5 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" />
                       </div>
                       <div>
                          <label className="block text-sm font-medium mb-1 text-gray-700">Teléfono</label>
                          <input value={formData.telefono} onChange={e=>setFormData({...formData, telefono: e.target.value})} className="w-full border p-2.5 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-brand-dark outline-none" />
                       </div>
                       <div>
                          <label className="block text-sm font-medium mb-1 text-gray-700">País</label>
                          <CustomSelect 
                              value={formData.pais} 
                              onChange={(val: string) => setFormData({...formData, pais: val})} 
                              options={[
                                  { value: '', label: 'Selecciona País...' },
                                  ...allCountries.map(p => ({ value: p, label: p }))
                              ]}
                              className="w-full border p-2.5 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-brand-dark outline-none"
                          />
                       </div>
                       <div className="md:col-span-2">
                          <label className="block text-sm font-medium mb-1 text-gray-700">Dirección</label>
                          <input value={formData.direccion} onChange={e=>setFormData({...formData, direccion: e.target.value})} className="w-full border p-2.5 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-brand-dark outline-none" />
                       </div>
                       
                       <div className="col-span-1 md:col-span-2 my-2 border-t border-gray-100 pt-4">
                           <h4 className="text-sm font-bold text-gray-600 mb-4 uppercase tracking-wider">Perfil Operativo del Sistema</h4>
                       </div>

                       <div>
                          <label className="block text-sm font-medium mb-1 text-gray-700">Rol de Sistema</label>
                          <CustomSelect 
                              value={formData.rol} 
                              onChange={(val: string) => setFormData({...formData, rol: val as any})} 
                              options={[
                                  { value: 'tecnico', label: 'Técnico' },
                                  { value: 'administrador', label: 'Administrador' }
                              ]}
                              className="w-full border p-2.5 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-brand-dark outline-none"
                              required
                          />
                       </div>
                       <div>
                          <label className="block text-sm font-medium mb-1 text-gray-700">Área de Trabajo</label>
                          <input value={formData.area_trabajo} onChange={e=>setFormData({...formData, area_trabajo: e.target.value})} placeholder="Ej: Redes, Energía..." className="w-full border p-2.5 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-brand-dark outline-none" />
                       </div>
                       <div>
                          <label className="block text-sm font-medium mb-1 text-gray-700">Cargo en la Organización</label>
                          <input value={formData.cargo} onChange={e=>setFormData({...formData, cargo: e.target.value})} placeholder="Ej: Técnico Senior, Supervisor TI..." className="w-full border p-2.5 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-brand-dark outline-none" />
                       </div>
                       <div className="md:col-span-2">
                          <label className="block text-sm font-medium mb-1 text-gray-700">Jefe Inmediato Asignado</label>
                          <CustomSelect 
                              value={formData.jefe_inmediato} 
                              onChange={(val: string) => setFormData({...formData, jefe_inmediato: val})} 
                              options={[
                                  { value: '', label: 'Sin Jefe Asignado' },
                                  ...coordinadores.map(c => ({ value: c.id, label: c.nombre || c.email }))
                              ]}
                              className="w-full border p-2.5 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-brand-dark outline-none"
                          />
                       </div>
                    </div>
                    
                    <div className="flex justify-end space-x-3 pt-6 mt-4 border-t border-gray-100">
                        <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Cancelar</button>
                        <button type="submit" className="px-5 py-2.5 text-sm font-semibold text-white bg-brand-dark hover:bg-brand-hover rounded-xl shadow-sm transition-colors">Actualizar Datos</button>
                    </div>
                </form>
            </div>
          </div>
      )}
    </div>
  );
}
