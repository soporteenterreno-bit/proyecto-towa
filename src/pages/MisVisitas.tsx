import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Clock, Play, CheckCircle, FileText, Search, MapPin, CalendarCheck, Filter, XCircle, UserPlus } from 'lucide-react';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNotification } from '../context/NotificationContext';
import { usePageTitle } from '../hooks/usePageTitle';

export default function MisVisitas() {
  usePageTitle('Mis Visitas');
  const { showAlert } = useNotification();
  const { user, role, userData } = useAuth();
  const navigate = useNavigate();
  const [visitas, setVisitas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterStore, setFilterStore] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    const fetchVisitas = async () => {
      if (!user) return;
      try {
        // 1. Visitas asignadas al técnico actual
        const { data: assignedSnap } = await supabase.from('visitas').select('*').eq('tecnico_uid', user.id);

        // 2. Visitas pendientes sin técnico asignado (para auto-asignación en su país)
        const { data: unassignedSnap } = await supabase.from('visitas').select('*').eq('status', 'Pendiente').is('tecnico_uid', null);

        const allDocs = [
          ...(assignedSnap || []),
          ...(unassignedSnap || [])
        ];

        // Deduplicate by id
        const seen = new Set<string>();
        const uniqueDocs = allDocs.filter(d => { if (seen.has(d.id)) return false; seen.add(d.id); return true; });

        const visitasRaw = uniqueDocs.map(d => ({ id: d.id, ...d } as any));

        // Enhance with tienda data
        const enhanced = await Promise.all(visitasRaw.map(async (v: any) => {
          let tiendaData: Record<string, any> = { id_tienda: '?', tienda: '?', ciudad_tienda: '?', pais_tienda: '' };
          try {
            const { data: tSnap } = await supabase.from('tiendas').select('*').eq('id', v.id_tienda).single();
            if (tSnap) tiendaData = tSnap;
          } catch(e) {}
          return { ...v, tienda: tiendaData };
        }));

        // Filtrar visitas sin asignar que no son del país del técnico
        const userPais = userData?.pais || '';
        const filtered = enhanced.filter(v => {
          if (v.tecnico_uid === user.id) return true; // siempre ver las propias
          // Sin asignar: solo mostrar si la tienda es del país del técnico
          return userPais && v.tienda.pais_tienda === userPais;
        });

        filtered.sort((a, b) => new Date(b.fecha_programada).getTime() - new Date(a.fecha_programada).getTime());
        setVisitas(filtered);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchVisitas();
  }, [user, role, userData]);

  const uniqueStores = Array.from(new Set(visitas.map(v => v.tienda.tienda))).filter(Boolean).sort();

  const filteredVisitas = visitas.filter(v => {
      // Filter by Status
      if (filterStatus !== 'ALL' && v.status !== filterStatus) return false;
      
      // Filter by Store
      if (filterStore && v.tienda.tienda !== filterStore) return false;

      // Filter by Date Range
      if (dateRange.start || dateRange.end) {
          const visitDate = parseISO(v.fecha_programada);
          const start = dateRange.start ? startOfDay(parseISO(dateRange.start)) : new Date('2000-01-01');
          const end = dateRange.end ? endOfDay(parseISO(dateRange.end)) : new Date('2100-01-01');
          
          if (!isWithinInterval(visitDate, { start, end })) {
              return false;
          }
      }

      return true;
  });

  const clearFilters = () => {
      setFilterStatus('ALL');
      setFilterStore('');
      setDateRange({ start: '', end: '' });
  };

  const getStatusBadge = (status: string) => {
      switch(status) {
          case 'Pendiente': return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold inline-flex items-center"><Clock className="w-3 h-3 mr-1"/> Pendiente</span>;
          case 'En Curso': return <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold inline-flex items-center"><Play className="w-3 h-3 mr-1"/> En Curso</span>;
          case 'Completada': return <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold inline-flex items-center"><CheckCircle className="w-3 h-3 mr-1"/> Completada</span>;
          default: return null;
      }
  };

  const handleSelfAssign = async (visitaId: string) => {
    if (!user) return;
    setAssigning(visitaId);
    try {
      await supabase.from('visitas').update({ tecnico_uid: user.id }).eq('id', visitaId);
      setVisitas(prev => prev.map(v => v.id === visitaId ? { ...v, tecnico_uid: user.id } : v));
    } catch(e) {
      console.error(e);
      showAlert('Error al asignarte la visita. Verifica que siga disponible.', 'error');
    } finally {
      setAssigning(null);
    }
  };

  const handleStartOrView = async (v: any) => {
      if (v.status === 'Pendiente' && role === 'tecnico') {
          // Auto transition to En Curso
          try {
             await supabase.from('visitas').update({ status: 'En Curso', fecha_inicio: new Date().toISOString() }).eq('id', v.id);
          } catch(e) { console.error(e); }
      }
      // Navigate to form execution page
      navigate(`/visitas/ejecutar/${v.id}`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <h2 className="text-2xl font-bold text-gray-800">
          Mis Visitas Asignadas
        </h2>
        
        <div className="flex space-x-2 w-full sm:w-auto">
            <button 
               onClick={() => setShowFilters(!showFilters)}
               className={`flex items-center w-full justify-center sm:w-auto px-4 py-2 border rounded-xl transition-colors whitespace-nowrap text-sm font-semibold shadow-sm ${showFilters || filterStore || filterStatus !== 'ALL' || dateRange.start || dateRange.end ? 'bg-brand-gray border-brand-dark text-brand-dark' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
               <Filter className="w-5 h-5 mr-2" /> Filtros Avanzados
            </button>
        </div>
      </div>

      {/* Filters Area (Mobile Optimized Dropdown) */}
      {showFilters && (
          <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-brand-dark/20 animate-in fade-in slide-in-from-top-2">
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                 <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Estado</label>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full text-sm border border-gray-300 p-2.5 rounded-xl focus:ring-2 focus:ring-brand-dark focus:border-brand-dark outline-none bg-white">
                        <option value="ALL">Todas las visitas</option>
                        <option value="Pendiente">Pendiente</option>
                        <option value="En Curso">En Curso</option>
                        <option value="Completada">Completada</option>
                    </select>
                 </div>
                 
                 <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Tienda / Establecimiento</label>
                    <select value={filterStore} onChange={e => setFilterStore(e.target.value)} className="w-full text-sm border border-gray-300 p-2.5 rounded-xl focus:ring-2 focus:ring-brand-dark focus:border-brand-dark outline-none bg-white">
                        <option value="">Cualquier tienda</option>
                        {uniqueStores.map(store => <option key={store as string} value={store as string}>{store as string}</option>)}
                    </select>
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
                <button onClick={clearFilters} disabled={filterStatus === 'ALL' && !filterStore && !dateRange.start && !dateRange.end} className="flex flex-1 sm:flex-none items-center justify-center px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed font-medium transition-colors">
                    <XCircle className="w-4 h-4 mr-2"/> Limpiar Filtros
                </button>
             </div>
          </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando visitas...</div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-max relative">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="p-4 text-sm font-semibold text-gray-600">Fecha Programada</th>
                            <th className="p-4 text-sm font-semibold text-gray-600">Tienda de Destino</th>
                            <th className="p-4 text-sm font-semibold text-gray-600">Tipo de Visita</th>
                            <th className="p-4 text-sm font-semibold text-gray-600">Estado / Eval.</th>
                            <th className="p-4 text-sm font-semibold text-gray-600 text-center sticky right-0 bg-gray-50 z-10 border-l border-gray-200 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)]">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredVisitas.map(v => (
                            <tr key={v.id} className="border-b border-gray-100 group hover:bg-gray-50 transition-colors">
                                <td className="p-4">
                                    <div className="flex items-center text-gray-800 font-medium">
                                        <CalendarCheck className="w-4 h-4 mr-2 text-gray-400" />
                                        {format(new Date(v.fecha_programada), "dd/MMM/yyyy", {locale: es}).toUpperCase()}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1 ml-6">{format(new Date(v.fecha_programada), "EEEE", {locale: es})}</div>
                                </td>
                                <td className="p-4">
                                    <h3 className="text-sm font-bold text-gray-800">{v.tienda.id_tienda} - {v.tienda.tienda}</h3>
                                    <p className="text-xs text-gray-500 flex items-center mt-1"><MapPin className="w-3 h-3 mr-1 text-gray-400"/> {v.tienda.ciudad_tienda}</p>
                                </td>
                                <td className="p-4">
                                    <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded inline-block ${v.tipo === 'Falla' ? 'bg-red-50 text-red-600' : 'bg-brand-gray text-brand-dark'}`}>
                                        {v.tipo}
                                    </span>
                                    {v.tipo === 'Falla' && v.tt_number && <div className="text-xs font-mono text-gray-500 mt-1">TT: {v.tt_number}</div>}
                                </td>
                                <td className="p-4">
                                    <div className="mb-1">{getStatusBadge(v.status)}</div>
                                    {v.tecnico_uid !== user?.id && (
                                      <div className="mt-1">
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Disponible en tu país</span>
                                      </div>
                                    )}
                                    {v.ponderacion_final !== undefined && v.ponderacion_final !== null && v.tecnico_uid === user?.id && (
                                        <div className={`text-xs font-semibold flex items-center mt-2 ${v.status === 'Completada' ? 'text-brand-dark' : 'text-blue-600'}`}>
                                            <FileText className="w-3 h-3 mr-1" /> {v.status === 'Completada' ? 'Calificación:' : 'Progreso:'} {v.ponderacion_final}%
                                        </div>
                                    )}
                                </td>
                                <td className="p-4 text-center sticky right-0 bg-white group-hover:bg-gray-50 z-10 border-l border-gray-100 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)] transition-colors">
                                    {v.tecnico_uid !== user?.id && v.status === 'Pendiente' ? (
                                      <button
                                        onClick={() => handleSelfAssign(v.id)}
                                        disabled={assigning === v.id}
                                        className="inline-flex items-center justify-center px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors min-w-[120px] disabled:opacity-50"
                                      >
                                        {assigning === v.id ? 'Asignando...' : <><UserPlus className="w-3 h-3 mr-1.5"/>Asignarme</>}
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => handleStartOrView(v)}
                                        className="inline-flex items-center justify-center px-4 py-2 bg-brand-dark text-white text-xs font-semibold rounded-lg hover:bg-brand-hover transition-colors min-w-[120px]"
                                      >
                                        {v.status === 'Completada' ? 'Ver Reporte' : v.status === 'En Curso' ? 'Continuar' : 'Iniciar'}
                                      </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {filteredVisitas.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-12 text-center text-gray-500">
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
    </div>
  );
}
