import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { Plus, Edit2, Trash2, ArrowLeft, Monitor, Wifi, Zap, Printer } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCategoriasInventario } from '../hooks/useCategoriasInventario';
import { useNotification } from '../context/NotificationContext';
import { usePageTitle } from '../hooks/usePageTitle';

import { CustomSelect } from '../components/CustomSelect';

export default function Inventario() {
  usePageTitle('Inventario');
  const { showAlert, showConfirm } = useNotification();
  const { tiendaId } = useParams();
  const navigate = useNavigate();
  const [inventario, setInventario] = useState<any[]>([]);
  const [componentes, setComponentes] = useState<any[]>([]);
  const [tiendaData, setTiendaData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    id_componente: '', categoria_componente: '', subcategoria_componente: '', marca: '', modelo: '', serial: '', estado_fisico: 'Bueno', estado_operativo: 'Operativo'
  });

  const { categorias, loadingCategorias } = useCategoriasInventario();

  const fetchInventario = async () => {
    if (!tiendaId) return;
    try {
        const { data, error } = await supabase.from('inventario').select('*').eq('id_tienda', tiendaId);
        if (error) throw error;
        setInventario(data || []);
        
        const { data: compData } = await supabase.from('preguntas_componentes').select('*');
        if (compData) setComponentes(compData);
        
        const { data: tData } = await supabase.from('tiendas').select('id_tienda, tienda, domicilio_tienda, pais_tienda').eq('id', tiendaId).single();
        if (tData) setTiendaData(tData);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => { fetchInventario(); }, [tiendaId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        const { error } = await supabase.from('inventario').update(formData).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('inventario').insert({ ...formData, id_tienda: tiendaId });
        if (error) throw error;
      }
      setIsModalOpen(false);
      fetchInventario();
      showAlert("Componente guardado exitosamente", "success");
    } catch (e: any) { 
      console.error(e); 
      showAlert(`Error guardando componente: ${e.message || ''}`, "error"); 
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await showConfirm("¿Eliminar componente?"))) return;
    try {
      await supabase.from('inventario').delete().eq('id', id);
      fetchInventario();
    } catch (e) { console.error(e); }
  };

  const getIcon = (cat: string) => {
    if (!cat) return <Monitor className="w-5 h-5 text-gray-500" />;
    if (cat.includes('Computación')) return <Monitor className="w-5 h-5 text-blue-500" />;
    if (cat.includes('Red')) return <Wifi className="w-5 h-5 text-purple-500" />;
    if (cat.includes('Energía')) return <Zap className="w-5 h-5 text-brand-orange" />;
    if (cat.includes('Impresión')) return <Printer className="w-5 h-5 text-gray-500" />;
    return <Monitor className="w-5 h-5 text-gray-500" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4 mb-4">
         <button onClick={() => navigate('/tiendas')} className="p-2 hover:bg-white rounded-full transition-colors"><ArrowLeft className="w-6 h-6" /></button>
         <div>
            <h2 className="text-2xl font-bold text-gray-800">
              Inventario de Hardware {tiendaData ? `- ${tiendaData.id_tienda}${tiendaData.tienda ? ` ${tiendaData.tienda}` : ''}${tiendaData.pais_tienda ? ` (${tiendaData.pais_tienda})` : ''}` : ''}
            </h2>
            <p className="text-gray-500 text-sm">Gestiona los componentes tecnológicos de esta tienda</p>
         </div>
      </div>

      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
         <div className="text-sm font-medium text-gray-600">
            Total activos: <span className="text-brand-dark font-bold text-lg ml-1">{inventario.length}</span>
         </div>
         <button 
            onClick={() => { setEditingItem(null); setFormData({id_componente: '', categoria_componente: '', subcategoria_componente: '', marca: '', modelo: '', serial: '', estado_fisico: 'Bueno', estado_operativo: 'Operativo'}); setIsModalOpen(true); }}
            className="flex items-center px-4 py-2 bg-brand-dark text-white rounded-xl hover:bg-brand-hover transition-colors"
         >
            <Plus className="w-5 h-5 mr-2" /> Agregar Item
         </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Cargando inventario...</div>
        ) : (
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-max relative">
                <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="p-4 text-sm font-semibold text-gray-600">Categoría</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Marca / Modelo</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">ID / Serial</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Estado Físico</th>
                    <th className="p-4 text-sm font-semibold text-gray-600">Operatividad</th>
                    <th className="p-4 text-sm font-semibold text-gray-600 text-center sticky right-0 bg-gray-50 z-10 border-l border-gray-200">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {inventario.map(item => (
                      <tr key={item.id} className="border-b border-gray-100 group hover:bg-gray-50 transition-colors">
                          <td className="p-4">
                             <div className="flex items-center space-x-3">
                                <div className="p-2 bg-white rounded-lg border border-gray-100 shadow-sm">{getIcon(item.categoria_componente)}</div>
                                <div>
                                   <p className="text-sm font-semibold text-gray-800">{item.categoria_componente}</p>
                                   <p className="text-xs text-gray-500">{item.subcategoria_componente}</p>
                                </div>
                             </div>
                          </td>
                          <td className="p-4">
                             <h4 className="font-bold text-gray-800">{item.marca}</h4>
                             <p className="text-sm text-gray-600">{item.modelo}</p>
                          </td>
                          <td className="p-4">
                             <span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs font-semibold">{item.id_componente || '—'}</span>
                             <div className="text-xs text-gray-500 mt-1">SN: {item.serial || '—'}</div>
                          </td>
                          <td className="p-4">
                             <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${item.estado_fisico?.includes('Malo') ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>{item.estado_fisico}</span>
                          </td>
                          <td className="p-4">
                             <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${item.estado_operativo === 'Operativo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{item.estado_operativo}</span>
                          </td>
                          <td className="p-4 text-center space-x-2 sticky right-0 bg-white group-hover:bg-gray-50 z-10 border-l border-gray-100">
                             <button onClick={() => { setEditingItem(item); setFormData(item); setIsModalOpen(true); }} className="p-2 text-gray-400 hover:text-brand-dark bg-gray-50 hover:bg-white rounded border border-transparent hover:border-gray-200 transition-colors" title="Editar"><Edit2 className="w-4 h-4"/></button>
                             <button onClick={() => handleDelete(item.id)} className="p-2 text-gray-400 hover:text-red-600 bg-gray-50 hover:bg-white rounded border border-transparent hover:border-gray-200 transition-colors" title="Eliminar"><Trash2 className="w-4 h-4"/></button>
                          </td>
                      </tr>
                    ))}
                    {inventario.length === 0 && (
                        <tr><td colSpan={6} className="p-8 text-center text-gray-500 bg-gray-50 border border-dashed border-gray-300 m-4 rounded-xl">No hay equipos registrados.</td></tr>
                    )}
                </tbody>
                </table>
            </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl relative mt-10">
                <h3 className="text-xl font-bold mb-4">{editingItem ? 'Editar Componente' : 'Nuevo Componente'}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                           <label className="block text-sm font-medium mb-1">Categoría</label>
                           <CustomSelect 
                              value={formData.categoria_componente} 
                              onChange={(val: string) => setFormData({...formData, categoria_componente: val, subcategoria_componente: ''})} 
                              options={categorias.map(c => ({ value: c.nombre, label: c.nombre }))}
                              className="w-full border p-2 rounded-lg bg-white text-sm"
                              required
                           />
                        </div>
                        <div>
                           <label className="block text-sm font-medium mb-1">Componente</label>
                           <CustomSelect 
                              value={formData.subcategoria_componente} 
                              onChange={(val: string) => setFormData({...formData, subcategoria_componente: val})} 
                              options={componentes.filter(comp => comp.categoria_id === categorias.find(c => c.nombre === formData.categoria_componente)?.id).map((comp: any) => ({ value: comp.name, label: comp.name }))}
                              disabled={!formData.categoria_componente}
                              className={`w-full border p-2 rounded-lg text-sm ${!formData.categoria_componente ? 'bg-gray-50' : 'bg-white'}`}
                           />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium mb-1">ID Componente (Registro)</label><input required value={formData.id_componente} onChange={e=>setFormData({...formData, id_componente: e.target.value})} className="w-full border p-2 rounded-lg font-mono text-sm truncate" /></div>
                        <div><label className="block text-sm font-medium mb-1">Número de Serie</label><input value={formData.serial} onChange={e=>setFormData({...formData, serial: e.target.value})} className="w-full border p-2 rounded-lg font-mono text-sm truncate" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium mb-1">Marca</label><input required value={formData.marca} onChange={e=>setFormData({...formData, marca: e.target.value})} placeholder="Ej: Fortinet" className="w-full border p-2 rounded-lg truncate" /></div>
                        <div><label className="block text-sm font-medium mb-1">Modelo</label><input required value={formData.modelo} onChange={e=>setFormData({...formData, modelo: e.target.value})} className="w-full border p-2 rounded-lg truncate" /></div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <div>
                            <label className="block text-sm font-medium mb-1">Estado Físico</label>
                            <CustomSelect 
                                value={formData.estado_fisico} 
                                onChange={(val: string) => setFormData({...formData, estado_fisico: val})} 
                                options={[
                                  { value: 'Bueno (Limpio/Sin daños)', label: 'Bueno (Limpio/Sin daños)' },
                                  { value: 'Regular (Sucio/Desgaste)', label: 'Regular (Sucio/Desgaste)' },
                                  { value: 'Malo (Daños visibles)', label: 'Malo (Daños visibles)' }
                                ]}
                                className="w-full border p-2 rounded-lg bg-white text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Condición Operativa</label>
                            <CustomSelect 
                                value={formData.estado_operativo} 
                                onChange={(val: string) => setFormData({...formData, estado_operativo: val})} 
                                options={[
                                  { value: 'Operativo', label: 'Operativo' },
                                  { value: 'Falla Parcial', label: 'Falla Parcial' },
                                  { value: 'Inoperativo', label: 'Inoperativo' }
                                ]}
                                className="w-full border p-2 rounded-lg bg-white text-sm"
                            />
                        </div>
                    </div>
                    
                    <div className="flex justify-end space-x-3 pt-6">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 hover:bg-gray-100 rounded-lg">Cancelar</button>
                        <button type="submit" className="px-4 py-2 bg-brand-dark text-white rounded-lg hover:bg-brand-hover">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}
