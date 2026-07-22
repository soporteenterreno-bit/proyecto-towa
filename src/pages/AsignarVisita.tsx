import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Calendar, Building, CheckSquare, Search, X, Trash2, CheckCircle2 } from 'lucide-react';
import { sendVisitNotificationEmail } from '../utils/emailService';
import { usePaisesTiendas } from '../hooks/usePaisesTiendas';
import { useNotification } from '../context/NotificationContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { CustomSelect } from '../components/CustomSelect';

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
  const [searchComponente, setSearchComponente] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState('ALL');

  
  const [formData, setFormData] = useState({
    tipo: 'Programada', // 'Programada' | 'Falla' | 'Oficina'
    pais: userData?.pais || '',
    id_tienda: '',
    tecnico_uid: userData?.uid || '',
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
      if (uSnap) setTecnicos(uSnap.filter((u:any) => u.rol === 'tecnico' || u.rol === 'administrador'));

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

  const tiendasFiltradas = formData.pais ? tiendas.filter(t => t.pais_tienda === formData.pais && (formData.tipo === 'Oficina' ? t.tipo === 'Oficina' : t.tipo !== 'Oficina')) : [];
  const tecnicosFiltrados = formData.pais ? tecnicos.filter(u => u.pais === formData.pais) : tecnicos;

  const getMinDate = () => {
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    return today.toISOString().slice(0, 16);
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

  const validCategorias = categoriasList.filter(cat => (cat.tipo || 'Tienda') === (formData.tipo === 'Oficina' ? 'Oficina' : 'Tienda'));
  const validCategoriaIds = validCategorias.map(c => c.id);
  const availableComponents = componentesList.filter(c => validCategoriaIds.includes(c.categoria_id));
  const filteredComponents = availableComponents.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchComponente.toLowerCase());
    const matchesCat = filtroCategoria === 'ALL' || c.categoria_id === filtroCategoria;
    return matchesSearch && matchesCat;
  });

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredComponents.map(c => c.id);
    setFormData(prev => ({
        ...prev,
        componentes_afectados: Array.from(new Set([...prev.componentes_afectados, ...filteredIds]))
    }));
  };

  const handleClearAll = () => {
    setFormData(prev => ({ ...prev, componentes_afectados: [] }));
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
                    <input type="radio" name="tipo" value="Programada" checked={formData.tipo === 'Programada'} onChange={(e)=>setFormData({...formData, tipo: e.target.value, id_tienda: ''})} className="sr-only"/>
                    <Calendar className="w-8 h-8 mb-2" />
                    <span className="font-semibold text-center text-sm">Mantenimiento Programado</span>
                  </label>
                  <label className={`flex flex-col items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition-all ${formData.tipo === 'Falla' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    <input type="radio" name="tipo" value="Falla" checked={formData.tipo === 'Falla'} onChange={(e)=>setFormData({...formData, tipo: e.target.value, id_tienda: ''})} className="sr-only"/>
                    <AlertTriangle className="w-8 h-8 mb-2" />
                    <span className="font-semibold text-center text-sm">Atención de Falla</span>
                  </label>
                  <label className={`flex flex-col items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition-all ${formData.tipo === 'Oficina' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    <input type="radio" name="tipo" value="Oficina" checked={formData.tipo === 'Oficina'} onChange={(e)=>setFormData({...formData, tipo: e.target.value, id_tienda: ''})} className="sr-only"/>
                    <Building className="w-8 h-8 mb-2" />
                    <span className="font-semibold text-center text-sm">Oficina</span>
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
                {validCategorias.length === 0 ? (
                    <p className="text-sm text-gray-500">No hay categorías ni componentes configurados para este tipo de visita.</p>
                ) : (
                    <div className="space-y-4">
                        {/* Selected Tags Area */}
                        {formData.componentes_afectados.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {formData.componentes_afectados.map(compId => {
                                    const comp = componentesList.find(c => c.id === compId);
                                    if (!comp) return null;
                                    return (
                                        <span key={compId} className="inline-flex items-center gap-1 pl-3 pr-1 py-1 bg-brand-dark text-white text-xs font-semibold rounded-full">
                                            {comp.name}
                                            <button type="button" onClick={() => toggleComponente(compId)} className="hover:bg-red-500 rounded-full p-1 transition-colors">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    );
                                })}
                            </div>
                        )}

                        {/* Search Bar & Floating Dropdown */}
                        <div className="relative">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input 
                                    type="text"
                                    placeholder="Buscar componente (ej: impresora)..."
                                    value={searchComponente}
                                    onChange={e => setSearchComponente(e.target.value)}
                                    onFocus={() => setShowDropdown(true)}
                                    onClick={() => setShowDropdown(true)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-dark focus:border-brand-dark outline-none text-sm bg-white"
                                />
                            </div>

                            {/* Filtered Components List (Floating) */}
                            {showDropdown && (
                                <>
                                    {/* Invisible overlay to close dropdown when clicking outside */}
                                    <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
                                    
                                    <div className="absolute z-20 w-full mt-2 border border-gray-200 rounded-xl bg-white shadow-xl flex flex-col overflow-visible">
                                        
                                        {/* Dropdown Header: Actions & Filters */}
                                        <div className="p-3 bg-gray-50 rounded-t-xl border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-3 relative z-40">
                                            <div className="flex gap-2 w-full sm:w-auto">
                                                <button type="button" onClick={handleSelectAllFiltered} className="flex-1 sm:flex-none text-xs font-bold px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors flex items-center justify-center gap-1">
                                                    <CheckCircle2 className="w-4 h-4"/> Sel. Todos
                                                </button>
                                                <button type="button" onClick={handleClearAll} className="flex-1 sm:flex-none text-xs font-bold px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg transition-colors flex items-center justify-center gap-1">
                                                    <Trash2 className="w-4 h-4"/> Limpiar
                                                </button>
                                            </div>
                                            
                                            <div className="w-full sm:w-auto">
                                                <CustomSelect 
                                                    value={filtroCategoria}
                                                    onChange={val => setFiltroCategoria(val)}
                                                    options={[
                                                        { value: 'ALL', label: 'Todas las Categorías' },
                                                        ...validCategorias.map(c => ({ value: c.id, label: c.nombre }))
                                                    ]}
                                                    containerClassName="w-full sm:w-[190px]"
                                                    className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-dark bg-white font-medium text-gray-700 shadow-sm"
                                                />
                                            </div>
                                        </div>

                                        {/* Scrollable List */}
                                        <div className="max-h-60 overflow-y-auto p-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 relative z-30">
                                            {filteredComponents.length > 0 ? filteredComponents.map(comp => {
                                                const isSelected = formData.componentes_afectados.includes(comp.id);
                                                return (
                                                    <label key={comp.id} className={`flex items-center p-2.5 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'bg-brand-dark border-brand-dark text-white shadow-sm' : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700'}`}>
                                                        <input 
                                                            type="checkbox"
                                                            className="sr-only"
                                                            checked={isSelected}
                                                            onChange={() => toggleComponente(comp.id)}
                                                        />
                                                        <span className="font-medium text-sm truncate w-full text-center" title={comp.name}>{comp.name}</span>
                                                    </label>
                                                );
                                            }) : (
                                                <p className="text-sm text-gray-500 col-span-full p-6 text-center">No se encontraron componentes para esta búsqueda o filtro.</p>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">País Target</label>
              <CustomSelect 
                value={formData.pais} 
                onChange={(val: string) => setFormData({...formData, pais: val, id_tienda: '', tecnico_uid: ''})} 
                options={[
                  { value: '', label: 'Selecciona País...' },
                  ...paises.map(p => ({ value: p, label: p }))
                ]}
                className="w-full border-gray-300 border p-2.5 rounded-xl bg-white focus:ring-brand-dark focus:border-brand-dark"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fecha y Hora Programada *</label>
              <input min={getMinDate()} required type="datetime-local" value={formData.fecha_programada} onChange={e=>setFormData({...formData, fecha_programada: e.target.value})} className="w-full border-gray-300 border p-2.5 rounded-xl bg-white focus:ring-brand-dark focus:border-brand-dark" />
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{formData.tipo === 'Oficina' ? 'Oficina a Visitar' : 'Tienda a Visitar'}</label>
              <CustomSelect 
                value={formData.id_tienda} 
                onChange={(val: string) => setFormData({...formData, id_tienda: val})} 
                disabled={!formData.pais}
                placeholder={formData.pais ? (formData.tipo === 'Oficina' ? 'Selecciona una oficina...' : 'Selecciona una tienda...') : 'Primero selecciona un país'}
                options={tiendasFiltradas.map(t => ({ value: t.id, label: `${t.id_tienda} - ${t.tienda} (${t.ciudad_tienda})` }))}
                className="w-full border-gray-300 border p-2.5 rounded-xl bg-white focus:ring-brand-dark focus:border-brand-dark disabled:bg-gray-100 disabled:text-gray-400"
                required
                searchable={true}
              />
            </div>

            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Técnico Asignado
              </label>
              <CustomSelect 
                value={formData.tecnico_uid} 
                onChange={(val: string) => setFormData({...formData, tecnico_uid: val})} 
                disabled={!formData.pais}
                options={[
                  ...tecnicosFiltrados.map(t => ({ 
                    value: t.id, 
                    label: t.nombre || t.email,
                    subLabel: t.rol === 'administrador' ? 'ADM' : 'TEC'
                  }))
                ]}
                className="w-full border-gray-300 border p-2.5 rounded-xl bg-white focus:ring-brand-dark focus:border-brand-dark disabled:bg-gray-100 disabled:text-gray-400"
                required
              />
            </div>

            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
              <CustomSelect 
                value={formData.prioridad} 
                onChange={(val: string) => setFormData({...formData, prioridad: val})} 
                options={[
                  { value: 'Baja', label: 'Baja' },
                  { value: 'Media', label: 'Media' },
                  { value: 'Alta', label: 'Alta' },
                  { value: 'Urgente', label: 'Urgente' }
                ]}
                className="w-full border-gray-300 border p-2.5 rounded-xl bg-white focus:ring-brand-dark focus:border-brand-dark"
                required
              />
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
