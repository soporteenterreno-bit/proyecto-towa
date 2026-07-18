import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Plus, Edit2, Trash2, ArrowLeft, Monitor, Wifi, Zap, Printer } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCategoriasInventario } from '../hooks/useCategoriasInventario';
import { useNotification } from '../context/NotificationContext';
import { usePageTitle } from '../hooks/usePageTitle';

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
    id_componente: '', categoria_componente: '', subcategoria_componente: '', marca: '', modelo: '', serial: '', estado_fisico: 'Bueno', status_componente: 'Operativo'
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
        await supabase.from('inventario').update(formData).eq('id', editingItem.id);
      } else {
        await supabase.from('inventario').insert({ ...formData, id_tienda: tiendaId });
      }
      setIsModalOpen(false);
      fetchInventario();
      showAlert("Componente guardado exitosamente", "success");
    } catch (e) { console.error(e); showAlert("Error guardando componente", "error"); }
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
            onClick={() => { setEditingItem(null); setFormData({id_componente: '', categoria_componente: '', subcategoria_componente: '', marca: '', modelo: '', serial: '', estado_fisico: 'Bueno', status_componente: 'Operativo'}); setIsModalOpen(true); }}
            className="flex items-center px-4 py-2 bg-brand-dark text-white rounded-xl hover:bg-brand-hover transition-colors"
         >
            <Plus className="w-5 h-5 mr-2" /> Agregar Item
         </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {loading ? <p className="text-gray-500 p-4">Cargando inventario...</p> : 
          inventario.map(item => (
             <div key={item.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center space-x-3">
                     <div className="p-2 bg-gray-50 rounded-lg">{getIcon(item.categoria_componente)}</div>
                     <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{item.categoria_componente} {item.subcategoria_componente ? `> ${item.subcategoria_componente}` : ''}</p>
                        <h4 className="font-bold text-gray-800">{item.marca} {item.modelo}</h4>
                     </div>
                  </div>
                  <div className="flex space-x-1">
                     <button onClick={() => { setEditingItem(item); setFormData(item); setIsModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-brand-dark bg-gray-50 rounded"><Edit2 className="w-4 h-4"/></button>
                     <button onClick={() => handleDelete(item.id)} className="p-1.5 text-gray-400 hover:text-red-600 bg-gray-50 rounded"><Trash2 className="w-4 h-4"/></button>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                   <div className="flex justify-between"><span className="text-gray-500">ID / Serial:</span><span className="font-mono bg-gray-50 px-2 rounded border border-gray-100 text-xs">{item.id_componente || '—'} / {item.serial || '—'}</span></div>
                   <div className="flex justify-between"><span className="text-gray-500">Estado Físico:</span><span className={item.estado_fisico?.includes('Malo') ? 'text-red-500 font-medium' : 'text-gray-700'}>{item.estado_fisico}</span></div>
                   <div className="flex justify-between"><span className="text-gray-500">Operatividad:</span><span className={item.status_componente === 'Operativo' ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>{item.status_componente}</span></div>
                </div>
             </div>
          ))
         }
         {!loading && inventario.length === 0 && <div className="col-span-full p-8 text-center bg-white rounded-2xl border border-dashed border-gray-300 text-gray-500">No hay equipos registrados.</div>}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative mt-10">
                <h3 className="text-xl font-bold mb-4">{editingItem ? 'Editar Componente' : 'Nuevo Componente'}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="block text-sm font-medium mb-1">Categoría</label>
                           <select required value={formData.categoria_componente} onChange={e=>setFormData({...formData, categoria_componente: e.target.value, subcategoria_componente: ''})} className="w-full border p-2 rounded-lg bg-white">
                              <option value="">Selecciona...</option>
                              {categorias.map(c => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}
                           </select>
                        </div>
                        <div>
                           <label className="block text-sm font-medium mb-1">Componente</label>
                           <select value={formData.subcategoria_componente} onChange={e=>setFormData({...formData, subcategoria_componente: e.target.value})} className="w-full border p-2 rounded-lg bg-white" disabled={!formData.categoria_componente}>
                              <option value="">Selecciona...</option>
                              {componentes.filter(comp => comp.categoria_id === categorias.find(c => c.nombre === formData.categoria_componente)?.id).map((comp: any) => <option key={comp.id} value={comp.name}>{comp.name}</option>)}
                           </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium mb-1">ID Componente (Registro)</label><input required value={formData.id_componente} onChange={e=>setFormData({...formData, id_componente: e.target.value})} className="w-full border p-2 rounded-lg font-mono text-sm" /></div>
                        <div><label className="block text-sm font-medium mb-1">Número de Serie</label><input value={formData.serial} onChange={e=>setFormData({...formData, serial: e.target.value})} className="w-full border p-2 rounded-lg font-mono text-sm" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium mb-1">Marca</label><input required value={formData.marca} onChange={e=>setFormData({...formData, marca: e.target.value})} placeholder="Ej: Fortinet" className="w-full border p-2 rounded-lg" /></div>
                        <div><label className="block text-sm font-medium mb-1">Modelo</label><input required value={formData.modelo} onChange={e=>setFormData({...formData, modelo: e.target.value})} className="w-full border p-2 rounded-lg" /></div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <div>
                            <label className="block text-sm font-medium mb-1">Estado Físico</label>
                            <select value={formData.estado_fisico} onChange={e=>setFormData({...formData, estado_fisico: e.target.value})} className="w-full border p-2 rounded-lg bg-white">
                                <option>Bueno (Limpio/Sin daños)</option>
                                <option>Regular (Sucio/Desgaste)</option>
                                <option>Malo (Daños visibles)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Condición Operativa</label>
                            <select value={formData.status_componente} onChange={e=>setFormData({...formData, status_componente: e.target.value})} className="w-full border p-2 rounded-lg bg-white">
                                <option>Operativo</option>
                                <option>Falla Parcial</option>
                                <option>Inoperativo</option>
                            </select>
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
