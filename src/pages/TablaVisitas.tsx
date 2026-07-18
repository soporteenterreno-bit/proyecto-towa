import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { Clock, Play, CheckCircle, FileText, Search, MapPin, CalendarCheck, Filter, XCircle, Edit } from 'lucide-react';
import { CustomSelect } from '../components/CustomSelect';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNotification } from '../context/NotificationContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { parseSafeDate } from '../utils/date';

export default function TablaVisitas() {
  usePageTitle('Tabla de Visitas');
  const { showAlert } = useNotification();
  const { user, role, userData } = useAuth();
  const [visitas, setVisitas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterPais, setFilterPais] = useState(userData?.pais || '');
  const [filterStore, setFilterStore] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    if (userData?.pais && filterPais === '') {
      setFilterPais(userData.pais);
    }
  }, [userData]);

  // Reassignment / Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedVisita, setSelectedVisita] = useState<any>(null);
  const [availableTecnicos, setAvailableTecnicos] = useState<any[]>([]);
  
  // Edit Form State
  const [editData, setEditData] = useState({
    tecnico_uid: '',
    fecha_programada: '',
    prioridad: '',
    correo_encargado: ''
  });
  
  const [savingReassignment, setSavingReassignment] = useState(false);

  useEffect(() => {
    fetchVisitas();
  }, []);

  const fetchVisitas = async () => {
    try {
      setLoading(true);
      const { data: visitasData, error } = await supabase.from('visitas').select('*');
      if (error) throw error;

      const enhancedVisitas = await Promise.all((visitasData || []).map(async (v: any) => {
           let tiendaData: Record<string, any> = { id_tienda: '?', tienda: '?', ciudad_tienda: '?', pais_tienda: '?' };
           let tecnicoData: Record<string, any> = { nombre: '?' };

           try {
              if (v.id_tienda) {
                  const { data: tSnap } = await supabase.from('tiendas').select('*').eq('id', v.id_tienda).single();
                  if (tSnap) tiendaData = tSnap;
              }
              if (v.tecnico_uid) {
                  const { data: techSnap } = await supabase.from('users').select('*').eq('id', v.tecnico_uid).single();
                  if (techSnap) tecnicoData = techSnap;
              }
           } catch(e) {}
           
           return { ...v, tienda: tiendaData, tecnicoInfo: tecnicoData };
      }));

      enhancedVisitas.sort((a,b) => new Date(b.fecha_programada).getTime() - new Date(a.fecha_programada).getTime());
      setVisitas(enhancedVisitas);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
      switch(status) {
          case 'Pendiente': return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold inline-flex items-center"><Clock className="w-3 h-3 mr-1"/> Pendiente</span>;
          case 'En Curso': return <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold inline-flex items-center"><Play className="w-3 h-3 mr-1"/> En Curso</span>;
          case 'Completada': return <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold inline-flex items-center"><CheckCircle className="w-3 h-3 mr-1"/> Completada</span>;
          default: return null;
      }
  };

  const getMinDate = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const openEditModal = async (v: any) => {
    setSelectedVisita(v);
    setIsEditModalOpen(true);
    setEditData({
      tecnico_uid: v.tecnico_uid || '',
      fecha_programada: v.fecha_programada || '',
      prioridad: v.prioridad || 'Media',
      correo_encargado: v.correo_encargado || ''
    });
    
    try {
        const { data: allUsers } = await supabase.from('users').select('*');
        if (allUsers) {
            const filteredTechs = allUsers.filter(u => u.rol === 'tecnico' && u.pais === v.tienda.pais_tienda);
            setAvailableTecnicos(filteredTechs);
        }
    } catch(e) {
        console.error(e);
    }
  };

  const handleEditSave = async () => {
      if (!selectedVisita) return;
      
      if (editData.fecha_programada < getMinDate()) {
          return showAlert("La fecha de la visita no puede ser en el pasado.", "warning");
      }

      setSavingReassignment(true);
      try {
          await supabase.from('visitas').update({
              tecnico_uid: editData.tecnico_uid || null,
              fecha_programada: editData.fecha_programada,
              prioridad: editData.prioridad,
              correo_encargado: editData.correo_encargado || null
          }).eq('id', selectedVisita.id);
          
          setIsEditModalOpen(false);
          await fetchVisitas(); // Refresh the full list
          showAlert("Visita editada exitosamente", "success");
      } catch (e) {
          console.error(e);
          showAlert('Error al editar visita', 'error');
      } finally {
          setSavingReassignment(false);
      }
  };

  const uniqueStores = Array.from(new Set(visitas.map(v => v.tienda.tienda))).filter(Boolean).sort();
  const uniqueCountries = Array.from(new Set(visitas.map(v => v.tienda.pais_tienda))).filter(Boolean).sort();

  const filteredVisitas = visitas.filter(v => {
      if (filterStatus !== 'ALL' && v.status !== filterStatus) return false;
      if (filterPais && v.tienda.pais_tienda !== filterPais) return false;
      if (filterStore && v.tienda.tienda !== filterStore) return false;
      if (dateRange.start || dateRange.end) {
          const visitDate = parseISO(v.fecha_programada);
          const start = dateRange.start ? startOfDay(parseISO(dateRange.start)) : new Date('2000-01-01');
          const end = dateRange.end ? endOfDay(parseISO(dateRange.end)) : new Date('2100-01-01');
          if (!isWithinInterval(visitDate, { start, end })) return false;
      }
      return true;
  });

  const clearFilters = () => {
      setFilterStatus('ALL');
      setFilterStore('');
      setFilterPais('');
      setDateRange({ start: '', end: '' });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <h2 className="text-2xl font-bold text-gray-800">
          Tabla Global de Visitas
        </h2>
        
        <div className="flex space-x-2 w-full sm:w-auto">
            <button 
               onClick={() => setShowFilters(!showFilters)}
               className={`flex items-center w-full justify-center sm:w-auto px-4 py-2 border rounded-xl transition-colors whitespace-nowrap text-sm font-semibold shadow-sm ${showFilters || filterStore || filterPais || filterStatus !== 'ALL' || dateRange.start || dateRange.end ? 'bg-brand-gray border-brand-dark text-brand-dark' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
               <Filter className="w-5 h-5 mr-2" /> Filtros Avanzados
            </button>
        </div>
      </div>

      {showFilters && (
          <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-brand-dark/20 animate-in fade-in slide-in-from-top-2">
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                 <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Estado</label>
                    <CustomSelect 
                        value={filterStatus} 
                        onChange={(val: string) => setFilterStatus(val)} 
                        options={[
                            { value: 'ALL', label: 'Todas las visitas' },
                            { value: 'Pendiente', label: 'Pendiente' },
                            { value: 'En Curso', label: 'En Curso' },
                            { value: 'Completada', label: 'Completada' }
                        ]}
                        className="w-full text-sm border border-gray-300 p-2.5 rounded-xl bg-white focus:ring-2 focus:ring-brand-dark focus:border-brand-dark outline-none"
                    />
                 </div>
                 
                 <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">País</label>
                    <CustomSelect 
                        value={filterPais} 
                        onChange={(val: string) => setFilterPais(val)} 
                        options={[
                            { value: '', label: 'Cualquier país' },
                            ...uniqueCountries.map(pais => ({ value: pais as string, label: pais as string }))
                        ]}
                        className="w-full text-sm border border-gray-300 p-2.5 rounded-xl bg-white focus:ring-2 focus:ring-brand-dark focus:border-brand-dark outline-none"
                    />
                 </div>
                 
                 <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Tienda / Establecimiento</label>
                    <CustomSelect 
                        value={filterStore} 
                        onChange={(val: string) => setFilterStore(val)} 
                        options={[
                            { value: '', label: 'Cualquier tienda' },
                            ...uniqueStores.map(store => ({ value: store as string, label: store as string }))
                        ]}
                        className="w-full text-sm border border-gray-300 p-2.5 rounded-xl bg-white focus:ring-2 focus:ring-brand-dark focus:border-brand-dark outline-none"
                    />
                 </div>

                 <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Desde (Fecha Prog.)</label>
                    <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="w-full text-sm border border-gray-300 p-2.5 rounded-xl focus:ring-2 focus:ring-brand-dark focus:border-brand-dark outline-none bg-white"/>
                 </div>

                 <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Hasta (Fecha Prog.)</label>
                    <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="w-full text-sm border border-gray-300 p-2.5 rounded-xl focus:ring-2 focus:ring-brand-dark focus:border-brand-dark outline-none bg-white"/>
                 </div>
             </div>
             
             <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                <button onClick={clearFilters} disabled={filterStatus === 'ALL' && !filterStore && !filterPais && !dateRange.start && !dateRange.end} className="flex flex-1 sm:flex-none items-center justify-center px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed font-medium transition-colors">
                    <XCircle className="w-4 h-4 mr-2"/> Limpiar Filtros
                </button>
             </div>
          </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando visitas globales...</div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-max relative">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="p-4 text-sm font-semibold text-gray-600">Fecha Prog.</th>
                            <th className="p-4 text-sm font-semibold text-gray-600">País</th>
                            <th className="p-4 text-sm font-semibold text-gray-600">Tienda de Destino</th>
                            <th className="p-4 text-sm font-semibold text-gray-600">Tipo de Visita</th>
                            <th className="p-4 text-sm font-semibold text-gray-600">Técnico Asignado</th>
                            <th className="p-4 text-sm font-semibold text-gray-600">Estado / Eval.</th>
                            <th className="p-4 text-sm font-semibold text-gray-600 text-center sticky right-0 bg-gray-50 z-10 border-l border-gray-200 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)]">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredVisitas.map(v => (
                            <tr key={v.id} className="border-b border-gray-100 group hover:bg-gray-50 transition-colors">
                                <td className="p-4">
                                    <div className="flex items-center text-gray-800 font-medium whitespace-nowrap">
                                        <CalendarCheck className="w-4 h-4 mr-2 text-gray-400" />
                                        {format(parseSafeDate(v.fecha_programada), "dd/MMM/yyyy", {locale: es}).toUpperCase()}
                                    </div>
                                </td>
                                <td className="p-4 text-sm font-medium text-gray-800">
                                    {v.tienda.pais_tienda}
                                </td>
                                <td className="p-4 max-w-xs">
                                    <h3 className="text-sm font-bold text-gray-800 truncate" title={`${v.tienda.id_tienda} - ${v.tienda.tienda}`}>{v.tienda.id_tienda} - {v.tienda.tienda}</h3>
                                    <p className="text-xs text-gray-500 flex items-center mt-1"><MapPin className="w-3 h-3 mr-1 text-gray-400"/> {v.tienda.ciudad_tienda}</p>
                                </td>
                                <td className="p-4">
                                    <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded inline-block ${v.tipo === 'Falla' ? 'bg-red-50 text-red-600' : 'bg-brand-gray text-brand-dark'}`}>
                                        {v.tipo}
                                    </span>
                                    {v.tipo === 'Falla' && v.tt_number && <div className="text-xs font-mono text-gray-500 mt-1">TT: {v.tt_number}</div>}
                                    {v.prioridad && <div className="text-xs text-orange-600 font-medium mt-1">Prio: {v.prioridad}</div>}
                                </td>
                                <td className="p-4">
                                    <div className="text-sm font-medium text-gray-800">{v.tecnicoInfo?.nombre || 'Pool (Sin asignar)'}</div>
                                    <div className="text-xs text-gray-500 font-mono mt-0.5" title={v.tecnico_uid}>{v.tecnico_uid?.substring(0, 8)}</div>
                                </td>
                                <td className="p-4">
                                    <div className="mb-1">{getStatusBadge(v.status)}</div>
                                    {v.ponderacion_final !== undefined && v.ponderacion_final !== null && (
                                        <div className="text-xs text-brand-dark font-semibold flex items-center mt-2">
                                            <FileText className="w-3 h-3 mr-1" /> Calf: {v.ponderacion_final}%
                                        </div>
                                    )}
                                </td>
                                <td className="p-4 text-center sticky right-0 bg-white group-hover:bg-gray-50 z-10 border-l border-gray-100 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)] transition-colors">
                                    {v.status === 'Pendiente' ? (
                                      <button 
                                          onClick={() => openEditModal(v)}
                                          className="inline-flex items-center justify-center px-4 py-2 bg-white border border-gray-300 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap shadow-sm"
                                      >
                                          <Edit className="w-3 h-3 mr-1.5" /> Editar
                                      </button>
                                    ) : (
                                       <span className="text-xs text-gray-400 italic">No modificable</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {filteredVisitas.length === 0 && (
                            <tr>
                                <td colSpan={7} className="p-12 text-center text-gray-500">
                                    <div className="flex flex-col items-center justify-center">
                                        <Search className="w-10 h-10 text-gray-300 mb-3" />
                                        <p>No se encontraron visitas registradas con los filtros actuales.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && selectedVisita && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
           <div className="bg-white rounded-2xl p-6 md:p-8 w-full max-w-lg shadow-xl relative animate-in zoom-in-95 fade-in duration-200">
               <button 
                   onClick={() => setIsEditModalOpen(false)}
                   className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
               >
                   <XCircle className="w-6 h-6" />
               </button>
               
               <div className="mb-6">
                 <h2 className="text-xl font-bold text-gray-800">Editar Visita</h2>
                 <p className="text-sm text-gray-500 mt-1">
                   Visita a <strong>{selectedVisita.tienda.tienda}</strong> ({selectedVisita.tienda.pais_tienda})
                 </p>
               </div>

               <div className="space-y-4">
                   <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Programada</label>
                       <input 
                         type="date"
                         min={getMinDate()}
                         value={editData.fecha_programada}
                         onChange={e => setEditData({...editData, fecha_programada: e.target.value})}
                         className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-hover outline-none"
                       />
                   </div>

                   <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">
                           Técnico ({selectedVisita.tienda.pais_tienda})
                       </label>
                       <CustomSelect
                           value={editData.tecnico_uid}
                           onChange={(val: string) => setEditData({...editData, tecnico_uid: val})}
                           options={[
                               { value: '', label: '— Sin asignar (Pool) —' },
                               ...availableTecnicos.map(tech => ({ value: tech.id, label: `${tech.nombre} (${tech.id.substring(0,6)})` }))
                           ]}
                           className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-hover outline-none"
                       />
                   </div>

                   <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                       <CustomSelect
                           value={editData.prioridad}
                           onChange={(val: string) => setEditData({...editData, prioridad: val})}
                           options={[
                               { value: 'Baja', label: 'Baja' },
                               { value: 'Media', label: 'Media' },
                               { value: 'Alta', label: 'Alta' },
                               { value: 'Urgente', label: 'Urgente' }
                           ]}
                           className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-hover outline-none"
                       />
                   </div>

                   <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">Correo Encargado</label>
                       <input 
                         type="email"
                         value={editData.correo_encargado}
                         onChange={e => setEditData({...editData, correo_encargado: e.target.value})}
                         placeholder="opcional@empresa.com"
                         className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-hover outline-none"
                       />
                   </div>

                   <div className="mt-8 pt-4 border-t border-gray-100 flex justify-end gap-3">
                       <button
                           onClick={() => setIsEditModalOpen(false)}
                           className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-xl transition-colors"
                       >
                           Cancelar
                       </button>
                       <button
                           onClick={handleEditSave}
                           disabled={!editData.fecha_programada || savingReassignment}
                           className="flex items-center px-6 py-2.5 bg-brand-dark text-white text-sm font-medium rounded-xl hover:bg-brand-hover transition-colors disabled:opacity-50"
                       >
                           {savingReassignment ? 'Guardando...' : 'Guardar Cambios'}
                       </button>
                   </div>
               </div>
           </div>
        </div>
      )}
    </div>
  );
}
