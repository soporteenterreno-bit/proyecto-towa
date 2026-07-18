import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Calendar, Building, CheckSquare } from 'lucide-react';
import { sendVisitNotificationEmail } from '../utils/emailService';
import { usePaisesTiendas } from '../hooks/usePaisesTiendas';
import { useNotification } from '../context/NotificationContext';
import { usePageTitle } from '../hooks/usePageTitle';

export default function AsignarVisita() {
  usePageTitle('Asignar Visita');
  const { showAlert } = useNotification();
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [tiendas, setTiendas] = useState<any[]>([]);
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [categoriasList, setCategoriasList] = useState<any[]>([]);
  const [componentesList, setComponentesList] = useState<any[]>([]);
  const [expandedCatAsignar, setExpandedCatAsignar] = useState<string[]>([]);

  
  const [formData, setFormData] = useState({
    tipo: 'Programada', // 'Programada' | 'Falla' | 'Rutina'
    pais: userData?.pais || '',
    id_tienda: '',
    tecnico_uid: '',
    fecha_programada: '',
    tt_number: '',
    notas_coordinador: '',
    prioridad: 'Media',
    correo_encargado: '',
    componentes_afectados: [] as string[]
  });

  useEffect(() => {
    const fetchBaseData = async () => {
      const { data: tSnap } = await supabase.from('tiendas').select('*');
      if (tSnap) setTiendas(tSnap);
      
      const { data: uSnap } = await supabase.from('users').select('*');
      if (uSnap) setTecnicos(uSnap.filter((u:any) => u.rol === 'tecnico'));

      const { data: cSnap } = await supabase.from('preguntas_componentes').select('*');
      if (cSnap) setComponentesList(cSnap);
      
      const { data: catSnap } = await supabase.from('categorias_inventario').select('*').order('nombre');
      if (catSnap) setCategoriasList(catSnap);
    };
    fetchBaseData();
  }, []);
  
  const { paises } = usePaisesTiendas();
  
  useEffect(() => {
    if (userData?.pais && !formData.pais) {
      setFormData(prev => ({ ...prev, pais: userData.pais }));
    }
  }, [userData]);

  const tiendasFiltradas = formData.pais ? tiendas.filter(t => t.pais_tienda === formData.pais) : [];
  const tecnicosFiltrados = formData.pais ? tecnicos.filter(u => u.pais === formData.pais) : tecnicos;

  const getMinDate = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const toggleComponente = (compId: string) => {
    setFormData(prev => {
      if (prev.componentes_afectados.includes(compId)) {
        return { ...prev, componentes_afectados: prev.componentes_afectados.filter(id => id !== compId) };
      } else {
        return { ...prev, componentes_afectados: [...prev.componentes_afectados, compId] };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id_tienda || !formData.fecha_programada) return showAlert("Faltan campos obligatorios: tienda y fecha", "warning");
    if (formData.tipo === 'Falla' && !formData.tt_number) return showAlert("Para visitas de Falla es obligatorio el Número de TT", "warning");

    if (formData.fecha_programada < getMinDate()) {
        return showAlert("La fecha de la visita no puede ser en el pasado.", "warning");
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('visitas').insert({
        tipo: formData.tipo,
        tecnico_uid: formData.tecnico_uid || null,
        coordinador_uid: userData?.uid,
        id_tienda: formData.id_tienda,
        status: 'Pendiente',
        fecha_programada: formData.fecha_programada,
        tt_number: formData.tipo === 'Falla' ? formData.tt_number : null,
        prioridad: formData.prioridad,
        correo_encargado: formData.correo_encargado || null,
        componentes_afectados: formData.componentes_afectados,
        notas_coordinador: formData.notas_coordinador,
        createdAt: new Date().toISOString()
      });
      if (error) throw error;

      // Send Email if specified
      if (formData.correo_encargado) {
          const tiendaSeleccionada = tiendas.find(t => t.id === formData.id_tienda);
          const tecnicoSeleccionado = tecnicos.find(t => t.id === formData.tecnico_uid);
          
          await sendVisitNotificationEmail({
              to_email: formData.correo_encargado,
              fecha_programada: formData.fecha_programada,
              prioridad: formData.prioridad,
              tipo_visita: formData.tipo,
              tienda_codigo: tiendaSeleccionada?.id_tienda || 'N/A',
              tienda_nombre: tiendaSeleccionada?.tienda || 'N/A',
              tienda_ciudad: tiendaSeleccionada?.ciudad_tienda || 'N/A',
              tecnico_nombre: tecnicoSeleccionado?.nombre || ''
          });
      }

      showAlert('Visita asignada exitosamente', 'success');
      navigate('/visitas/tabla');
    } catch (error) {
      console.error(error);
      showAlert('Error al asignar visita', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-brand-dark p-6 text-white">
          <h2 className="text-2xl font-bold">Asignar Nueva Visita</h2>
          <p className="text-gray-300 mt-1">Completa los datos para enviar la orden al técnico en campo.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-1 md:col-span-2">
               <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Visita</label>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <label className={`flex flex-col items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition-all ${formData.tipo === 'Programada' ? 'border-brand-dark bg-brand-gray text-brand-dark' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    <input type="radio" name="tipo" value="Programada" checked={formData.tipo === 'Programada'} onChange={(e)=>setFormData({...formData, tipo: e.target.value})} className="sr-only"/>
                    <Calendar className="w-8 h-8 mb-2" />
                    <span className="font-semibold text-center text-sm">Mantenimiento Programado</span>
                  </label>
                  <label className={`flex flex-col items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition-all ${formData.tipo === 'Falla' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    <input type="radio" name="tipo" value="Falla" checked={formData.tipo === 'Falla'} onChange={(e)=>setFormData({...formData, tipo: e.target.value})} className="sr-only"/>
                    <AlertTriangle className="w-8 h-8 mb-2" />
                    <span className="font-semibold text-center text-sm">Atención de Falla</span>
                  </label>
                  <label className={`flex flex-col items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition-all ${formData.tipo === 'Rutina' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    <input type="radio" name="tipo" value="Rutina" checked={formData.tipo === 'Rutina'} onChange={(e)=>setFormData({...formData, tipo: e.target.value})} className="sr-only"/>
                    <Building className="w-8 h-8 mb-2" />
                    <span className="font-semibold text-center text-sm">Oficina / Rutina</span>
                  </label>
               </div>
            </div>

            {formData.tipo === 'Falla' && (
                <div className="col-span-1 md:col-span-2 p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-start">
                    <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 mr-3 flex-shrink-0" />
                    <div className="w-full">
                        <label className="block text-sm font-bold text-orange-800 mb-1">Número de Trouble Ticket (TT) *</label>
                        <input 
                            required 
                            type="text" 
                            placeholder="Ej: TT-2024-001"
                            value={formData.tt_number}
                            onChange={e => setFormData({...formData, tt_number: e.target.value})}
                            className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                    </div>
                </div>
            )}

            <div className="col-span-1 md:col-span-2 space-y-4 bg-gray-50 p-5 rounded-xl border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                    <CheckSquare className="w-5 h-5 text-brand-dark" />
                    <h3 className="font-bold text-gray-800 text-lg">Componentes a Revisar</h3>
                </div>
                {categoriasList.length === 0 ? (
                    <p className="text-sm text-gray-500">No hay categorías ni componentes configurados en el sistema.</p>
                ) : (
                    <div className="space-y-3">
                        {categoriasList.map(cat => {
                            const catComponents = componentesList.filter(c => c.categoria_id === cat.id);
                            if (catComponents.length === 0) return null;
                            const isExpanded = expandedCatAsignar.includes(cat.id);
                            
                            return (
                                <div key={cat.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                                    <div 
                                        className="p-3 bg-gray-100 flex justify-between items-center cursor-pointer hover:bg-gray-200 transition-colors"
                                        onClick={() => {
                                            setExpandedCatAsignar(prev => prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id]);
                                        }}
                                    >
                                        <span className="font-bold text-gray-800">{cat.nombre}</span>
                                        <div className="flex items-center">
                                            <span className="text-xs font-medium text-gray-500 mr-2">{catComponents.filter(c => formData.componentes_afectados.includes(c.id)).length} seleccionados</span>
                                            <span className="text-xs text-gray-400">({catComponents.length} totales)</span>
                                        </div>
                                    </div>
                                    {isExpanded && (
                                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 bg-white border-t border-gray-200">
                                            {catComponents.map(comp => (
                                                <label key={comp.id} className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${formData.componentes_afectados.includes(comp.id) ? 'bg-brand-dark border-brand-dark text-white' : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700'}`}>
                                                    <input 
                                                        type="checkbox"
                                                        className="sr-only"
                                                        checked={formData.componentes_afectados.includes(comp.id)}
                                                        onChange={() => toggleComponente(comp.id)}
                                                    />
                                                    <span className="font-medium text-sm text-center w-full">{comp.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">País Target</label>
              <select required value={formData.pais} onChange={e=>setFormData({...formData, pais: e.target.value, id_tienda: '', tecnico_uid: ''})} className="w-full border-gray-300 border p-2.5 rounded-xl bg-white focus:ring-brand-dark focus:border-brand-dark">
                <option value="">Selecciona País...</option>
                {paises.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Programada</label>
              <input min={getMinDate()} required type="date" value={formData.fecha_programada} onChange={e=>setFormData({...formData, fecha_programada: e.target.value})} className="w-full border-gray-300 border p-2.5 rounded-xl bg-white focus:ring-brand-dark focus:border-brand-dark" />
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tienda a Visitar</label>
              <select required disabled={!formData.pais} value={formData.id_tienda} onChange={e=>setFormData({...formData, id_tienda: e.target.value})} className="w-full border-gray-300 border p-2.5 rounded-xl bg-white focus:ring-brand-dark focus:border-brand-dark disabled:bg-gray-100 disabled:text-gray-400">
                <option value="">{formData.pais ? 'Selecciona una tienda...' : 'Primero selecciona un país'}</option>
                {tiendasFiltradas.map(t => <option key={t.id} value={t.id}>{t.id_tienda} - {t.tienda} ({t.ciudad_tienda})</option>)}
              </select>
            </div>

            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Técnico Asignado <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <select disabled={!formData.pais} value={formData.tecnico_uid} onChange={e=>setFormData({...formData, tecnico_uid: e.target.value})} className="w-full border-gray-300 border p-2.5 rounded-xl bg-white focus:ring-brand-dark focus:border-brand-dark disabled:bg-gray-100 disabled:text-gray-400">
                <option value="">{formData.pais ? '— Sin asignar (pool) —' : 'Primero selecciona país'}</option>
                {tecnicosFiltrados.map(t => <option key={t.id} value={t.id}>{t.nombre || t.email}</option>)}
              </select>
            </div>

            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
              <select required value={formData.prioridad} onChange={e=>setFormData({...formData, prioridad: e.target.value})} className="w-full border-gray-300 border p-2.5 rounded-xl bg-white focus:ring-brand-dark focus:border-brand-dark">
                <option value="Baja">Baja</option>
                <option value="Media">Media</option>
                <option value="Alta">Alta</option>
                <option value="Urgente">Urgente</option>
              </select>
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo del Encargado (Opcional - Notificación)</label>
              <input 
                type="email" 
                placeholder="encargado@empresa.com"
                value={formData.correo_encargado} 
                onChange={e=>setFormData({...formData, correo_encargado: e.target.value})} 
                className="w-full border-gray-300 border p-2.5 rounded-xl bg-white focus:ring-brand-dark focus:border-brand-dark" 
              />
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas / Instrucciones del Coordinador</label>
              <textarea 
                rows={3}
                placeholder="Instrucciones específicas para el técnico o detalle de la falla..."
                value={formData.notas_coordinador} onChange={e=>setFormData({...formData, notas_coordinador: e.target.value})} 
                className="w-full border-gray-300 border p-2.5 rounded-xl bg-white focus:ring-brand-dark focus:border-brand-dark" />
            </div>
            
          </div>

          <div className="pt-6 border-t border-gray-100 flex justify-end">
            <button type="submit" disabled={loading} className="px-8 py-3 bg-brand-dark hover:bg-brand-hover text-white font-bold rounded-xl transition-colors disabled:opacity-50">
              {loading ? 'Procesando...' : 'Asignar Visita Oficial'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
